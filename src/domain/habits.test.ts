import { describe, expect, it } from "vitest";
import { addLocalDays } from "./dates";
import { bestStreak, consistency, currentStreak, dayState, reductionStats, thread, type HabitDef } from "./habits";

const TODAY = "2026-10-07"; // a Wednesday
const everyDay = [0, 1, 2, 3, 4, 5, 6];

function logs(entries: Array<[number, number]>) {
  // [daysAgo, value]
  return new Map(entries.map(([ago, v]) => [addLocalDays(TODAY, -ago), v]));
}

const build: HabitDef = { kind: "build", target: 1, scheduleDays: everyDay, startedOn: addLocalDays(TODAY, -29) };

describe("dayState", () => {
  it("treats an unfinished today as pending, not missed", () => {
    expect(dayState(build, logs([]), TODAY, TODAY)).toBe("pending");
    expect(dayState(build, logs([]), addLocalDays(TODAY, -1), TODAY)).toBe("missed");
  });

  it("marks partial progress on quantity habits", () => {
    const h = { ...build, target: 10 };
    expect(dayState(h, logs([[1, 4]]), addLocalDays(TODAY, -1), TODAY)).toBe("partial");
    expect(dayState(h, logs([[1, 10]]), addLocalDays(TODAY, -1), TODAY)).toBe("done");
  });

  it("ignores days before the habit started and unscheduled days", () => {
    expect(dayState(build, logs([]), addLocalDays(TODAY, -40), TODAY)).toBe("off");
    const weekdays: HabitDef = { ...build, scheduleDays: [1, 2, 3, 4, 5] };
    expect(dayState(weekdays, logs([]), "2026-10-04", TODAY)).toBe("off"); // Sunday
  });

  it("classifies reduce days against the limit", () => {
    const r: HabitDef = { kind: "reduce", target: 3, scheduleDays: everyDay, startedOn: addLocalDays(TODAY, -29), baseline: 4 };
    const l = logs([[1, 0], [2, 2], [3, 5]]);
    expect(dayState(r, l, addLocalDays(TODAY, -1), TODAY)).toBe("clear");
    expect(dayState(r, l, addLocalDays(TODAY, -2), TODAY)).toBe("within");
    expect(dayState(r, l, addLocalDays(TODAY, -3), TODAY)).toBe("over");
  });
});

describe("streaks", () => {
  it("does not break the current streak because today is not done yet", () => {
    const l = logs([[1, 1], [2, 1], [3, 1]]);
    expect(currentStreak(build, l, TODAY)).toBe(3);
  });

  it("a miss resets the current streak but keeps the best streak", () => {
    const l = logs([[0, 1], [1, 1], [3, 1], [4, 1], [5, 1], [6, 1]]);
    expect(currentStreak(build, l, TODAY)).toBe(2);
    expect(bestStreak(build, l, TODAY)).toBe(4);
  });

  it("skips unscheduled days instead of counting them as breaks", () => {
    const weekdays: HabitDef = { ...build, scheduleDays: [1, 2, 3, 4, 5] };
    // Mon 5 Oct, Tue 6 Oct, Fri 2 Oct done; Sat/Sun unscheduled.
    const l = new Map([["2026-10-05", 1], ["2026-10-06", 1], ["2026-10-02", 1]]);
    expect(currentStreak(weekdays, l, TODAY)).toBe(3);
  });
});

describe("consistency", () => {
  it("excludes pending today from the denominator", () => {
    const l = logs([[1, 1], [2, 1], [3, 0], [4, 1], [5, 1], [6, 1]]);
    const c = consistency(build, l, TODAY, 7);
    expect(c.scheduled).toBe(6);
    expect(c.successes).toBe(5);
    expect(c.rate).toBeCloseTo(5 / 6);
  });

  it("returns null rate when nothing was scheduled yet", () => {
    const fresh: HabitDef = { ...build, startedOn: TODAY };
    expect(consistency(fresh, logs([]), TODAY, 30).rate).toBeNull();
  });
});

describe("reductionStats", () => {
  const r: HabitDef = { kind: "reduce", target: 3, scheduleDays: everyDay, startedOn: addLocalDays(TODAY, -28), baseline: 4 };

  it("compares this week with the previous week and keeps history after a lapse", () => {
    // previous week (8..14 days ago): 4 per day; last week (1..7 days ago): 2 per day; today a lapse of 6.
    const entries: Array<[number, number]> = [[0, 6]];
    for (let i = 1; i <= 7; i++) entries.push([i, 2]);
    for (let i = 8; i <= 14; i++) entries.push([i, 4]);
    const s = reductionStats(r, logs(entries), TODAY);
    expect(s.weekAvg).toBe(2);
    expect(s.prevWeekAvg).toBe(4);
    expect(s.weekChange).toBeCloseTo(0.5);
    expect(s.todayValue).toBe(6);
    expect(s.daysSinceLast).toBe(0);
  });

  it("counts missing days as clear and measures avoided occurrences", () => {
    const s = reductionStats(r, logs([[5, 2]]), TODAY);
    expect(s.longestClearRun).toBe(23); // days 28..6 ago
    expect(s.daysSinceLast).toBe(5);
    // 28 days of history; baseline 4 → 112, minus the 2 that happened.
    expect(s.avoidedVsBaseline).toBe(110);
  });
});

describe("thread", () => {
  it("returns exactly N ticks ending today", () => {
    const t = thread(build, logs([[0, 1]]), TODAY, 30);
    expect(t).toHaveLength(30);
    expect(t.at(-1)).toMatchObject({ date: TODAY, state: "done" });
  });
});
