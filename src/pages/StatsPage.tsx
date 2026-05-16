import { type FC, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarCheck, CircleCheck, Flame, LineChart } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getAllRecords } from "../data/storage";
import type { DayRecord } from "../types";
import {
  formatShortAxisDate,
  getDateStringsEndingTodayInclusive,
} from "../utils/dateUtils";
import { computeCurrentCheckinStreak, computeLongestCheckinStreak } from "../utils/statsUtils";
import QuoteOfTheDay from "../components/QuoteOfTheDay";
import DataBackupControls from "../components/DataBackupControls";

/** 可选统计区间：天数为从今天往前含今天在内的连续日历天 */
type StatsRangeId = "week" | "d30" | "halfyear" | "year";

const RANGE_OPTIONS: readonly { id: StatsRangeId; label: string; days: number }[] = [
  { id: "week", label: "近1周", days: 7 },
  { id: "d30", label: "近30日", days: 30 },
  /** 近半年：按 180 天计（约六个月） */
  { id: "halfyear", label: "近半年", days: 180 },
  /** 近一年：按 365 天计 */
  { id: "year", label: "近一年", days: 365 },
];

/** 图表中每一行对应一天的数据点 */
interface DailyChartRow {
  /** 原始日期，用于 Tooltip */
  date: string;
  /** 横轴短标签 */
  label: string;
  /** 当日评分，未评则为 null（折线断点） */
  rating: number | null;
  /** 任务完成率 0～100；无任务时为 0（柱高为 0） */
  completionRate: number;
  /** 当日完成的打卡项目数 */
  checkinCount: number;
}

/**
 * 根据数据点数量控制 X 轴刻度密度，避免近一年时标签重叠。
 */
function getXAxisInterval(pointCount: number): number {
  if (pointCount <= 10) {
    return 0;
  }
  if (pointCount <= 35) {
    return 4;
  }
  return Math.max(1, Math.floor(pointCount / 12));
}

/**
 * 统计页：可选时间范围的评分面积图、完成率柱状图，以及区间内的平均评分与完成任务数；最长连续打卡仍为全历史。
 * 宽屏(lg)下两张图表并排显示；顶部三张指标卡为「图标+标题 / 大号数值+单位 / 说明」结构。
 */
