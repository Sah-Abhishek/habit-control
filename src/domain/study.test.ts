import { describe, expect, it } from "vitest";
import { accuracy, closePause, combinedAccuracy, elapsedSeconds, isForgottenTimer, statusForProgress, subjectProgress } from "./study";
import { overdueDays, revisionState, scheduleRevisions } from "./revisions";

const t = (iso: string) => new Date(iso);

describe("elapsedSeconds", () => {
  it("subtracts completed pauses", () => {
    expect(elapsedSeconds({ startedAt: t("2026-10-07T08:00:00Z"), endedAt: t("2026-10-07T09:00:00Z"), pausedAt: null, pausedSeconds: 600 }, new Date())).toBe(3000);
  });
  it("subtracts a pause still in progress", () => {
    const s = { startedAt: t("2026-10-07T08:00:00Z"), endedAt: null, pausedAt: t("2026-10-07T08:30:00Z"), pausedSeconds: 0 };
    expect(elapsedSeconds(s, t("2026-10-07T09:00:00Z"))).toBe(1800);
  });
  it("is never negative", () => {
    expect(elapsedSeconds({ startedAt: t("2026-10-07T08:00:00Z"), endedAt: t("2026-10-07T08:10:00Z"), pausedAt: null, pausedSeconds: 9999 }, new Date())).toBe(0);
  });
  it("closes an open pause", () => {
    expect(closePause({ pausedAt: t("2026-10-07T08:00:00Z"), pausedSeconds: 60 }, t("2026-10-07T08:05:00Z"))).toBe(360);
    expect(closePause({ pausedAt: null, pausedSeconds: 60 }, new Date())).toBe(60);
  });
});

describe("accuracy", () => {
  it("handles empty and inconsistent data", () => {
    expect(accuracy(0, 0)).toBeNull();
    expect(accuracy(10, 12)).toBeNull();
    expect(accuracy(20, 15)).toBe(0.75);
  });
  it("weights combined accuracy by attempts", () => {
    expect(combinedAccuracy([{ questionsAttempted: 10, questionsCorrect: 10 }, { questionsAttempted: 30, questionsCorrect: 15 }, { questionsAttempted: null, questionsCorrect: null }]).rate).toBeCloseTo(25 / 40);
  });
});

describe("forgotten timer", () => {
  it("flags sessions over 3 hours", () => {
    expect(isForgottenTimer(3 * 3600)).toBe(false);
    expect(isForgottenTimer(3 * 3600 + 1)).toBe(true);
  });
});

describe("subject progress", () => {
  it("averages topics and clamps bad values", () => {
    expect(subjectProgress([])).toBe(0);
    expect(subjectProgress([100, 50, 0])).toBeCloseTo(0.5);
    expect(subjectProgress([150, -10])).toBeCloseTo(0.5);
  });
  it("derives status from progress but keeps completion", () => {
    expect(statusForProgress(0, "in_progress")).toBe("not_started");
    expect(statusForProgress(40, "not_started")).toBe("in_progress");
    expect(statusForProgress(10, "completed")).toBe("completed");
  });
});

describe("revisions", () => {
  it("schedules from the completion day", () => {
    expect(scheduleRevisions("2026-10-07", [1, 3, 7, 21, 45])).toEqual([
      { step: 1, dueDate: "2026-10-08" },
      { step: 2, dueDate: "2026-10-10" },
      { step: 3, dueDate: "2026-10-14" },
      { step: 4, dueDate: "2026-10-28" },
      { step: 5, dueDate: "2026-11-21" },
    ]);
  });
  it("drops invalid and duplicate intervals", () => {
    expect(scheduleRevisions("2026-10-07", [7, 0, -2, 3, 3, 1.5])).toEqual([
      { step: 1, dueDate: "2026-10-10" },
      { step: 2, dueDate: "2026-10-14" },
    ]);
  });
  it("classifies revision state", () => {
    expect(overdueDays("2026-10-05", "2026-10-07")).toBe(2);
    expect(revisionState({ dueDate: "2026-10-07", completedAt: null, skippedAt: null }, "2026-10-07")).toBe("due");
    expect(revisionState({ dueDate: "2026-10-06", completedAt: null, skippedAt: null }, "2026-10-07")).toBe("overdue");
    expect(revisionState({ dueDate: "2026-10-09", completedAt: null, skippedAt: null }, "2026-10-07")).toBe("upcoming");
    expect(revisionState({ dueDate: "2026-10-01", completedAt: new Date(), skippedAt: null }, "2026-10-07")).toBe("done");
  });
});
