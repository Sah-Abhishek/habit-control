import Link from "next/link";
import { Card, Label } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { CheckInCard, type CheckInValues } from "@/components/today/check-in-card";
import { formatLocalDate } from "@/domain/dates";
import { scoreBand } from "@/domain/day-score";
import { formatClock, formatDuration } from "@/domain/format";
import type { DayAggregate } from "@/server/services/today";

export type DetailSession = { id: string; title: string; seconds: number; focus: number | null; time: string };

const FOCUS = ["", "Poor", "Low", "Okay", "Good", "Deep"];
const HEADLINE = { none: "Nothing logged", light: "A lighter day", medium: "A steady day", full: "A full day" } as const;

function Kv({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-[14px] bg-sunken p-3">
      <Label>{k}</Label>
      <p className={`mt-0.5 font-mono text-[16px] font-medium ${tone ?? ""}`}>{v}</p>
    </div>
  );
}

export function DayDetail({ agg, sessions, checkIn, editHref, closeHref, editing, focusLabel }: { agg: DayAggregate; sessions: DetailSession[]; checkIn: CheckInValues; editHref: string; closeHref: string; editing: boolean; focusLabel: string | null }) {
  if (agg.isFuture) {
    return (
      <Card>
        <Label className="text-ochre">{formatLocalDate(agg.date, "EEE · d MMM")}</Label>
        <p className="mt-1 font-serif text-2xl">Still ahead</p>
        <p className="mt-1 text-[13.5px] text-muted">Plan tasks for this day from Tasks; the rest fills in as it happens.</p>
      </Card>
    );
  }
  const d = agg.day;
  const sleep = checkIn.sleepMinutes != null ? formatClock(checkIn.sleepMinutes * 60) : "—";
  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={closeHref} scroll={false} className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-muted hover:text-ink">
          <Icon name="back" size={16} /> Done editing
        </Link>
        <CheckInCard values={checkIn} date={agg.date} title={`Check-in · ${formatLocalDate(agg.date, "d MMM")}`} />
      </div>
    );
  }
  return (
    <Card className="flex flex-col gap-4">
      <header className="flex items-start gap-3">
        <div className="flex-1">
          <Label className="text-ochre">{formatLocalDate(agg.date, "EEE · d MMM")}</Label>
          <h2 className="mt-1 font-serif text-2xl">{HEADLINE[scoreBand(agg.score)]}</h2>
        </div>
        <Link href={editHref} scroll={false} className="rounded-xl border border-line px-3 py-1.5 text-[13px] font-semibold hover:bg-sunken">
          Edit check-in
        </Link>
      </header>
      <div className="grid grid-cols-3 gap-2">
        <Kv k="Study" v={formatClock(agg.studySeconds)} tone="text-ochre" />
        <Kv k="Habits" v={agg.habitsScheduled ? `${agg.habitsSucceeded}/${agg.habitsScheduled}` : "—"} tone="text-moss" />
        <Kv k="Tasks" v={agg.tasksDue || agg.tasksCompleted ? `${agg.tasksCompleted}/${Math.max(agg.tasksDue, agg.tasksCompleted)}` : "—"} />
        <Kv k="Sleep" v={sleep} tone="text-dusk" />
        <Kv k="Mood" v={d?.mood?.toString() ?? "—"} />
        <Kv k="Energy" v={d?.energy?.toString() ?? "—"} />
      </div>
      {focusLabel ? (
        <p className="text-[13.5px]">
          <Label>Focus</Label> <span className="ml-1">{focusLabel}</span>
        </p>
      ) : null}
      {sessions.length ? (
        <section>
          <Label>Sessions</Label>
          <ul className="mt-1 divide-y divide-hair">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 text-[13.5px]">
                <span className="w-12 font-mono text-[12px] text-muted">{s.time}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.title}</span>
                {s.focus ? <span className="text-[12px] text-muted">{FOCUS[s.focus]}</span> : null}
                <span className="font-mono text-[12.5px]">{formatDuration(s.seconds)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {agg.habitsDone.length ? (
        <section>
          <Label>On track</Label>
          <p className="mt-1 text-[13.5px] text-muted">{agg.habitsDone.join(" · ")}</p>
        </section>
      ) : null}
      {agg.completedTaskTitles.length ? (
        <section>
          <Label>Completed</Label>
          <ul className="mt-1 flex flex-col gap-1 text-[13.5px] text-muted">
            {agg.completedTaskTitles.map((t, i) => (
              <li key={i} className="flex items-center gap-2">
                <Icon name="check" size={14} className="text-moss" /> {t}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {d?.note ? <p className="rounded-[14px] bg-sunken p-3 font-serif text-[17px] italic text-muted">“{d.note}”</p> : null}
      {scoreBand(agg.score) === "none" && !d ? <p className="text-[13px] text-muted">Nothing was logged this day. You can still add a check-in.</p> : null}
    </Card>
  );
}
