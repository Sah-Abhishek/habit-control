import { describe, expect, it } from "vitest";
import { dayScore, scoreBand, sleepStudyObservation } from "./day-score";

const empty = { studyMinutes: 0, studyTargetMinutes: 0, habitsScheduled: 0, habitsSucceeded: 0, tasksDue: 0, tasksCompleted: 0 };

describe("dayScore", () => {
  it("is null when nothing applies", () => {
    expect(dayScore(empty)).toBeNull();
    expect(scoreBand(null)).toBe("none");
  });

  it("is 0 for an empty day when a study target exists", () => {
    expect(dayScore({ ...empty, studyTargetMinutes: 120 })).toBe(0);
  });

  it("caps study at the target", () => {
    expect(dayScore({ ...empty, studyTargetMinutes: 60, studyMinutes: 240 })).toBe(1);
  });

  it("renormalises weights over tracked parts", () => {
    // only habits tracked: 3 of 4 → 0.75
    expect(dayScore({ ...empty, habitsScheduled: 4, habitsSucceeded: 3 })).toBeCloseTo(0.75);
    // study half (0.5*0.5) + habits full (0.35*1) over weight 0.85
    expect(dayScore({ ...empty, studyTargetMinutes: 120, studyMinutes: 60, habitsScheduled: 2, habitsSucceeded: 2 })).toBeCloseTo((0.25 + 0.35) / 0.85);
  });

  it("counts study without a target as full when it happened", () => {
    expect(dayScore({ ...empty, studyMinutes: 10 })).toBe(1);
  });

  it("treats completed tasks beyond those due as full", () => {
    expect(dayScore({ ...empty, tasksDue: 1, tasksCompleted: 3 })).toBe(1);
  });

  it("bands scores", () => {
    expect(scoreBand(0.1)).toBe("light");
    expect(scoreBand(0.5)).toBe("medium");
    expect(scoreBand(0.9)).toBe("full");
  });
});

describe("sleepStudyObservation", () => {
  const rows = (n: number, sleep: number, study: number) => Array.from({ length: n }, () => ({ sleepHours: sleep, studyMinutes: study }));

  it("stays silent without enough data", () => {
    expect(sleepStudyObservation(rows(13, 8, 60))).toBeNull();
    expect(sleepStudyObservation([...rows(12, 8, 120), ...rows(4, 6, 30)])).toBeNull();
  });

  it("reports the difference with sample size", () => {
    const o = sleepStudyObservation([...rows(10, 7.5, 150), ...rows(6, 6, 90)]);
    expect(o).toEqual({ text: "After 7h+ sleep you study 2h 30m on average, versus 1h 30m after shorter nights.", days: 16 });
  });

  it("says when there is no meaningful difference", () => {
    expect(sleepStudyObservation([...rows(8, 8, 100), ...rows(8, 6, 95)])?.text).toMatch(/about the same/);
  });
});
