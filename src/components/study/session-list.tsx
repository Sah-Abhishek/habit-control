import Link from "next/link";
import { formatLocalDate } from "@/domain/dates";
import { formatClock } from "@/domain/format";
import { FOCUS_LABELS, METHOD_LABELS, type FocusLevel, type StudyMethod } from "@/domain/study";

export type SessionListItem = {
  id: string;
  localDate: string;
  durationSeconds: number | null;
  method: StudyMethod | null;
  focus: number | null;
  questionsAttempted: number | null;
  questionsCorrect: number | null;
  subjectName: string | null;
  topicName: string | null;
};

export function SessionList({ sessions, today, showSubject = true }: { sessions: SessionListItem[]; today: string; showSubject?: boolean }) {
  return (
    <ul className="divide-y divide-hair">
      {sessions.map((s) => {
        const title = [s.method ? METHOD_LABELS[s.method] : null, showSubject ? s.subjectName : null, s.topicName].filter(Boolean).join(" · ") || "Study session";
        return (
          <li key={s.id}>
            <Link href={`/study/sessions/${s.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-sunken">
              <span className="w-14 shrink-0 font-mono text-[12px] text-muted">{s.localDate === today ? "Today" : formatLocalDate(s.localDate, "EEE d")}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{title}</span>
                <span className="block text-[12px] text-faint">{s.focus ? `Focus: ${FOCUS_LABELS[s.focus as FocusLevel]}` : "Focus not rated"}</span>
              </span>
              <span className="font-mono text-[13px] font-medium">{formatClock(s.durationSeconds ?? 0)}</span>
              <span className="w-12 text-right font-mono text-[12px] text-moss">{s.questionsAttempted ? `${s.questionsCorrect ?? 0}/${s.questionsAttempted}` : "—"}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
