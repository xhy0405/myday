import { type FC, type KeyboardEventHandler, useState } from "react";
import { Check, Edit3, Inbox, Plus, Save, Trash2, X } from "lucide-react";
import type { DailyCheckin } from "../types";

export interface DailyCheckinListProps {
  items: DailyCheckin[];
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  emptyText?: string;
  inputPlaceholder?: string;
  completionReadOnly?: boolean;
}

const DailyCheckinList: FC<DailyCheckinListProps> = ({
  items,
  onAdd,
  onToggle,
  onUpdateTitle,
  onDelete,
  emptyText = "还没有打卡内容。可以先添加一项，比如：学英语。",
  inputPlaceholder = "添加打卡内容，如：学英语",
  completionReadOnly = false,
}) => {
  const [newTitle, setNewTitle] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  const handleAdd = (): void => {
    const title = newTitle.trim();
    if (title === "") {
      return;
    }
    onAdd(title);
    setNewTitle("");
  };

  const handleAddKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAdd();
    }
  };

  const startEditing = (item: DailyCheckin): void => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const cancelEditing = (): void => {
    setEditingId(null);
    setEditingTitle("");
  };

  const saveEditing = (): void => {
    if (editingId === null) {
      return;
    }
    const title = editingTitle.trim();
    if (title !== "") {
      onUpdateTitle(editingId, title);
    }
    cancelEditing();
  };

  const handleEditKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      saveEditing();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  const completedCount = items.filter((item) => item.completed).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder={inputPlaceholder}
          className="input-field min-w-0 flex-1"
          aria-label="新打卡内容"
        />
        <button type="button" onClick={handleAdd} className="btn-primary w-full sm:w-auto">
          <Plus className="h-5 w-5 shrink-0" aria-hidden />
          添加
        </button>
      </div>

      {items.length === 0 ? (
        <div className="panel-muted flex flex-col items-center justify-center gap-4 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#10aab2] shadow-sm">
            <Inbox className="h-8 w-8" strokeWidth={1.25} aria-hidden />
          </div>
          <p className="task-empty-copy">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm">
            <span className="font-semibold text-emerald-800">今日打卡进度</span>
            <span className="font-bold text-emerald-900">
              {completedCount} / {items.length}
            </span>
          </div>

          <ul className="flex flex-col gap-3">
            {items.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <li key={item.id} className="soft-list-item">
                  <div className="flex min-h-14 items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ${
                        item.completed
                          ? "border-emerald-200 bg-emerald-500 text-white"
                          : completionReadOnly
                            ? "border-slate-200 bg-slate-50 text-slate-300"
                            : "border-slate-200 bg-white text-slate-400 hover:border-emerald-200 hover:text-emerald-600"
                      }`}
                      onClick={() => onToggle(item.id)}
                      disabled={completionReadOnly}
                      aria-label={item.completed ? `取消完成 ${item.title}` : `完成 ${item.title}`}
                      aria-pressed={item.completed}
                    >
                      <Check className="h-5 w-5" aria-hidden />
                    </button>

                    {isEditing ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="task-edit-input"
                        aria-label="编辑打卡内容"
                        autoFocus
                      />
                    ) : (
                      <span
                        className={`min-w-0 flex-1 text-base leading-relaxed ${
                          item.completed ? "text-slate-400 line-through" : "text-slate-900"
                        }`}
                      >
                        {item.title}
                      </span>
                    )}

                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="task-icon-action text-[#0b8f99] hover:bg-cyan-50 focus:ring-cyan-400"
                          onClick={saveEditing}
                          aria-label="保存打卡内容"
                        >
                          <Save className="h-5 w-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="task-icon-action text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:ring-slate-300"
                          onClick={cancelEditing}
                          aria-label="取消编辑"
                        >
                          <X className="h-5 w-5" aria-hidden />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="task-icon-action text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:ring-slate-300"
                          onClick={() => startEditing(item)}
                          aria-label={`编辑 ${item.title}`}
                        >
                          <Edit3 className="h-5 w-5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="task-icon-action text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:ring-rose-300"
                          onClick={() => onDelete(item.id)}
                          aria-label={`删除 ${item.title}`}
                        >
                          <Trash2 className="h-5 w-5" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DailyCheckinList;
