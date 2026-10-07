import type { RunningSessionInfo } from "./running-session-banner";

/** Serialises a running session for client components (Dates → ISO strings). */
export function toRunningSessionInfo(s: {
  id: string;
  startedAt: Date;
  pausedAt: Date | null;
  pausedSeconds: number;
  subjectName: string | null;
  topicName: string | null;
}): RunningSessionInfo {
  return {
    id: s.id,
    startedAt: s.startedAt.toISOString(),
    pausedAt: s.pausedAt?.toISOString() ?? null,
    pausedSeconds: s.pausedSeconds,
    subjectName: s.subjectName,
    topicName: s.topicName,
    serverNow: new Date().toISOString(),
  };
}
