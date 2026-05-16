import { type FC, useMemo, useState } from "react";
import {
  CalendarClock,
  CircleCheck,
  ListChecks,
  NotebookText,
  SmilePlus,
  Sparkles,
  Star,
  Sun,
} from "lucide-react";
import {
  formatDisplayDate,
  getTodayString,
  getYesterdayString,
  getTomorrowString,
  isFutureDateString,
} from "../utils/dateUtils";
import { useDayRecordEditor } from "../hooks/useDayRecordEditor";
import TaskList from "../components/TaskList";
import StarRating from "../components/StarRating";
import DailyNote from "../components/DailyNote";
import QuoteOfTheDay from "../components/QuoteOfTheDay";
import MoodPicker from "../components/MoodPicker";
import MobileBottomSheet from "../components/MobileBottomSheet";
import { getMoodById } from "../data/moods";

type Focus = "yesterday" | "today" | "tomorrow";

function getDateStrForFocus(focus: Focus): string {
  switch (focus) {
    case "yesterday":
      return getYesterdayString();
    case "tomorrow":
      return getTomorrowString();
    default:
      return getTodayString();
  }
}

const NowPage: FC = () => {
  const [focus, setFocus] = useState<Focus>("today");
  const [mobileSheet, setMobileSheet] = useState<"mood" | "rating" | null>(null);
  const activeDateStr = useMemo(() => getDateStrForFocus(focus), [focus]);

  const {
    record,
    loading,
    error,
    addTask,
    toggleTask,
    updateTaskTitle,
    pinTask,
    reorderTasks,
    deleteTask,
    setRating,
    setNote,
    setMood,
    setDailyCheckinDone,
  } = useDayRecordEditor(activeDateStr);

  const isPlanningTomorrow = isFutureDateString(activeDateStr);
  const currentRating = record?.rating ?? null;
  const ratingSummaryLabel = isPlanningTomorrow
    ? "暂不评分"
    : currentRating === null
      ? "未评分"
      : `${currentRating}`;

  const focusCopy = {
    yesterday: {
      eyebrow: "Yesterday review",
      heroTitle: "补充昨天的状态与记录。",
      moodTitle: "昨日状态",
      moodBody: "选择一个最能代表昨天的状态。",
      moodEmptyLabel: "选一个代表昨天的状态吧",
      ratingBody: "给昨天一个自评分，方便之后回看趋势。",
      taskTitle: "昨日任务",
      taskBody: "补充或修改昨天的任务与完成情况。",
      noteTitle: "昨日记录",
      noteBody: "写下昨天的关键进展、感受或复盘。",
      notePlaceholder: "写下昨天值得补充的内容",
      taskEmptyText: "昨天还没有留下任务。可以补上一件已经完成或想复盘的事。",
      footer: "昨天的线索已归位",
      checkinTitle: "昨日打卡",
      checkinBody: "补上昨天是否完成了这一天的核心记录。",
      checkinDone: "昨天已打卡",
      checkinPending: "补上昨天的打卡",
    },
    today: {
      eyebrow: "Today workspace",
      heroTitle: "记录今天的状态与进展。",
      moodTitle: "今日状态",
      moodBody: "选择一个最能代表今天的状态。",
      moodEmptyLabel: "选一个代表今天的状态吧",
      ratingBody: "点击星星给今天打分，可随时修改。",
      taskTitle: "今日任务",
      taskBody: "安排今天的待办，也勾掉已经完成的事。",
      noteTitle: "今日记录",
      noteBody: "沉淀今天的关键进展、感受或复盘。",
      notePlaceholder: "写下今天想留下的内容",
      taskEmptyText: "今天还没有任务。可以先添加一件最想推进的小事。",
      footer: "今天的工作台已就绪",
      checkinTitle: "今日打卡",
      checkinBody: "完成今天的状态、任务或记录后，给这一天按下确认。",
      checkinDone: "今天已打卡",
      checkinPending: "完成今日打卡",
    },
    tomorrow: {
      eyebrow: "Tomorrow plan",
      heroTitle: "提前安排明天的计划。",
      moodTitle: "明日状态",
      moodBody: "选择一个你希望带进明天的状态。",
      moodEmptyLabel: "选一个你希望带进明天的状态吧",
      ratingBody: "明天还没有发生，评分会留到当天再填写。",
      taskTitle: "明日任务",
      taskBody: "提前列好计划，到明天后继续执行。",
      noteTitle: "明日记录",
      noteBody: "先记下明天需要提醒自己的事。",
      notePlaceholder: "写下明天需要提醒自己的事",
      taskEmptyText: "明天还没有计划。可以先放进一件确定要做的事。",
      footer: "明天的入口已轻轻打开",
      checkinTitle: "明日打卡",
      checkinBody: "明天还没有开始，打卡会留到当天再完成。",
      checkinDone: "明天已打卡",
      checkinPending: "明天再打卡",
    },
  }[focus];

  const focusButtonClass = (isActive: boolean): string =>
    `segmented-button min-w-0 flex-1 ${isActive ? "segmented-button-active" : "segmented-button-idle"}`;

  const taskCount = record?.tasks.length ?? 0;
  const completedTaskCount = record?.tasks.filter((task) => task.completed).length ?? 0;
  const selectedMood = getMoodById(record?.moodId ?? null);
  const moodLabel = selectedMood ? selectedMood.label : "未选择";
  const checkinDone = record?.dailyCheckinDone === true;
  const canCheckin = !isPlanningTomorrow;

  return (
    <main className="page-shell">
      <div className="lg:hidden">
        <header className="mobile-workspace-header">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0b8f99]">
                {formatDisplayDate(activeDateStr)}
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-slate-950">
                {focusCopy.taskTitle}
              </h1>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0b8f99] shadow-sm">
              <Sun className="h-6 w-6" aria-hidden />
            </div>
          </div>

          <div
            className="control-shell mt-4 grid grid-cols-3 gap-1"
            role="tablist"
            aria-label="选择昨天、今天或明天"
          >
            {(["yesterday", "today", "tomorrow"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={focus === item}
                className={focusButtonClass(focus === item)}
                onClick={() => setFocus(item)}
              >
                {item === "yesterday" ? "昨天" : item === "today" ? "今天" : "明天"}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="mobile-quick-tile"
              onClick={() => setMobileSheet("mood")}
            >
              <SmilePlus className="h-4 w-4" aria-hidden />
              <span>状态</span>
              <strong className="flex items-center gap-1.5 text-[1.05rem]">
                {selectedMood ? (
                  <span className="text-lg leading-none" role="img" aria-label={selectedMood.label}>
                    {selectedMood.emoji}
                  </span>
                ) : null}
                <span className="min-w-0 truncate">{moodLabel}</span>
              </strong>
            </button>
            <button
              type="button"
              className="mobile-quick-tile"
              onClick={() => setMobileSheet("rating")}
            >
              <Star className="h-4 w-4" aria-hidden />
              <span>评分</span>
              <strong className="flex items-center gap-1.5 text-[1.05rem]">
                {!isPlanningTomorrow && currentRating !== null ? (
                  <span className="text-base leading-none" role="img" aria-label="星星">
                    ⭐
                  </span>
                ) : null}
                <span className="min-w-0 truncate">
                  {!isPlanningTomorrow && currentRating !== null
                    ? `${currentRating}/10`
                    : ratingSummaryLabel}
                </span>
              </strong>
            </button>
          </div>

          <button
            type="button"
            className={`mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition-all duration-300 active:scale-[0.98] ${
              checkinDone
                ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                : canCheckin
                  ? "border-cyan-100 bg-cyan-50/80 text-slate-900"
                  : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
            onClick={() => {
              if (canCheckin) {
                setDailyCheckinDone(!checkinDone);
              }
            }}
            disabled={!canCheckin}
            aria-pressed={checkinDone}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                <CircleCheck className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{focusCopy.checkinTitle}</span>
                <span className="mt-0.5 block text-xs leading-5 opacity-75">
                  {focusCopy.checkinBody}
                </span>
              </span>
            </span>
            <strong className="shrink-0 text-sm font-bold">
              {checkinDone ? focusCopy.checkinDone : focusCopy.checkinPending}
            </strong>
          </button>

          {error !== null ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
          ) : null}
          {loading ? (
            <p className="mt-3 text-sm font-medium text-slate-500">正在读取本地记录...</p>
          ) : null}
        </header>

        <section className="mobile-task-flow mt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">任务流</h2>
              <p className="mt-1 text-sm text-slate-500">
                已完成 {completedTaskCount} / {taskCount} 项
              </p>
            </div>
          </div>
          <TaskList
            tasks={record?.tasks ?? []}
            onAddTask={addTask}
            onToggleTask={toggleTask}
            onUpdateTaskTitle={updateTaskTitle}
            onPinTask={pinTask}
            onReorderTasks={reorderTasks}
            onDeleteTask={deleteTask}
            emptyText={focusCopy.taskEmptyText}
          />
        </section>

        <section className="mobile-note-panel mt-4">
          <div className="mb-4 flex items-start gap-3">
            <div className="icon-tile">
              <NotebookText className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-950">{focusCopy.noteTitle}</h2>
              <p className="mt-1 text-sm leading-5 text-slate-500">{focusCopy.noteBody}</p>
            </div>
          </div>
          <DailyNote
            value={record?.note ?? ""}
            onChange={setNote}
            placeholder={focusCopy.notePlaceholder}
            ariaLabel={focusCopy.noteTitle}
          />
        </section>

        <MobileBottomSheet
          open={mobileSheet === "mood"}
          title={focusCopy.moodTitle}
          description={focusCopy.moodBody}
          onClose={() => setMobileSheet(null)}
        >
          <MoodPicker
            value={record?.moodId ?? null}
            onChange={setMood}
            emptyLabel={focusCopy.moodEmptyLabel}
          />
        </MobileBottomSheet>

        <MobileBottomSheet
          open={mobileSheet === "rating"}
          title="自评"
          description={focusCopy.ratingBody}
          onClose={() => setMobileSheet(null)}
        >
          {isPlanningTomorrow ? (
            <p className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm leading-6 text-slate-600">
              未来日期暂不写入评分；到当天后即可补上自评。
            </p>
          ) : null}
          <div className="mt-3 overflow-visible">
            <StarRating
              value={isPlanningTomorrow ? null : record?.rating ?? null}
              onChange={isPlanningTomorrow ? undefined : setRating}
              readOnly={isPlanningTomorrow}
            />
          </div>
        </MobileBottomSheet>

      </div>

      <div className="hidden lg:block">
      <header className="page-header">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="icon-tile">
              <Sun className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="eyebrow">{focusCopy.eyebrow}</p>
              <h1 className="page-title">当下</h1>
            </div>
          </div>
          <QuoteOfTheDay variant="present" className="mt-3 max-w-2xl" />
          {error !== null && (
            <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
          )}
          {loading && (
            <p className="mt-3 text-sm font-medium text-slate-500">正在读取本地记录...</p>
          )}
        </div>

        <div
          className="control-shell mobile-fit-control flex w-full min-w-0 max-w-md"
          role="tablist"
          aria-label="选择昨天、今天或明天"
        >
          <button
            type="button"
            role="tab"
            aria-selected={focus === "yesterday"}
            className={focusButtonClass(focus === "yesterday")}
            onClick={() => setFocus("yesterday")}
          >
            昨天
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={focus === "today"}
            className={focusButtonClass(focus === "today")}
            onClick={() => setFocus("today")}
          >
            今天
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={focus === "tomorrow"}
            className={focusButtonClass(focus === "tomorrow")}
            onClick={() => setFocus("tomorrow")}
          >
            明天
          </button>
        </div>
      </header>

      <section className="panel panel-glow panel-interactive mt-6 overflow-hidden p-0 sm:p-0">
        <div className="grid min-w-0 max-w-full gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="min-w-0 max-w-full rounded-t-2xl border-b border-cyan-100/80 bg-gradient-to-br from-cyan-50 via-white to-amber-50/70 p-4 text-slate-900 sm:p-6 lg:rounded-l-2xl lg:rounded-tr-none lg:border-b-0 lg:border-r lg:border-cyan-100/80 lg:p-8">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-200/80 bg-white/75 px-3 py-2 text-sm font-semibold text-[#0b8f99] shadow-sm sm:gap-2.5 sm:px-4 sm:text-base">
                <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                {formatDisplayDate(activeDateStr)}
              </div>
              <h2 className="mt-4 max-w-lg text-2xl font-bold leading-tight sm:mt-6 sm:text-4xl">
                {focusCopy.heroTitle}
              </h2>
            </div>
            <div className="mt-5 flex items-center gap-3 text-sm font-medium text-slate-600 sm:mt-8">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-amber-500 shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <span>{focusCopy.footer}</span>
            </div>
            <button
              type="button"
              className={`mt-6 flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left shadow-sm transition-all duration-300 active:scale-[0.98] ${
                checkinDone
                  ? "border-emerald-100 bg-emerald-50/95 text-emerald-800 hover:border-emerald-200"
                  : canCheckin
                    ? "border-cyan-100 bg-white/80 text-slate-900 hover:border-cyan-200 hover:bg-cyan-50"
                    : "border-slate-200 bg-white/60 text-slate-400"
              }`}
              onClick={() => {
                if (canCheckin) {
                  setDailyCheckinDone(!checkinDone);
                }
              }}
              disabled={!canCheckin}
              aria-pressed={checkinDone}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                  <CircleCheck className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-bold">{focusCopy.checkinTitle}</span>
                  <span className="mt-1 block text-sm leading-5 opacity-75">
                    {focusCopy.checkinBody}
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-xl bg-white px-3 py-2 text-sm font-bold shadow-sm">
                {checkinDone ? focusCopy.checkinDone : focusCopy.checkinPending}
              </span>
            </button>
          </div>

          <div className="grid min-w-0 max-w-full gap-5 p-4 sm:gap-6 sm:p-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
            <div>
              <div className="flex items-start gap-3">
                <div className="icon-tile">
                  <SmilePlus className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="section-title">{focusCopy.moodTitle}</h2>
                  <p className="section-copy">{focusCopy.moodBody}</p>
                </div>
              </div>
              <div className="mt-4">
                <MoodPicker
                  value={record?.moodId ?? null}
                  onChange={setMood}
                  emptyLabel={focusCopy.moodEmptyLabel}
                />
              </div>
            </div>

            <div>
              <div className="flex items-start gap-3">
                <div className="icon-tile">
                  <Star className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="section-title">自评</h2>
                  <p className="section-copy">{focusCopy.ratingBody}</p>
                </div>
              </div>
              {isPlanningTomorrow ? (
                <>
                  <p className="mt-4 text-sm leading-6 text-slate-600">
                    未来日期暂不写入评分；到当天后即可补上自评。
                  </p>
                  <div className="mt-4 overflow-visible">
                    <StarRating value={null} readOnly />
                  </div>
                </>
              ) : (
                <div className="mt-4 overflow-visible">
                  <StarRating value={record?.rating ?? null} onChange={setRating} />
                </div>
              )}
              <div className="mobile-fit-control mt-3 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 shadow-inner">
                <span className="text-sm font-medium text-slate-600">当前分数</span>
                <span className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold leading-none text-slate-950">
                    {ratingSummaryLabel}
                  </span>
                  {!isPlanningTomorrow && currentRating !== null && (
                    <span className="text-sm font-semibold text-slate-500">/ 10</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className="panel panel-glow-cool panel-interactive h-full">
          <div className="flex items-start gap-3">
            <div className="icon-tile">
              <ListChecks className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="section-title">{focusCopy.taskTitle}</h2>
              <p className="section-copy">{focusCopy.taskBody}</p>
            </div>
          </div>
          <div className="mt-5">
            <TaskList
              tasks={record?.tasks ?? []}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onUpdateTaskTitle={updateTaskTitle}
              onPinTask={pinTask}
              onReorderTasks={reorderTasks}
              onDeleteTask={deleteTask}
              emptyText={focusCopy.taskEmptyText}
            />
          </div>
        </section>

        <section className="panel panel-glow-warm panel-interactive h-full">
          <div className="flex items-start gap-3">
            <div className="icon-tile">
              <NotebookText className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="section-title">{focusCopy.noteTitle}</h2>
              <p className="section-copy">{focusCopy.noteBody}</p>
            </div>
          </div>
          <div className="mt-5">
            <DailyNote
              value={record?.note ?? ""}
              onChange={setNote}
              placeholder={focusCopy.notePlaceholder}
              ariaLabel={focusCopy.noteTitle}
            />
          </div>
        </section>
      </div>
      </div>
    </main>
  );
};

export default NowPage;
