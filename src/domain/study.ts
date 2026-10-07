/** Pure study-session maths. No I/O — unit tested. */

export const FOCUS_LABELS = { 1: "Poor", 2: "Low", 3: "Okay", 4: "Good", 5: "Deep" } as const;
export type FocusLevel = keyof typeof FOCUS_LABELS;

export const STUDY_METHODS = ["lecture", "reading", "notes", "practice", "problem_solving", "revision", "mock_test", "project_work"] as const;
export type StudyMethod = (typeof STUDY_METHODS)[number];
export const METHOD_LABELS: Record<StudyMethod, string> = {
  lecture: "Lecture",
  reading: "Reading",
  notes: "Notes",
  practice: "Practice",
  problem_solving: "Problem solving",
  revision: "Revision",
  mock_test: "Mock test",
  project_work: "Project work",
};

/** Sessions longer than this at finish are probably a timer someone forgot to stop. */
export const FORGOTTEN_TIMER_SECONDS = 3 * 60 * 60;
/** Upper bound for a single recorded session. */
export const MAX_SESSION_SECONDS = 16 * 60 * 60;

export type SessionTiming = {
  startedAt: Date;
  endedAt: Date | null;
  pausedAt: Date | null;
  pausedSeconds: number;
};

/**
 * Seconds actually studied: wall-clock time minus completed pauses minus the
 * pause in progress (if any). Never negative.
 */
export function elapsedSeconds(s: SessionTiming, now: Date): number {
  const end = s.endedAt ?? now;
  const wall = (end.getTime() - s.startedAt.getTime()) / 1000;
  const openPause = s.pausedAt ? Math.max(0, (end.getTime() - s.pausedAt.getTime()) / 1000) : 0;
  return Math.max(0, Math.floor(wall - s.pausedSeconds - openPause));
}

/** Total paused seconds after closing any pause still open at `at`. */
export function closePause(s: Pick<SessionTiming, "pausedAt" | "pausedSeconds">, at: Date): number {
  if (!s.pausedAt) return s.pausedSeconds;
  return s.pausedSeconds + Math.max(0, Math.floor((at.getTime() - s.pausedAt.getTime()) / 1000));
}

export function isForgottenTimer(durationSeconds: number): boolean {
  return durationSeconds > FORGOTTEN_TIMER_SECONDS;
}

/** correct / attempted, or null when nothing was attempted or data is inconsistent. */
export function accuracy(attempted: number | null | undefined, correct: number | null | undefined): number | null {
  if (!attempted || attempted <= 0 || correct == null || correct < 0 || correct > attempted) return null;
  return correct / attempted;
}

/** Combined accuracy across sessions, weighting by questions attempted. */
export function combinedAccuracy(rows: ReadonlyArray<{ questionsAttempted: number | null; questionsCorrect: number | null }>): { attempted: number; correct: number; rate: number | null } {
  let attempted = 0;
  let correct = 0;
  for (const r of rows) {
    if (r.questionsAttempted && r.questionsCorrect != null && r.questionsCorrect <= r.questionsAttempted) {
      attempted += r.questionsAttempted;
      correct += r.questionsCorrect;
    }
  }
  return { attempted, correct, rate: attempted ? correct / attempted : null };
}

/** Mean topic progress as 0–1. A subject with no topics has no progress yet. */
export function subjectProgress(topicProgress: readonly number[]): number {
  if (!topicProgress.length) return 0;
  const sum = topicProgress.reduce((a, p) => a + Math.max(0, Math.min(100, p)), 0);
  return sum / topicProgress.length / 100;
}

export type TopicStatus = "not_started" | "in_progress" | "completed";

/** Status implied by a manual progress change. Completion is an explicit action, not 100%. */
export function statusForProgress(progress: number, current: TopicStatus): TopicStatus {
  if (current === "completed") return "completed";
  return progress > 0 ? "in_progress" : "not_started";
}