const StatsPage: FC = () => {
  const [rangeId, setRangeId] = useState<StatsRangeId>("d30");
  const [mobileChart, setMobileChart] = useState<"rating" | "completion" | "checkin">("rating");
  const [mobileBackupOpen, setMobileBackupOpen] = useState<boolean>(false);
  const [dataRevision, setDataRevision] = useState<number>(0);
  const [allRecords, setAllRecords] = useState<Record<string, DayRecord>>({});
  const [dataError, setDataError] = useState<string | null>(null);
  const selectedOption = RANGE_OPTIONS.find((o) => o.id === rangeId) ?? RANGE_OPTIONS[1];
  const rangeDays = selectedOption.days;
  const rangeLabel = selectedOption.label;

  const datesWindow = useMemo(
    () => getDateStringsEndingTodayInclusive(rangeDays),
    [rangeDays],
  );

  const xAxisInterval = useMemo(
    () => getXAxisInterval(datesWindow.length),
    [datesWindow.length],
  );

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
          setDataError("读取统计数据失败，请刷新后重试。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dataRevision]);

  /** 一次读 localStorage 并派生图表数据与汇总，避免 getAllRecords 引用每次变化导致 memo 失效 */
  const {
    chartRows,
    averageRating,
    totalCompletedTasks,
    checkinDays,
    checkinRate,
    totalCompletedCheckins,
    currentStreak,
    longestStreak,
  } =
    useMemo(() => {
      const rows: DailyChartRow[] = datesWindow.map((ds) => {
        const r = allRecords[ds];
        const label = formatShortAxisDate(ds);
        if (r === undefined) {
          return {
            date: ds,
            label,
            rating: null,
            completionRate: 0,
            checkinCount: 0,
          };
        }
        const total = r.tasks.length;
        const completed = r.tasks.filter((t) => t.completed).length;
        const completedCheckins = r.dailyCheckins.filter((item) => item.completed).length;
        const completionRate =
          total === 0 ? 0 : Math.round((completed / total) * 100);
        return {
          date: ds,
          label,
          rating: r.rating,
          completionRate,
          checkinCount: completedCheckins,
        };
      });

      let ratingSum = 0;
      let ratingCount = 0;
      let completedTotal = 0;
      let checkinTotal = 0;
      let completedCheckinTotal = 0;

      for (const ds of datesWindow) {
        const r = allRecords[ds];
        if (r === undefined) {
          continue;
        }
        if (r.rating !== null) {
          ratingSum += r.rating;
          ratingCount += 1;
        }
        completedTotal += r.tasks.filter((t) => t.completed).length;
        const completedCheckins = r.dailyCheckins.filter((item) => item.completed).length;
        completedCheckinTotal += completedCheckins;
        if (completedCheckins > 0 || r.dailyCheckinDone) {
          checkinTotal += 1;
        }
      }

      const averageRating =
        ratingCount === 0
          ? null
          : Math.round((ratingSum / ratingCount) * 10) / 10;

      return {
        chartRows: rows,
        averageRating,
        totalCompletedTasks: completedTotal,
        checkinDays: checkinTotal,
        checkinRate: datesWindow.length === 0 ? 0 : Math.round((checkinTotal / datesWindow.length) * 100),
        totalCompletedCheckins: completedCheckinTotal,
        currentStreak: computeCurrentCheckinStreak(allRecords),
        longestStreak: computeLongestCheckinStreak(allRecords),
      };
    }, [allRecords, datesWindow]);

  /** Recharts Tooltip 统一样式（边框与页面卡片一致，偏浅） */
  const tooltipStyle = {
    borderRadius: "1rem",
    border: "1px solid #e2e8f0",
    fontSize: "12px",
    boxShadow: "0 18px 45px rgb(15 23 42 / 0.12)",
  };

  /** 评分面积图下方渐变填充：与折线同色、上实下透明（SVG linearGradient，非 Tailwind 任意值） */
  const ratingAreaGradientId = "statsRatingAreaGradient";

  return (
    <main className="page-shell">
      <div className="lg:hidden">
        <header className="mobile-workspace-header">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0b8f99]">
                Performance view
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">数据统计</h1>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0b8f99] shadow-sm">
              <BarChart3 className="h-6 w-6" aria-hidden />
            </div>
          </div>
          {dataError !== null && (
            <p className="mt-3 text-sm font-medium text-rose-600">{dataError}</p>
          )}
          <div
            className="control-shell mt-4 grid grid-cols-2 gap-1"
            role="group"
            aria-label="统计时间范围"
          >
            {RANGE_OPTIONS.map((opt) => {
              const isActive = rangeId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRangeId(opt.id)}
                  className={`segmented-button w-full ${
                    isActive ? "segmented-button-active" : "segmented-button-idle"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </header>

        <section className="mt-4 grid grid-cols-4 gap-2">
          <div className="mobile-metric-tile">
            <LineChart className="h-4 w-4 text-[#10aab2]" aria-hidden />
            <span>平均</span>
            <strong>{averageRating === null ? "—" : averageRating}</strong>
          </div>
          <div className="mobile-metric-tile">
            <CalendarCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            <span>打卡</span>
            <strong>{totalCompletedCheckins}</strong>
          </div>
          <div className="mobile-metric-tile">
            <CircleCheck className="h-4 w-4 text-emerald-600" aria-hidden />
            <span>完成</span>
            <strong>{totalCompletedTasks}</strong>
          </div>
          <div className="mobile-metric-tile">
            <Flame className="h-4 w-4 text-amber-600" aria-hidden />
            <span>连续</span>
            <strong>{currentStreak}</strong>
          </div>
        </section>

        <section className="panel panel-glow-cool mt-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {mobileChart === "rating"
                  ? "每日评分趋势"
                  : mobileChart === "completion"
                    ? "每日任务完成率"
                    : "每日打卡记录"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{rangeLabel}</p>
            </div>
          </div>
          <div className="control-shell mb-4 grid grid-cols-3 gap-1">
            <button
              type="button"
              className={`segmented-button ${
                mobileChart === "rating" ? "segmented-button-active" : "segmented-button-idle"
              }`}
              onClick={() => setMobileChart("rating")}
            >
              评分
            </button>
            <button
              type="button"
              className={`segmented-button ${
                mobileChart === "completion" ? "segmented-button-active" : "segmented-button-idle"
              }`}
              onClick={() => setMobileChart("completion")}
            >
              完成率
            </button>
            <button
              type="button"
              className={`segmented-button ${
                mobileChart === "checkin" ? "segmented-button-active" : "segmented-button-idle"
              }`}
              onClick={() => setMobileChart("checkin")}
            >
              打卡
            </button>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {mobileChart === "rating" ? (
                <AreaChart data={chartRows} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`${ratingAreaGradientId}Mobile`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2fc8c0" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="#2fc8c0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval={xAxisInterval} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "#64748b" }} width={28} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => {
                      if (value == null || value === "") {
                        return ["无评分", "评分"];
                      }
                      return [`${String(value)} 分`, "评分"];
                    }}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as DailyChartRow | undefined;
                      return row ? `日期 ${row.date}` : "";
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rating"
                    stroke="#0aa7ad"
                    strokeWidth={2}
                    fill={`url(#${ratingAreaGradientId}Mobile)`}
                    dot={false}
                    activeDot={{ r: 5, fill: "#0aa7ad", stroke: "#fff", strokeWidth: 2 }}
                    connectNulls={false}
                  />
                </AreaChart>
              ) : mobileChart === "completion" ? (
                <BarChart data={chartRows} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval={xAxisInterval} />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    width={32}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${String(value)}%`, "完成率"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as DailyChartRow | undefined;
                      return row ? `日期 ${row.date}` : "";
                    }}
                  />
                  <Bar dataKey="completionRate" fill="#2fc8c0" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={chartRows} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} interval={xAxisInterval} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${String(value)} 项`, "完成打卡"]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as DailyChartRow | undefined;
                      return row ? `日期 ${row.date}` : "";
                    }}
                  />
                  <Bar dataKey="checkinCount" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel panel-glow-warm mt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setMobileBackupOpen((open) => !open)}
            aria-expanded={mobileBackupOpen}
          >
            <span>
              <span className="block text-base font-semibold text-slate-950">本地数据备份</span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                手机、电脑各自本地保存，可用 JSON 手动迁移。
              </span>
            </span>
            <span className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-[#0b8f99]">
              {mobileBackupOpen ? "收起" : "打开"}
            </span>
          </button>
          {mobileBackupOpen ? (
            <div className="mt-4">
              <DataBackupControls onImported={() => setDataRevision((prev) => prev + 1)} />
            </div>
          ) : null}
        </section>
      </div>

      <div className="hidden lg:block">
      <header className="page-header">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="icon-tile">
              <BarChart3 className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="eyebrow">Performance view</p>
              <h1 className="page-title">数据统计</h1>
            </div>
          </div>
          <QuoteOfTheDay variant="stats" className="mt-3 max-w-3xl" />
          {dataError !== null && (
            <p className="mt-3 text-sm font-medium text-rose-600">{dataError}</p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:items-end">
          {/* 时间范围选择器：白底药丸按钮 */}
          <div
            className="control-shell grid w-full grid-cols-2 gap-1 sm:flex sm:flex-wrap"
            role="group"
            aria-label="统计时间范围"
          >
            {RANGE_OPTIONS.map((opt) => {
              const isActive = rangeId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRangeId(opt.id)}
                  className={`segmented-button w-full sm:w-auto ${
                    isActive
                      ? "segmented-button-active"
                      : "segmented-button-idle"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <DataBackupControls onImported={() => setDataRevision((prev) => prev + 1)} />
        </div>
      </header>

      {/* 指标卡：首行图标盒+标题，主数字深色、单位浅色同基线，末行说明小字 */}
      <section className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div className="metric-card panel-glow-cool">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50"
              aria-hidden
            >
              <LineChart className="h-5 w-5 text-[#10aab2]" />
            </div>
            <p className="text-sm font-semibold text-slate-600">平均评分</p>
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-slate-950">
              {averageRating === null ? "—" : String(averageRating)}
            </span>
            {averageRating !== null ? (
              <span className="text-lg font-medium text-slate-400">分</span>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-400">{rangeLabel}内有评分的日期</p>
        </div>

        <div className="metric-card panel-glow-cool">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50"
              aria-hidden
            >
              <CalendarCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-600">打卡天数</p>
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-slate-950">
              {checkinDays}
            </span>
            <span className="text-lg font-medium text-slate-400">天</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">
            {rangeLabel}打卡率 {checkinRate}%，共完成 {totalCompletedCheckins} 项
          </p>
        </div>

        <div className="metric-card panel-glow">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50"
              aria-hidden
            >
              <CircleCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-slate-600">完成任务总数</p>
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-slate-950">
              {totalCompletedTasks}
            </span>
            <span className="text-lg font-medium text-slate-400">项</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">{rangeLabel}累计勾选完成</p>
        </div>

        <div className="metric-card panel-glow-warm">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50"
              aria-hidden
            >
              <Flame className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-sm font-semibold text-slate-600">当前连续打卡</p>
          </div>
          <div className="mt-5 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-slate-950">
              {currentStreak}
            </span>
            <span className="text-lg font-medium text-slate-400">天</span>
          </div>
          <p className="mt-3 text-sm text-slate-400">历史最长 {longestStreak} 天</p>
        </div>
      </section>

      {/* 宽屏图表：评分折线 + 完成率柱状图 + 打卡柱状图 */}
      <div className="mt-6 flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:gap-6">
        <section className="panel panel-glow-cool panel-interactive">
          <h2 className="section-title">
            {rangeLabel} · 每日评分趋势
          </h2>
          <div className="mt-6 h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={ratingAreaGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2fc8c0" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="#2fc8c0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                {/* 仅水平虚线网格，浅色与需求文档一致 */}
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={xAxisInterval}
                />
                <YAxis
                  domain={[0, 10]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  width={28}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => {
                    if (value == null || value === "") {
                      return ["无评分", "评分"];
                    }
                    return [`${String(value)} 分`, "评分"];
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as DailyChartRow | undefined;
                    return row ? `日期 ${row.date}` : "";
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rating"
                  stroke="#0aa7ad"
                  strokeWidth={2}
                  fill={`url(#${ratingAreaGradientId})`}
                  dot={false}
                  activeDot={{ r: 5, fill: "#0aa7ad", stroke: "#fff", strokeWidth: 2 }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel panel-glow-warm panel-interactive">
          <h2 className="section-title">
            {rangeLabel} · 每日任务完成率
          </h2>
          <div className="mt-6 h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={xAxisInterval}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  width={32}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${String(value)}%`, "完成率"]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as DailyChartRow | undefined;
                    return row ? `日期 ${row.date}` : "";
                  }}
                />
                {/* 柱状图与主色统一，避免高饱和绿 */}
                <Bar dataKey="completionRate" fill="#2fc8c0" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel panel-glow-cool panel-interactive lg:col-span-2">
          <h2 className="section-title">
            {rangeLabel} · 每日完成打卡项目
          </h2>
          <div className="mt-6 h-64 w-full sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={xAxisInterval}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  width={48}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${String(value)} 项`, "完成打卡"]}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as DailyChartRow | undefined;
                    return row ? `日期 ${row.date}` : "";
                  }}
                />
                <Bar dataKey="checkinCount" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      </div>
    </main>
  );
};

export default StatsPage;
