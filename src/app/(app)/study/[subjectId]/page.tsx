import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { LogSessionButton } from "@/components/study/log-session-dialog";
import { SessionList } from "@/components/study/session-list";
import { StartSessionButton } from "@/components/study/start-session-button";
import { SubjectManage } from "@/components/study/subject-form";
import { TopicList, type TopicItem } from "@/components/study/topic-list";
import { Card, CardHeader, Label, Pill } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { formatDuration, formatPercent } from "@/domain/format";
import { revisionState } from "@/domain/revisions";
import { combinedAccuracy, subjectProgress } from "@/domain/study";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/result";
import { listGoalOptions } from "@/server/services/goals";
import { getToday } from "@/server/services/settings";
import { getSubject, listSubjectOptions, listTopicOptions, listTopics, recentSessions, subjectQuestionTotals, subjectTotals, topicRevisions, type Subject } from "@/server/services/study";

export const metadata: Metadata = { title: "Subject" };

async function load(userId: string, id: string): Promise<Subject> {
  if (!z.string().uuid().safeParse(id).success) notFound();
  try {
    return await getSubject(userId, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

export default async function SubjectPage({ params }: PageProps<"/study/[subjectId]">) {
  const { subjectId } = await params;
  const user = await requireUser();
  const subject = await load(user.id, subjectId);
  const { today } = await getToday(user.id);
  const [topicRows, sessions, questions, goalOptions, subjectOptions, topicOptions, totals] = await Promise.all([
    listTopics(user.id, subject.id),
    recentSessions(user.id, { subjectId: subject.id, limit: 6 }),
    subjectQuestionTotals(user.id, subject.id),
    listGoalOptions(user.id),
    listSubjectOptions(user.id),
    listTopicOptions(user.id),
    subjectTotals(user.id, subject),
  ]);
  const { studySeconds, goal } = totals;
  const revs = await topicRevisions(user.id, topicRows.map((t) => t.id));
  const progress = subjectProgress(topicRows.map((t) => t.progress));
  const acc = combinedAccuracy(questions);

  const topics: TopicItem[] = topicRows.map((t) => {
    const list = revs.get(t.id) ?? [];
    const steps = list.map((r) => {
      const days = Math.max(0, Math.round((new Date(r.dueDate).getTime() - new Date(list[0].dueDate).getTime()) / 86_400_000));
      return { step: r.step, dueDate: r.dueDate, label: `R${r.step}${days ? ` +${days}d` : ""}`, state: revisionState(r, today) };
    });
    const next = list.find((r) => !r.completedAt && !r.skippedAt);
    let nextRevision: TopicItem["nextRevision"] = null;
    if (next) {
      const st = revisionState(next, today);
      const inDays = Math.round((new Date(next.dueDate).getTime() - new Date(today).getTime()) / 86_400_000);
      nextRevision = st === "due" || st === "overdue" ? { label: st === "due" ? "Revise today" : "Revision overdue", tone: "ochre" } : { label: `Rev ${next.step} in ${inDays}d`, tone: "neutral" };
    }
    return { id: t.id, name: t.name, progress: t.progress, status: t.status, revisions: steps, nextRevision };
  });

  return (
    <>
      <Link href="/study" className="mb-4 inline-flex items-center gap-1 text-[14px] font-medium text-muted hover:text-ink">
        <Icon name="back" size={18} /> Study
      </Link>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            Subject · {topicRows.length} {topicRows.length === 1 ? "topic" : "topics"}
            {subject.archivedAt ? <Pill>Archived</Pill> : null}
          </span>
        }
        title={subject.name}
        actions={
          <>
            <SubjectManage subjectId={subject.id} name={subject.name} archived={!!subject.archivedAt} goals={goalOptions} initial={{ name: subject.name, goalId: subject.goalId, weight: subject.weight }} />
            {subject.archivedAt ? null : <StartSessionButton subjectId={subject.id} />}
          </>
        }
      >
        <p className="mt-2 text-[14px] text-muted">
          {formatDuration(studySeconds)} logged · {acc.rate != null ? `${formatPercent(acc.rate)} accuracy (${acc.correct}/${acc.attempted})` : "no questions logged yet"}
          {goal ? (
            <>
              {" · "}
              <Link href={`/goals/${goal.id}`} className="underline-offset-2 hover:underline">
                {goal.title}
              </Link>
            </>
          ) : null}
        </p>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Topics" action={<span className="font-serif text-[28px] text-moss">{formatPercent(progress)}</span>} />
          <TopicList subjectId={subject.id} topics={topics} archived={!!subject.archivedAt} />
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Recent sessions" action={<LogSessionButton subjects={subjectOptions} topics={topicOptions} today={today} defaultSubjectId={subject.id} />} />
            {sessions.length ? <SessionList sessions={sessions} today={today} showSubject={false} /> : <p className="text-[13.5px] text-muted">No sessions for {subject.name} yet. Start one, or log time you studied away from the app.</p>}
          </Card>
          <Card>
            <Label>How progress works</Label>
            <p className="mt-2 text-[13px] leading-5 text-muted">
              Subject progress is the average of its topics. Marking a topic complete schedules revisions (from Settings); reopening it removes the ones not done yet — finished revisions stay in your history.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
