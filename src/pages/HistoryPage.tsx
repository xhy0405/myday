import { type FC, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  NotebookText,
  Pencil,
  Sparkles,
} from "lucide-react";
import { getAllRecords } from "../data/storage";
import type { DayRecord } from "../types";
import {
  formatDateString,
  formatDisplayDate,
  getTodayString,
  isFutureDateString,
} from "../utils/dateUtils";
import { useDayRecordEditor } from "../hooks/useDayRecordEditor";
import StarRating from "../components/StarRating";
import DailyNote from "../components/DailyNote";
import TaskList from "../components/TaskList";
import MoodPicker from "../components/MoodPicker";
import { getMoodById } from "../data/moods";
import MobileBottomSheet from "../components/MobileBottomSheet";
import DailyCheckinList from "../components/DailyCheckinList";

const WEEKDAY_HEADERS: readonly string[] = ["一", "二", "三", "四", "五", "六", "日"];

function getCalendarDayButtonClass(params: {
  stored: boolean;
  checkedIn: boolean;
  isSelected: boolean;
  isToday: boolean;
}): string {
  const { stored, checkedIn, isSelected, isToday } = params;
  const base =
    "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border p-1 text-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400";

  if (isSelected) {
    return `${base} z-10 border-[#10aab2] bg-[#10aab2] text-white shadow-md ring-2 ring-cyan-200`;
  }

  if (checkedIn) {
    return `${base} border-emerald-100 bg-emerald-50 text-emerald-800 shadow-sm hover:border-emerald-200 hover:bg-emerald-100/70`;
  }

  if (stored) {
    return `${base} border-amber-100 bg-amber-50 text-slate-900 shadow-sm hover:border-amber-200`;
  }

  if (isToday) {
    return `${base} border-cyan-100 bg-white text-slate-900 ring-1 ring-cyan-300 hover:bg-cyan-50`;
  }

  return `${base} border-transparent text-slate-500 hover:bg-slate-100`;
}

