import "server-only";
import type { LocalDate } from "@/domain/dates";
import type { TaskPickerOptions, TaskRowData } from "@/server/services/tasks";

export function taskRowDto(t: TaskRowData, today: LocalDate) {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    dueDate: t.dueDate,
    priority: t.priority,
    estimateMinutes: t.estimateMinutes,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    goalId: t.goalId,
    goalTitle: t.goalTitle,
    subjectId: t.subjectId,
    subjectName: t.subjectName,
    topicId: t.topicId,
    topicName: t.topicName,
    overdue: !t.completed && t.dueDate != null && t.dueDate < today,
  };
}

export function taskOptionsDto(o: TaskPickerOptions) {
  return {
    goals: o.goals,
    subjects: o.subjects.map((s) => ({ id: s.id, name: s.name })),
    topics: o.subjects.flatMap((s) => s.topics.map((t) => ({ id: t.id, name: t.name, subjectId: s.id }))),
  };
}
