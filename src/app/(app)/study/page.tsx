import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { LogSessionButton } from "@/components/study/log-session-dialog";
import { RevisionList } from "@/components/study/revision-list";
import { RunningSessionBanner } from "@/components/study/running-session-banner";
import { SessionList } from "@/components/study/session-list";
import { toRunningSessionInfo } from "@/components/study/session-info";
import { StartSessionButton } from "@/components/study/start-session-button";
import { NewSubjectButton } from "@/components/study/subject-form";
import { Card, CardHeader, Label, Pill, ProgressBar } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { addLocalDays, formatLocalDate } from "@/domain/dates";
import { formatDuration, formatPercent } from "@/domain/format";
import { requireUser } from "@/server/auth/session";
import { listGoalOptions } from "@/server/services/goals";
import { getToday } from "@/server/services/settings";
import { getRunningSession, listSubjectSummaries, listTopicOptions, recentSessions, revisionsDue, studySecondsByDay } from "@/server/services/study";

export const metadata: Metadata = { title: "Study" };

export default async function StudyPage() {
  const user = await requireUser();
  const { today, settings } = await getToday(user.id);
  const [subjects, archived, goals, due, recent, running, topicOptions, week] = await Promise.all([
    listSubjectSummaries(user.id),
    listSubjectSummaries(user.id, { includeArchived: true }).then((all) => all.filter((s) => s.archivedAt)),
    listGoalOptions(user.id),
    revisionsDue(user.id, today),
    recentSessions(user.id, { limit: 8 }),
    getRunningSession(user.id),
    listTopicOptions(user.id),
    studySecondsByDay(user.id, addLocalDays(today, -6), today),
  ]);
  const todaySeconds = week.get(today) ?? 0;
  const weekSeconds = [...week.values()].reduce((a, b) => a + b, 0);
  const subjectOptions = subjects.map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <PageHeader
        eyebrow={formatLocalDate(today, "EEEE · d MMMM")}
        title="Study"
        actions={
          <>
            <NewSubjectButton goals={goals} />
            <LogSessionButton subjects={subjectOptions} topics={topicOptions} today={today} />
            {running ? null : <StartSessionButton />}
          </>
        }
      >
        <p className="mt-2 text-[14px] text-muted">
          {formatDuration(todaySeconds)} today of a {formatDuration(settings.dailyStudyTargetMin * 60)} target · {formatDuration(weekSeconds)} in the last 7 days
        </p>
      </PageHeader>

      {running ? (
        <div className="mb-5">
          <RunningSessionBanner session={toRunningSessionInfo(running)} />
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="subjects-heading">
          <h2 id="subjects-heading" className="sr-only">
            Subjects
          </h2>
          {subjects.length === 0 ? (
            <EmptyState
              title="No subjects yet."
              body="Add the subjects you’re studying — e.g. DBMS, Operating Systems — then break each into topics. Your study history will appear here once you complete your first session."
              action={<NewSubjectButton goals={goals} label="Add your first subject" variant="primary" />}
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {subjects.map((s) => (
                <li key={s.id}>
                  <Link href={`/study/${s.id}`} className="flex h-full flex-col gap-3 rounded-[22px] bg-card p-5 transition-shadow hover:shadow-md">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-[26px] leading-tight">{s.name}</p>
                        <p className="truncate text-[12.5px] text-muted">{s.goalTitle ?? "Not linked to a goal"}</p>
                      </div>
                      <span className="font-serif text-[26px] leading-tight text-moss">{formatPercent(s.progress)}</span>
                    </div>
                    <ProgressBar value={s.progress} tone={s.progress >= 0.6 ? "moss" : "ochre"} label={`${s.name} progress`} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
                      <span>
                        {s.completedCount}/{s.topicCount} topics done
                      </span>
                      <span>{formatDuration(s.studySeconds)} logged</span>
                      {s.weight != null ? <span>{s.weight}% of marks</span> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {archived.length ? (
            <div className="mt-6">
              <Label>Archived · history kept</Label>
              <ul className="mt-2 flex flex-wrap gap-2">
                {archived.map((s) => (
                  <li key={s.id}>
                    <Link href={`/study/${s.id}`} className="inline-block rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Revisions due" meta={due.length ? String(due.length) : undefined} action={due.some((d) => d.overdueDays > 0) ? <Pill tone="ochre">some overdue</Pill> : null} />
            <RevisionList items={due.map((d) => ({ id: d.id, step: d.step, overdueDays: d.overdueDays, topicName: d.topicName, subjectId: d.subjectId, subjectName: d.subjectName }))} />
          </Card>
          <Card>
            <CardHeader title="Recent sessions" />
            {recent.length ? (
              <SessionList sessions={recent} today={today} />
            ) : (
              <p className="text-[13.5px] text-muted">Your study history will appear here once you complete your first session.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
