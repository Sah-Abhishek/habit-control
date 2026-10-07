import type { Metadata } from "next";
import Link from "next/link";
import { FocusSession } from "@/components/study/focus-session";
import { StartSessionButton } from "@/components/study/start-session-button";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Icon } from "@/components/ui/icon";
import { requireUser } from "@/server/auth/session";
import { getRunningSession } from "@/server/services/study";

export const metadata: Metadata = { title: "Focus session" };

export default async function FocusSessionPage() {
  const user = await requireUser();
  const running = await getRunningSession(user.id);

  return (
    <>
      <Link href="/study" className="mb-4 inline-flex items-center gap-1 text-[14px] font-medium text-muted hover:text-ink">
        <Icon name="back" size={18} /> Study
      </Link>
      {running ? (
        <FocusSession
          id={running.id}
          startedAt={running.startedAt.toISOString()}
          pausedAt={running.pausedAt?.toISOString() ?? null}
          pausedSeconds={running.pausedSeconds}
          serverNow={new Date().toISOString()}
          subjectName={running.subjectName}
          topicName={running.topicName}
          method={running.method}
          attempted={running.questionsAttempted ?? 0}
          correct={running.questionsCorrect ?? 0}
        />
      ) : (
        <EmptyState
          className="mx-auto max-w-lg"
          title="No session running"
          body="Start one now — you can pick the subject and topic afterwards, so there’s nothing to fill in first."
          action={
            <div className="flex gap-2">
              <StartSessionButton />
              <Link href="/study" className={buttonClass("secondary")}>
                Choose a topic
              </Link>
            </div>
          }
        />
      )}
    </>
  );
}
