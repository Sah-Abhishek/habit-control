"use client";

import Link from "next/link";
import { formatTimer } from "@/domain/format";
import { Icon } from "@/components/ui/icon";
import { useElapsed } from "./use-elapsed";

export type RunningSessionInfo = {
  id: string;
  startedAt: string;
  pausedAt: string | null;
  pausedSeconds: number;
  subjectName: string | null;
  topicName: string | null;
  serverNow: string;
};

/** Pass serialisable values: `toRunningSessionInfo(session)` from a server component. */
export function RunningSessionBanner({ session }: { session: RunningSessionInfo }) {
  const seconds = useElapsed(session);
  const what = [session.subjectName, session.topicName].filter(Boolean).join(" · ") || "Study session";
  return (
    <Link href="/study/session" className="flex items-center gap-3 rounded-2xl bg-inverse px-4 py-3 text-inverse-ink transition-opacity hover:opacity-95">
      <span className={`size-2 rounded-full ${session.pausedAt ? "bg-inverse-ink/40" : "animate-pulse bg-ochre"}`} aria-hidden />
      <span className="text-[13.5px] font-medium">{session.pausedAt ? "Session paused" : "Session running"}</span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] opacity-70">{what}</span>
      <span className="font-mono text-[14px]" aria-label={`Elapsed ${formatTimer(seconds)}`}>
        {formatTimer(seconds)}
      </span>
      <span className="flex items-center gap-1 text-[13px] font-semibold text-ochre">
        Open <Icon name="forward" size={14} />
      </span>
    </Link>
  );
}
