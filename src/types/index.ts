/**
 * MyDay 核心数据类型（与 .cursorrules 中的数据模型一致）
 * 类比 Python：相当于在 types.py 里用 TypedDict 或 dataclass 描述数据结构。
 */

/** 单个任务 */
export interface Task {
  /** 唯一标识，使用 crypto.randomUUID() 生成 */
  id: string;
  /** 任务标题 */
  title: string;
  /** 是否完成 */
  completed: boolean;
  /** 创建时间的 ISO 字符串 */
  createdAt: string;
  /** 从哪一天自动结转而来；普通手动任务为空 */
  carryoverFromDate?: string;
  /** 从哪条任务自动结转而来；用于避免重复结转 */
  carryoverFromTaskId?: string;
}

/** 单个每日打卡项目 */
export interface DailyCheckin {
  /** 唯一标识，使用 crypto.randomUUID() 生成 */
  id: string;
  /** 打卡内容，如“学英语” */
  title: string;
  /** 当天是否完成 */
  completed: boolean;
  /** 创建时间的 ISO 字符串 */
  createdAt: string;
}

/** 会自动出现在每天记录里的打卡模板 */
export interface DailyCheckinTemplate {
  /** 唯一标识，同时作为每日打卡项目 id */
  id: string;
  /** 打卡内容，如“学英语” */
  title: string;
  /** 从哪一天开始每天出现 */
  startDate: string;
  /** 创建时间的 ISO 字符串 */
  createdAt: string;
}

/** 每日记录（以 date 为主键的一条「当天快照」） */
export interface DayRecord {
  /** 日期字符串，格式为 "YYYY-MM-DD"，作为唯一主键 */
  date: string;
  /** 当天的任务列表 */
  tasks: Task[];
  /** 已经执行过自动结转检查的来源日期，避免删除结转任务后再次出现 */
  carryoverCheckedDates?: string[];
  /** 自评分数 1～10（与 StarRating 一致），未评分时为 null */
  rating: number | null;
  /** 今日记录（备注），可为空字符串 */
  note: string;
  /** 当日状态 emoji 的 id（对应 MOOD_OPTIONS 中的某项），未选择时为 null */
  moodId: string | null;
  /** 当日是否完成打卡 */
  dailyCheckinDone: boolean;
  /** 当天的自定义打卡项目 */
  dailyCheckins: DailyCheckin[];
}

/**
 * 一个可选的「每日状态 emoji」选项。
 * MoodPicker 组件遍历所有选项，让用户从中选择一个代表当天状态的 emoji。
 */
export interface MoodOption {
  /** 唯一标识，存入 DayRecord.moodId */
  id: string;
  /** 显示的 emoji 字符 */
  emoji: string;
  /** 鼠标悬停时显示的文字描述 */
  label: string;
}

/** 页面引言一条：正文 + 署名（「当下」「历史」页按日轮换展示） */
export interface QuoteEntry {
  text: string;
  author: string;
}