function buildMonthCells(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const padStart = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < padStart; i++) {
    cells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(d);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function hasSavedContent(record: DayRecord | undefined): boolean {
  if (record === undefined) {
    return false;
  }
  return (
    record.dailyCheckinDone ||
    record.dailyCheckins.length > 0 ||
    record.tasks.length > 0 ||
    record.rating !== null ||
    record.note.trim() !== "" ||
    record.moodId !== null
  );
}

const HistoryPage: FC = () => {
  const todayStr = getTodayString();
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(() => todayStr);
  const [mobileDetailOpen, setMobileDetailOpen] = useState<boolean>(false);
  const [allRecords, setAllRecords] = useState<Record<string, DayRecord>>({});
  const [dataError, setDataError] = useState<string | null>(null);

  const {
    record,
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
  } = useDayRecordEditor(selectedDateStr);

  const year = viewMonth.getFullYear();
  const monthIndex = viewMonth.getMonth();
  const monthTitle = `${year}年${monthIndex + 1}月`;
  const cells = useMemo(() => buildMonthCells(year, monthIndex), [year, monthIndex]);

  useEffect(() => {
    let cancelled = false;

    void getAllRecords()
      .then((records) => {
        if (!cancelled) {
          setAllRecords(records);
          setDataError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataError("读取历史数据失败，请刷新后重试。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (record !== null) {
      setAllRecords((prev) => ({ ...prev, [record.date]: record }));
    }
  }, [record]);

  const displayRecord = record;
  const isSelectedFuture =
    selectedDateStr !== null && isFutureDateString(selectedDateStr);
  const taskTotal = displayRecord?.tasks.length ?? 0;
  const taskCompleted = displayRecord?.tasks.filter((t) => t.completed).length ?? 0;
  const checkinTotal = displayRecord?.dailyCheckins.length ?? 0;
  const checkinCompleted = displayRecord?.dailyCheckins.filter((item) => item.completed).length ?? 0;

  const handlePrevMonth = (): void => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDateStr(null);
  };

  const handleNextMonth = (): void => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDateStr(null);
  };

  const handlePickDay = (day: number): void => {
    setSelectedDateStr(formatDateString(year, monthIndex, day));
    setMobileDetailOpen(true);
  };

  const monthCheckinCount = cells.reduce((count, day) => {
    if (day === null) {
      return count;
    }
    const monthRecord = allRecords[formatDateString(year, monthIndex, day)];
    return monthRecord?.dailyCheckinDone === true ||
      monthRecord?.dailyCheckins.some((item) => item.completed) === true
      ? count + 1
      : count;
  }, 0);

  const dateEditor = displayRecord ? (
    <section className="space-y-6">
      <div className="panel">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-950">
              {selectedDateStr === null ? "日期详情" : formatDisplayDate(selectedDateStr)}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {selectedDateStr !== null && selectedDateStr in allRecords
                ? `打卡 ${checkinCompleted} / ${checkinTotal} 项，任务 ${taskCompleted} / ${taskTotal} 项`
                : "这一天还没有保存过内容。"}
            </p>
          </div>
        </div>
      </div>

      <section className="panel panel-glow-cool panel-interactive overflow-visible">
        <div className="flex items-start gap-3">
          <div className="icon-tile">
            <CalendarCheck className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="section-title">打卡内容</h3>
            <p className="section-copy">添加并勾选这一天坚持过的内容，比如学英语。</p>
          </div>
        </div>
        <div className="mt-5">
          <DailyCheckinList
            items={displayRecord.dailyCheckins}
            onAdd={addDailyCheckin}
            onToggle={toggleDailyCheckin}
            onUpdateTitle={updateDailyCheckinTitle}
            onDelete={deleteDailyCheckin}
            emptyText="这一天还没有打卡内容。可以添加“学英语”“背单词”等项目。"
            completionReadOnly={isSelectedFuture}
          />
        </div>
      </section>

      <section className="panel panel-glow panel-interactive overflow-visible">
        <div className="flex items-start gap-3">
          <div className="icon-tile">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="section-title">状态与评分</h3>
            <p className="section-copy">查看或调整这一天的状态和自评分。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">状态</h4>
            <div className="mt-3">
              <MoodPicker
                value={displayRecord.moodId}
                onChange={setMood}
                emptyLabel="选一个代表这一天的状态吧"
              />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900">自评</h4>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {isSelectedFuture ? "未来日期暂不评分，到当天后再填写。" : "点击星星选择分数，可随时修改。"}
            </p>
            <div className="mt-3 overflow-visible">
              {isSelectedFuture ? (
                <StarRating value={null} readOnly />
              ) : (
                <StarRating value={displayRecord.rating} onChange={setRating} />
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="panel panel-glow-cool panel-interactive h-full">
          <div className="flex items-start gap-3">
            <div className="icon-tile">
              <ListChecks className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="section-title">待办任务</h3>
              <p className="section-copy">补充任务，或更新完成情况。</p>
            </div>
          </div>
          <div className="mt-5">
            <TaskList
              tasks={displayRecord.tasks}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onUpdateTaskTitle={updateTaskTitle}
              onPinTask={pinTask}
              onReorderTasks={reorderTasks}
              onDeleteTask={deleteTask}
              emptyText="这一天还没有任务。可以补充一个当时的待办或结果。"
            />
          </div>
        </section>

        <section className="panel panel-glow-warm panel-interactive h-full">
          <div className="flex items-start gap-3">
            <div className="icon-tile">
              <NotebookText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="section-title">当日记录</h3>
              <p className="section-copy">沉淀这一天的关键进展、感受或复盘。</p>
            </div>
          </div>
          <div className="mt-5">
            <DailyNote
              value={displayRecord.note}
              onChange={setNote}
              placeholder="写下这一天想留下的内容"
              ariaLabel="当日记录"
            />
          </div>
        </section>
      </div>
    </section>
  ) : null;

  return (
    <main className="page-shell">
      <header className="mobile-workspace-header lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0b8f99]">
              Timeline archive
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">历史记录</h1>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
            {monthTitle}
          </div>
        </div>
        {dataError !== null ? (
          <p className="mt-3 text-sm font-medium text-rose-600">{dataError}</p>
        ) : null}
      </header>

      <header className="page-header hidden lg:flex">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="icon-tile">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="eyebrow">Timeline archive</p>
              <h1 className="page-title">历史记录</h1>
            </div>
          </div>
          {dataError !== null ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{dataError}</p>
          ) : (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              点击日历中的任意一天，查看并编辑那天的打卡、状态、任务和记录。
            </p>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
          {monthTitle}
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-6 lg:mt-8 lg:grid lg:grid-cols-5 lg:gap-8">
        <section className="panel panel-glow-cool panel-interactive lg:sticky lg:top-20 lg:col-span-2 lg:self-start">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="icon-button"
                aria-label="上一个月"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
              <h2 className="section-title min-w-28 text-center">{monthTitle}</h2>
              <button
                type="button"
                onClick={handleNextMonth}
                className="icon-button"
                aria-label="下一个月"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              <CalendarCheck className="h-5 w-5" aria-hidden />
              本月打卡 {monthCheckinCount} 天
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate-400">
            {WEEKDAY_HEADERS.map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="min-h-14" aria-hidden />;
              }

              const dateStr = formatDateString(year, monthIndex, day);
              const monthRecord = allRecords[dateStr];
              const stored = hasSavedContent(monthRecord);
              const checkedIn =
                monthRecord?.dailyCheckinDone === true ||
                monthRecord?.dailyCheckins.some((item) => item.completed) === true;
              const moodOption = monthRecord?.moodId ? getMoodById(monthRecord.moodId) : undefined;
              const isToday = dateStr === todayStr;
              const isSelected = selectedDateStr === dateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handlePickDay(day)}
                  className={getCalendarDayButtonClass({
                    stored,
                    checkedIn,
                    isSelected,
                    isToday,
                  })}
                  aria-label={`${dateStr}，${checkedIn ? "已打卡" : stored ? "有记录" : "无记录"}`}
                  aria-pressed={isSelected}
                >
                  <span className={`font-semibold ${isSelected ? "text-white" : ""}`}>
                    {day}
                  </span>
                  {checkedIn ? (
                    <CalendarCheck className="h-4 w-4" aria-hidden />
                  ) : stored && moodOption ? (
                    <span className="text-base leading-none" aria-hidden title={moodOption.label}>
                      {moodOption.emoji}
                    </span>
                  ) : stored ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          {selectedDateStr !== null ? (
            <button
              type="button"
              className="btn-primary mt-5 w-full lg:hidden"
              onClick={() => setMobileDetailOpen(true)}
            >
              <Pencil className="h-5 w-5 shrink-0" aria-hidden />
              查看 / 编辑 {formatDisplayDate(selectedDateStr)}
            </button>
          ) : null}
        </section>

        <div className="hidden min-w-0 lg:col-span-3 lg:block">
          {selectedDateStr === null ? (
            <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-[#10aab2] shadow-inner">
                <CalendarRange className="h-8 w-8" strokeWidth={1.25} aria-hidden />
              </div>
              <p className="mt-5 max-w-sm text-sm leading-6 text-slate-500">
                在日历里选择一天，查看并编辑这一天的状态、待办任务和记录。
              </p>
            </div>
          ) : dateEditor}
        </div>
      </div>

      <MobileBottomSheet
        open={mobileDetailOpen && selectedDateStr !== null}
        title={selectedDateStr === null ? "日期详情" : formatDisplayDate(selectedDateStr)}
        description={
          displayRecord
            ? `打卡 ${checkinCompleted} / ${checkinTotal} 项，任务 ${taskCompleted} / ${taskTotal} 项`
            : "选择日期后查看当天记录"
        }
        onClose={() => setMobileDetailOpen(false)}
      >
        {selectedDateStr === null || displayRecord === null ? (
          <p className="panel-muted text-sm leading-6 text-slate-500">
            在日历里选择一天，查看这一天的状态、评分、待办任务和记录。
          </p>
        ) : (
          <div className="space-y-5">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-[#0b8f99]" aria-hidden />
                <h3 className="text-base font-semibold text-slate-950">打卡内容</h3>
              </div>
              <DailyCheckinList
                items={displayRecord.dailyCheckins}
                onAdd={addDailyCheckin}
                onToggle={toggleDailyCheckin}
                onUpdateTitle={updateDailyCheckinTitle}
                onDelete={deleteDailyCheckin}
                emptyText="这一天还没有打卡内容。可以添加“学英语”“背单词”等项目。"
                completionReadOnly={isSelectedFuture}
              />
            </section>

            <section className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-[#0b8f99]" aria-hidden />
                <h3 className="text-base font-semibold text-slate-950">状态与评分</h3>
              </div>
              <div className="mt-4">
                <MoodPicker
                  value={displayRecord.moodId}
                  onChange={setMood}
                  emptyLabel="选一个代表这一天的状态吧"
                />
              </div>
              <div className="mt-4 overflow-visible">
                <StarRating
                  value={isSelectedFuture ? null : displayRecord.rating}
                  onChange={!isSelectedFuture ? setRating : undefined}
                  readOnly={isSelectedFuture}
                />
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-[#0b8f99]" aria-hidden />
                <h3 className="text-base font-semibold text-slate-950">待办任务</h3>
              </div>
              <TaskList
                tasks={displayRecord.tasks}
                onAddTask={addTask}
                onToggleTask={toggleTask}
                onUpdateTaskTitle={updateTaskTitle}
                onPinTask={pinTask}
                onReorderTasks={reorderTasks}
                onDeleteTask={deleteTask}
                emptyText="这一天还没有任务。可以补充一个当时的待办或结果。"
              />
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2">
                <NotebookText className="h-5 w-5 text-[#0b8f99]" aria-hidden />
                <h3 className="text-base font-semibold text-slate-950">当日记录</h3>
              </div>
              <DailyNote
                value={displayRecord.note}
                onChange={setNote}
                placeholder="写下这一天想留下的内容"
                ariaLabel="当日记录"
              />
            </section>
          </div>
        )}
      </MobileBottomSheet>
    </main>
  );
};

export default HistoryPage;
