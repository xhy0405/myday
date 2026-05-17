import { useEffect, useRef, useState } from "react";
import {
  createDailyCheckinTemplate,
  deleteDailyCheckinTemplate,
  getRecord,
  saveRecord,
  updateDailyCheckinTemplate,
} from "../data/storage";
import type { DayRecord } from "../types";
import { isFutureDateString } from "../utils/dateUtils";

function finalizeRecord(record: DayRecord): DayRecord {
  const dailyCheckins = isFutureDateString(record.date)
    ? record.dailyCheckins.map((item) => ({ ...item, completed: false }))
    : record.dailyCheckins;
  const dailyCheckinDone = dailyCheckins.some((item) => item.completed);

  if (isFutureDateString(record.date)) {
    return { ...record, rating: null, dailyCheckinDone, dailyCheckins };
  }
  return { ...record, dailyCheckinDone, dailyCheckins };
}

export interface DayRecordEditor {
  record: DayRecord | null;
  loading: boolean;
  error: string | null;
  reloadRecord: () => void;
  addTask: (title: string) => void;
  toggleTask: (id: string) => void;
  updateTaskTitle: (id: string, title: string) => void;
  pinTask: (id: string) => void;
  reorderTasks: (activeId: string, overId: string) => void;
  deleteTask: (id: string) => void;
  setRating: (rating: number) => void;
  setNote: (note: string) => void;
  setMood: (moodId: string) => void;
  addDailyCheckin: (title: string) => void;
  toggleDailyCheckin: (id: string) => void;
  updateDailyCheckinTitle: (id: string, title: string) => void;
  deleteDailyCheckin: (id: string) => void;
}

export function useDayRecordEditor(date: string | null): DayRecordEditor {
  const [record, setRecord] = useState<DayRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(date !== null);
  const [error, setError] = useState<string | null>(null);
  const recordRef = useRef<DayRecord | null>(null);

  const setCurrentRecord = (next: DayRecord | null): void => {
    recordRef.current = next;
    setRecord(next);
  };

  const reloadRecord = (): void => {
    if (date === null) {
      setCurrentRecord(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void getRecord(date)
      .then((next) => {
        setCurrentRecord(next);
      })
      .catch(() => {
        setError("读取本地数据失败，请刷新后重试。");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    let cancelled = false;

    if (date === null) {
      setCurrentRecord(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    void getRecord(date)
      .then((next) => {
        if (!cancelled) {
          setCurrentRecord(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("读取本地数据失败，请刷新后重试。");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  const updateRecord = (makeNext: (current: DayRecord) => DayRecord): void => {
    if (date === null) {
      return;
    }

    void (async () => {
      const current = recordRef.current ?? (await getRecord(date));
      const next = finalizeRecord(makeNext({ ...current, date }));
      setCurrentRecord(next);
      await saveRecord(next);
    })().catch(() => {
      setError("保存本地数据失败，请稍后重试。");
    });
  };

  const addTask = (title: string): void => {
    updateRecord((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: crypto.randomUUID(),
          title,
          completed: false,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
  };

  const toggleTask = (id: string): void => {
    updateRecord((current) => {
      const taskIndex = current.tasks.findIndex((task) => task.id === id);
      if (taskIndex === -1) {
        return current;
      }

      const task = current.tasks[taskIndex];
      const updatedTask = { ...task, completed: !task.completed };
      const tasks = [...current.tasks];
      tasks.splice(taskIndex, 1);

      if (updatedTask.completed) {
        tasks.push(updatedTask);
      } else {
        tasks.splice(taskIndex, 0, updatedTask);
      }

      return { ...current, tasks };
    });
  };

  const updateTaskTitle = (id: string, title: string): void => {
    const trimmedTitle = title.trim();
    if (trimmedTitle === "") {
      return;
    }

    updateRecord((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, title: trimmedTitle } : task,
      ),
    }));
  };

  const reorderTasks = (activeId: string, overId: string): void => {
    if (activeId === overId) {
      return;
    }

    updateRecord((current) => {
      const fromIndex = current.tasks.findIndex((task) => task.id === activeId);
      const toIndex = current.tasks.findIndex((task) => task.id === overId);

      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }

      const tasks = [...current.tasks];
      const [movedTask] = tasks.splice(fromIndex, 1);
      tasks.splice(toIndex, 0, movedTask);

      return { ...current, tasks };
    });
  };

  const pinTask = (id: string): void => {
    updateRecord((current) => {
      const taskIndex = current.tasks.findIndex((task) => task.id === id);
      if (taskIndex <= 0) {
        return current;
      }

      const tasks = [...current.tasks];
      const [pinnedTask] = tasks.splice(taskIndex, 1);
      tasks.unshift(pinnedTask);

      return { ...current, tasks };
    });
  };

  const deleteTask = (id: string): void => {
    updateRecord((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }));
  };

  const setRating = (rating: number): void => {
    if (date === null || isFutureDateString(date)) {
      return;
    }
    updateRecord((current) => ({ ...current, rating }));
  };

  const setNote = (note: string): void => {
    updateRecord((current) => ({ ...current, note }));
  };

  const setMood = (moodId: string): void => {
    updateRecord((current) => ({ ...current, moodId }));
  };

  const addDailyCheckin = (title: string): void => {
    const trimmedTitle = title.trim();
    if (date === null || trimmedTitle === "") {
      return;
    }

    void (async () => {
      const template = await createDailyCheckinTemplate(trimmedTitle, date);
      const current = recordRef.current ?? (await getRecord(date));
      if (current.dailyCheckins.some((item) => item.id === template.id)) {
        return;
      }
      const next = finalizeRecord({
        ...current,
        date,
        dailyCheckins: [
          ...current.dailyCheckins,
          {
            id: template.id,
            title: template.title,
            completed: false,
            createdAt: template.createdAt,
          },
        ],
      });
      setCurrentRecord(next);
      await saveRecord(next);
    })().catch(() => {
      setError("保存本地数据失败，请稍后重试。");
    });
  };

  const toggleDailyCheckin = (id: string): void => {
    if (date === null || isFutureDateString(date)) {
      return;
    }
    updateRecord((current) => ({
      ...current,
      dailyCheckins: current.dailyCheckins.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item,
      ),
    }));
  };

  const updateDailyCheckinTitle = (id: string, title: string): void => {
    const trimmedTitle = title.trim();
    if (trimmedTitle === "") {
      return;
    }
    void (async () => {
      await updateDailyCheckinTemplate(id, trimmedTitle);
      updateRecord((current) => ({
        ...current,
        dailyCheckins: current.dailyCheckins.map((item) =>
          item.id === id ? { ...item, title: trimmedTitle } : item,
        ),
      }));
    })().catch(() => {
      setError("保存本地数据失败，请稍后重试。");
    });
  };

  const deleteDailyCheckin = (id: string): void => {
    void (async () => {
      await deleteDailyCheckinTemplate(id);
      updateRecord((current) => ({
        ...current,
        dailyCheckins: current.dailyCheckins.filter((item) => item.id !== id),
      }));
    })().catch(() => {
      setError("保存本地数据失败，请稍后重试。");
    });
  };

  return {
    record,
    loading,
    error,
    reloadRecord,
    addTask,
    toggleTask,
    updateTaskTitle,
    pinTask,
    reorderTasks,
    deleteTask,
    setRating,
    setNote,
    setMood,
    addDailyCheckin,
    toggleDailyCheckin,
    updateDailyCheckinTitle,
    deleteDailyCheckin,
  };
}
