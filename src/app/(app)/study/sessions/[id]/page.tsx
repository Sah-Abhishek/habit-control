import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/app/page-header";
import { SessionWrapUp } from "@/components/study/session-wrapup";
import { Icon } from "@/components/ui/icon";
import { formatLocalDate } from "@/domain/dates";
import { formatDuration } from "@/domain/format";
import { isForgottenTimer } from "@/domain/study";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/result";
import { getToday } from "@/server/services/settings";
import { getSession, listSubjectOptions, listTopicOptions, listTopics, type SessionWithNames } from "@/server/services/study";

export const metadata: Metadata = { title: "Session" };

async function load(userId: string, id: string): Promise<SessionWithNames> {
  if (!z.string().uuid().safeParse(id).success) notFound();
  try {
    return await getSession(userId, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
}

export default async function SessionPage({ params, searchParams }: PageProps<"/study/sessions/[id]">) {
  const { id } = await params;
  const { finished } = await searchParams;
  const user = await requireUser();
  const session = await load(user.id, id);
  if (!session.endedAt) redirect("/study/session");
  const { today, settings } = await getToday(user.id);
  const [subjects, topics, subjectTopics] = await Promise.all([
    listSubjectOptions(user.id),
    listTopicOptions(user.id),
    session.subjectId ? listTopics(user.id, session.subjectId) : Promise.resolve([]),
  ]);
  const tz = settings.timezone;
  const hhmm = (d: Date) => format(new TZDate(d.getTime(), tz), "HH:mm");
  const duration = session.durationSeconds ?? 0;
  const justFinished = finished === "1";
  const title = [session.subjectName, session.topicName].filter(Boolean).join(" · ");

  return (
    <div className="max-w-2xl">
      <Link href="/study" className="mb-4 inline-flex items-center gap-1 text-[14px] font-medium text-muted hover:text-ink">
        <Icon name="back" size={18} /> Study
      </Link>
      <PageHeader
        eyebrow={
          <span className={justFinished ? "text-moss" : undefined}>
            {justFinished ? "Session saved" : formatLocalDate(session.localDate, "EEE d MMM")} · {hhmm(session.startedAt)} → {hhmm(session.endedAt)}
          </span>
        }
        title={`${formatDuration(duration)}${title ? ` on ${session.topicName ?? session.subjectName}` : " of study"}.`}
      />
      <SessionWrapUp
        session={{
          id: session.id,
          durationSeconds: duration,
          localDate: session.localDate,
          startTime: hhmm(session.startedAt),
          endTime: hhmm(session.endedAt),
          subjectId: session.subjectId,
          topicId: session.topicId,
          method: session.method,
          focus: session.focus,
          questionsAttempted: session.questionsAttempted,
          questionsCorrect: session.questionsCorrect,
          notes: session.notes,
        }}
        subjects={subjects}
        topics={topics}
        topicProgress={Object.fromEntries(subjectTopics.map((t) => [t.id, t.progress]))}
        // The schema has no "last activity" timestamp, so we offer a time correction rather than an automatic trim.
        forgotten={justFinished && isForgottenTimer(duration) ? { lastActivityIso: null, lastActivityLabel: null } : null}
        today={today}
      />
    </div>
  );
}
