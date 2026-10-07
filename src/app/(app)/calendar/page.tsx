import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { CalendarLegend, DayCell, describeDay } from "@/components/calendar/day-cell";
import { DayDetail, type DetailSession } from "@/components/calendar/day-detail";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { addLocalDays, diffLocalDays, formatLocalDate, hourOfDayIn, isLocalDate, startOfWeek, type LocalDate } from "@/domain/dates";
import { formatClock } from "@/domain/format";
import { cn } from "@/lib/cn";
import { requireUser } from "@/server/auth/session";
import { getToday } from "@/server/services/settings";
import { listSessionsInRange } from "@/server/services/study";
import { accountStartDate, aggregateDays, focusLabelFor, toCheckInValues, type DayAggregate } from "@/server/services/today";

export const metadata: Metadata = { title: "Calendar" };

type View = "month" | "week";
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseMonth(value: string | undefined, fallback: LocalDate): LocalDate {
  if (value && /^\d{4}-\d{2}$/.test(value) && isLocalDate(`${value}-01`)) return `${value}-01`;
  return `${fallback.slice(0, 7)}-01`;
}

function monthEnd(firstDay: LocalDate): LocalDate {
  const [y, m] = firstDay.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return addLocalDays(next, -1);
}

function shiftMonth(firstDay: LocalDate, delta: number): string {
  const [y, m] = firstDay.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function href(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  const s = q.toString();
  return s ? `/calendar?${s}` : "/calendar";
}

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const user = await requireUser();
  const { today, settings } = await getToday(user.id);
  const sp = await searchParams;
  const view: View = first(sp.view) === "week" ? "week" : "month";
  const rawDate = first(sp.date);
  const selected = rawDate && isLocalDate(rawDate) ? rawDate : undefined;
  const editing = first(sp.edit) === "1";
  const tz = settings.timezone;
  const wso = settings.weekStartsOn;

  let rangeStart: LocalDate;
  let rangeEnd: LocalDate;
  let monthFirst: LocalDate;
  if (view === "week") {
    rangeStart = startOfWeek(selected ?? today, wso);
    rangeEnd = addLocalDays(rangeStart, 6);
    monthFirst = `${rangeStart.slice(0, 7)}-01`;
  } else {
    monthFirst = parseMonth(first(sp.month) ?? selected?.slice(0, 7), today);
    rangeStart = startOfWeek(monthFirst, wso);
    rangeEnd = addLocalDays(startOfWeek(monthEnd(monthFirst), wso), 6);
  }

  const accountStart = await accountStartDate(user.id, tz);
  const aggs = await aggregateDays(user.id, rangeStart, rangeEnd, { today, timeZone: tz, studyTargetMin: settings.dailyStudyTargetMin, accountCreated: accountStart });
  const byDate = new Map(aggs.map((a) => [a.date, a]));

  // Default the detail panel to today when it's visible.
  const detailDate = selected ?? (diffLocalDays(today, rangeStart) >= 0 && diffLocalDays(rangeEnd, today) >= 0 ? today : undefined);
  const detailAgg = detailDate ? (byDate.get(detailDate) ?? (await aggregateDays(user.id, detailDate, detailDate, { today, timeZone: tz, studyTargetMin: settings.dailyStudyTargetMin, accountCreated: accountStart }))[0]) : undefined;
  const [sessions, focusLabel] = detailAgg ? await Promise.all([listSessionsInRange(user.id, detailAgg.date, detailAgg.date), focusLabelFor(user.id, detailAgg.day)]) : [[], null];
  const detailSessions: DetailSession[] = sessions.map((s) => {
    const h = hourOfDayIn(tz, s.startedAt);
    return {
      id: s.id,
      title: [s.subjectName, s.topicName].filter(Boolean).join(" · ") || "Study session",
      seconds: s.durationSeconds ?? 0,
      focus: s.focus,
      time: `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`,
    };
  });

  const baseParams = view === "week" ? { view: "week" } : { month: monthFirst.slice(0, 7) };
  const dayHref = (d: LocalDate) => href({ ...baseParams, date: d });
  const weekdayOrder = Array.from({ length: 7 }, (_, i) => WEEKDAY[(wso + i) % 7]);

  const prevHref = view === "week" ? href({ view: "week", date: addLocalDays(rangeStart, -7) }) : href({ month: shiftMonth(monthFirst, -1) });
  const nextHref = view === "week" ? href({ view: "week", date: addLocalDays(rangeStart, 7) }) : href({ month: shiftMonth(monthFirst, 1) });
  const title = view === "week" ? `${formatLocalDate(rangeStart, "d MMM")} – ${formatLocalDate(rangeEnd, "d MMM")}` : formatLocalDate(monthFirst, "MMMM");
  const year = formatLocalDate(view === "week" ? rangeStart : monthFirst, "yyyy");

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title={
          <>
            {title} <span className="text-faint">{year}</span>
          </>
        }
        actions={
          <>
            <Link href={prevHref} aria-label={view === "week" ? "Previous week" : "Previous month"} className="grid size-10 place-items-center rounded-xl border border-hair bg-card hover:bg-sunken">
              <Icon name="back" size={18} />
            </Link>
            <Link href={view === "week" ? href({ view: "week" }) : "/calendar"} className="rounded-xl border border-hair bg-card px-3.5 py-2 text-[14px] font-medium hover:bg-sunken">
              Today
            </Link>
            <Link href={nextHref} aria-label={view === "week" ? "Next week" : "Next month"} className="grid size-10 place-items-center rounded-xl border border-hair bg-card hover:bg-sunken">
              <Icon name="forward" size={18} />
            </Link>
          </>
        }
      />

      <nav aria-label="Calendar view" className="mb-5 flex max-w-xs gap-1 rounded-[14px] bg-sunken p-1">
        {(["month", "week"] as const).map((v) => (
          <Link
            key={v}
            href={v === "week" ? href({ view: "week", date: detailDate ?? today }) : href({ month: (detailDate ?? today).slice(0, 7), date: detailDate })}
            aria-current={view === v ? "page" : undefined}
            className={cn("flex-1 rounded-[10px] px-3 py-2 text-center text-[13.5px] capitalize", view === v ? "bg-card font-semibold shadow-sm" : "font-medium text-muted hover:text-ink")}
          >
            {v}
          </Link>
        ))}
      </nav>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card className="h-fit">
          {view === "month" ? (
            <div role="grid" aria-label={`${title} ${year}`} className="flex flex-col gap-1">
              <div role="row" className="grid grid-cols-7">
                {weekdayOrder.map((d) => (
                  <span key={d} role="columnheader" className="text-center font-mono text-[11px] text-faint">
                    {d}
                  </span>
                ))}
              </div>
              {Array.from({ length: aggs.length / 7 }, (_, w) => (
                <div role="row" key={w} className="grid grid-cols-7">
                  {aggs.slice(w * 7, w * 7 + 7).map((a) => (
                    <div role="gridcell" key={a.date}>
                      <DayCell agg={a} href={dayHref(a.date)} inMonth={a.date.slice(0, 7) === monthFirst.slice(0, 7)} isToday={a.date === today} selected={a.date === detailDate} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <WeekView aggs={aggs} today={today} selected={detailDate} hrefFor={dayHref} />
          )}
          <div className="mt-4 border-t border-hair pt-3">
            <CalendarLegend />
          </div>
        </Card>

        <div>
          {detailAgg ? (
            <DayDetail
              agg={detailAgg}
              sessions={detailSessions}
              checkIn={toCheckInValues(detailAgg.day, tz)}
              focusLabel={focusLabel}
              editing={editing && !detailAgg.isFuture}
              editHref={href({ ...baseParams, date: detailAgg.date, edit: "1" })}
              closeHref={href({ ...baseParams, date: detailAgg.date })}
            />
          ) : (
            <Card>
              <p className="font-serif text-2xl">Pick a day</p>
              <p className="mt-1 text-[13.5px] text-muted">Select any day to see what happened and add a check-in you forgot.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function WeekView({ aggs, today, selected, hrefFor }: { aggs: DayAggregate[]; today: LocalDate; selected?: LocalDate; hrefFor: (d: LocalDate) => string }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {aggs.map((a) => {
        const d = a.day;
        return (
          <li key={a.date}>
            <Link
              href={hrefFor(a.date)}
              scroll={false}
              aria-label={describeDay(a)}
              aria-current={a.date === selected ? "date" : undefined}
              className={cn(
                "flex h-full flex-row gap-3 rounded-2xl border p-3 text-[12px] hover:bg-sunken sm:flex-col sm:gap-1.5",
                a.date === today ? "border-ink" : a.date === selected ? "border-ochre" : "border-hair",
                a.isFuture && "border-dashed text-faint",
              )}
            >
              <span className="w-16 font-mono text-[11px] text-muted sm:w-auto">
                {formatLocalDate(a.date, "EEE")} <span className="text-ink">{formatLocalDate(a.date, "d")}</span>
              </span>
              {a.isFuture ? (
                <span className="text-faint">upcoming</span>
              ) : (
                <span className="flex flex-wrap gap-x-3 gap-y-1 sm:flex-col">
                  <span className={a.studyTargetMet ? "font-semibold text-ochre" : ""}>Study {formatClock(a.studySeconds)}</span>
                  <span>
                    Habits {a.habitsSucceeded}/{a.habitsScheduled}
                    {a.reduceOver ? <span className="text-clay"> · over</span> : null}
                  </span>
                  {a.tasksCompleted ? <span>Tasks {a.tasksCompleted}</span> : null}
                  {d?.mood ? <span>Mood {d.mood}</span> : null}
                  {d?.sleepStart && d.sleepEnd ? <span>Sleep {formatClock((d.sleepEnd.getTime() - d.sleepStart.getTime()) / 1000)}</span> : null}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
