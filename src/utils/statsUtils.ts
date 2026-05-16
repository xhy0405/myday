import type { DayRecord } from "../types";
import { addCalendarDays, getTodayString } from "./dateUtils";

/**
 * 「打卡」判定：以当下页独立打卡按钮为准，避免任务或备注被误算为打卡。
 */
export function isCheckinRecord(record: DayRecord): boolean {
  return record.dailyCheckinDone === true || record.dailyCheckins.some((item) => item.completed);
}

/**
 * 判断 next 是否为 prev 的日历下一天（按本地时区解析 YYYY-MM-DD）。
 */
function isConsecutiveCalendarDays(prev: string, next: string): boolean {
  const [y1, m1, d1] = prev.split("-").map(Number);
  const [y2, m2, d2] = next.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1);
  const b = new Date(y2, m2 - 1, d2);
  const diffMs = b.getTime() - a.getTime();
  const diffDays = Math.round(diffMs / 86400000);
  return diffDays === 1;
}

/**
 * 在所有本地记录中，计算「打卡日」最长连续日历天数（全局，不限最近 30 天）。
 * 若无任何打卡日，返回 0；单日打卡返回 1。
 */
export function computeLongestCheckinStreak(all: Record<string, DayRecord>): number {
  const dates = Object.keys(all).filter((ds) => {
    const r = all[ds];
    return r !== undefined && isCheckinRecord(r);
  });
  if (dates.length === 0) {
    return 0;
  }
  dates.sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < dates.length; i++) {
    if (isConsecutiveCalendarDays(dates[i - 1], dates[i])) {
      cur += 1;
    } else {
      cur = 1;
    }
    if (cur > best) {
      best = cur;
    }
  }
  return best;
}

/**
 * 从今天往前计算当前连续打卡天数。
 */
export function computeCurrentCheckinStreak(all: Record<string, DayRecord>): number {
  let cursor = getTodayString();
  let streak = 0;

  while (true) {
    const record = all[cursor];
    if (record === undefined || !isCheckinRecord(record)) {
      return streak;
    }
    streak += 1;
    cursor = addCalendarDays(cursor, -1);
  }
}
