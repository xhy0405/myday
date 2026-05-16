import type { DayRecord } from "../types";
import { addCalendarDays, getTodayString } from "../utils/dateUtils";

const DB_NAME = "myday-db";
const DB_VERSION = 1;
const RECORD_STORE_NAME = "records";
const LEGACY_STORAGE_KEY = "myday-records";
const MIGRATION_FLAG_KEY = "myday-indexeddb-migrated";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function createEmptyRecord(date: string): DayRecord {
  return {
    date,
    tasks: [],
    carryoverCheckedDates: [],
    rating: null,
    note: "",
    moodId: null,
    dailyCheckinDone: false,
    dailyCheckins: [],
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  return value >= 1 && value <= 10 ? value : null;
}

function normalizeDailyCheckins(value: unknown, legacyDone: boolean): DayRecord["dailyCheckins"] {
  if (!Array.isArray(value)) {
    return legacyDone
      ? [
          {
            id: crypto.randomUUID(),
            title: "每日打卡",
            completed: true,
            createdAt: new Date().toISOString(),
          },
        ]
      : [];
  }

  return value.flatMap((checkinValue) => {
    if (!isPlainObject(checkinValue) || typeof checkinValue.title !== "string") {
      return [];
    }

    const title = checkinValue.title.trim();
    if (title === "") {
      return [];
    }

    return [
      {
        id:
          typeof checkinValue.id === "string" && checkinValue.id.trim() !== ""
            ? checkinValue.id
            : crypto.randomUUID(),
        title,
        completed: checkinValue.completed === true,
        createdAt:
          typeof checkinValue.createdAt === "string"
            ? checkinValue.createdAt
            : new Date().toISOString(),
      },
    ];
  });
}

function normalizeRecord(dateKey: string, value: unknown): DayRecord | null {
  if (!DATE_KEY_PATTERN.test(dateKey) || !isPlainObject(value)) {
    return null;
  }

  const tasks = Array.isArray(value.tasks)
    ? value.tasks.flatMap((taskValue) => {
        if (!isPlainObject(taskValue) || typeof taskValue.title !== "string") {
          return [];
        }

        return [
          {
            id:
              typeof taskValue.id === "string" && taskValue.id.trim() !== ""
                ? taskValue.id
                : crypto.randomUUID(),
            title: taskValue.title,
            completed: taskValue.completed === true,
            createdAt:
              typeof taskValue.createdAt === "string"
                ? taskValue.createdAt
                : new Date().toISOString(),
            carryoverFromDate:
              typeof taskValue.carryoverFromDate === "string"
                ? taskValue.carryoverFromDate
                : undefined,
            carryoverFromTaskId:
              typeof taskValue.carryoverFromTaskId === "string"
                ? taskValue.carryoverFromTaskId
                : undefined,
          },
        ];
      })
    : [];

  const carryoverCheckedDates = Array.isArray(value.carryoverCheckedDates)
    ? value.carryoverCheckedDates.filter(
        (dateValue): dateValue is string =>
          typeof dateValue === "string" && DATE_KEY_PATTERN.test(dateValue),
      )
    : [];

  const legacyDailyCheckinDone = value.dailyCheckinDone === true;
  const dailyCheckins = normalizeDailyCheckins(value.dailyCheckins, legacyDailyCheckinDone);

  return {
    date: dateKey,
    tasks,
    carryoverCheckedDates,
    rating: normalizeRating(value.rating),
    note: typeof value.note === "string" ? value.note : "",
    moodId: typeof value.moodId === "string" ? value.moodId : null,
    dailyCheckinDone: legacyDailyCheckinDone || dailyCheckins.some((item) => item.completed),
    dailyCheckins,
  };
}

function normalizeRecords(value: unknown): Record<string, DayRecord> {
  if (!isPlainObject(value)) {
    return {};
  }

  const normalized: Record<string, DayRecord> = {};
  for (const [dateKey, recordValue] of Object.entries(value)) {
    const record = normalizeRecord(dateKey, recordValue);
    if (record !== null) {
      normalized[dateKey] = record;
    }
  }
  return normalized;
}

function parseLegacyRecords(raw: string | null): Record<string, DayRecord> {
  if (raw === null || raw === "") {
    return {};
  }

  try {
    return normalizeRecords(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORD_STORE_NAME)) {
        db.createObjectStore(RECORD_STORE_NAME, { keyPath: "date" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readAllRecordsFromIndexedDb(): Promise<Record<string, DayRecord>> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(RECORD_STORE_NAME, "readonly");
    const store = transaction.objectStore(RECORD_STORE_NAME);
    const records = await requestToPromise<DayRecord[]>(store.getAll());

    return records.reduce<Record<string, DayRecord>>((acc, record) => {
      const normalized = normalizeRecord(record.date, record);
      if (normalized !== null) {
        acc[normalized.date] = normalized;
      }
      return acc;
    }, {});
  } finally {
    db.close();
  }
}

async function writeRecordsToIndexedDb(records: Record<string, DayRecord>): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(RECORD_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RECORD_STORE_NAME);

    for (const record of Object.values(records)) {
      store.put(record);
    }

    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

function createCarryoverTask(sourceDate: string, sourceTask: DayRecord["tasks"][number]): DayRecord["tasks"][number] {
  return {
    id: crypto.randomUUID(),
    title: sourceTask.title,
    completed: false,
    createdAt: new Date().toISOString(),
    carryoverFromDate: sourceDate,
    carryoverFromTaskId: sourceTask.id,
  };
}

async function ensureTodayCarryover(date: string, records: Record<string, DayRecord>): Promise<DayRecord> {
  const today = getTodayString();
  const targetRecord = records[date] ?? createEmptyRecord(date);

  if (date !== today) {
    return targetRecord;
  }

  const previousDate = addCalendarDays(today, -1);
  const checkedDates = targetRecord.carryoverCheckedDates ?? [];
  if (checkedDates.includes(previousDate)) {
    return targetRecord;
  }

  const nextCheckedDates = [...checkedDates, previousDate];
  if (records[date] !== undefined) {
    const nextRecord = { ...targetRecord, carryoverCheckedDates: nextCheckedDates };
    records[date] = nextRecord;
    await saveRecord(nextRecord);
    return nextRecord;
  }

  const previousRecord = records[previousDate];
  const carryoverTasks =
    previousRecord?.tasks
      .filter((task) => !task.completed)
      .map((task) => createCarryoverTask(previousDate, task)) ?? [];

  const nextRecord = {
    ...targetRecord,
    carryoverCheckedDates: nextCheckedDates,
    tasks: [...carryoverTasks, ...targetRecord.tasks],
  };

  records[date] = nextRecord;
  await saveRecord(nextRecord);
  return nextRecord;
}

async function ensureLegacyDataMigrated(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === "1") {
    return;
  }

  const legacyRecords = parseLegacyRecords(localStorage.getItem(LEGACY_STORAGE_KEY));
  if (Object.keys(legacyRecords).length > 0) {
    const indexedDbRecords = await readAllRecordsFromIndexedDb();
    await writeRecordsToIndexedDb({ ...legacyRecords, ...indexedDbRecords });
  }

  localStorage.setItem(MIGRATION_FLAG_KEY, "1");
}

export async function getAllRecords(): Promise<Record<string, DayRecord>> {
  await ensureLegacyDataMigrated();
  return readAllRecordsFromIndexedDb();
}

export async function getRecord(date: string): Promise<DayRecord> {
  const all = await getAllRecords();
  return ensureTodayCarryover(date, all);
}

export async function saveRecord(record: DayRecord): Promise<void> {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(RECORD_STORE_NAME, "readwrite");
    transaction.objectStore(RECORD_STORE_NAME).put(record);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

export async function exportRecordsJson(): Promise<string> {
  return JSON.stringify(
    {
      app: "MyDay",
      version: 2,
      storage: "indexedDB",
      exportedAt: new Date().toISOString(),
      records: await getAllRecords(),
    },
    null,
    2,
  );
}

export async function importRecordsJson(raw: string): Promise<number> {
  const parsed: unknown = JSON.parse(raw) as unknown;
  const source = isPlainObject(parsed) && "records" in parsed ? parsed.records : parsed;
  const incoming = normalizeRecords(source);
  const current = await getAllRecords();

  await writeRecordsToIndexedDb({ ...current, ...incoming });
  return Object.keys(incoming).length;
}
