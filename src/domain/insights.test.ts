import { describe, expect, it } from "vitest";
import { addLocalDays } from "./dates";
import {
  bestFocusWindow,
  effortVsWeight,
  focusByHour,
  observations,
  parseRange,
  studyKpis,
  studySecondsByDay,
  trendDirection,
  weeklyStudy,
  type DayFacts,
  type SessionPoint,
} from "./insights";

const TODAY = "2026-10-07";
const s = (ago: number, minutes: number, extra: Partial<SessionPoint> = {}): SessionPoint => ({
  localDate: addLocalDays(TODAY, -ago),
  durationSeconds: minutes * 60,
  focus: null,
  questionsAttempted: null,
  questionsCorrect: null,
  startHour: 9,
  subjectId: null,
  ...extra,
});

function facts(n: number, f: (i: number) => Partial<DayFacts>): DayFacts[] {
  return Array.from({ length: n }, (_, i) => ({ date: addLocalDays(TODAY, -i), studySeconds: 0, avgFocus: null, sleepHours: null, energy: null, reduceCount: null, ...f(i) }));
}

describe("parseRange", () => {
  it("falls back to 30d for anything unexpected", () => {
    expect(parseRange("90d")).toBe("90d");
    expect(parseRange("2y")).toBe("30d");
    expect(parseRange(undefined)).toBe("30d");
    expect(parseRange(["7d"])).toBe("30d");
  });
});

describe("studyKpis", () => {
  it("works with no data", () => {
    const k = studyKpis([], addLocalDays(TODAY, -6), TODAY);
    expect(k).toMatchObject({ totalSeconds: 0, totalChange: null, avgFocus: null, accuracy: null, consistency: 0, days: 7 });
  });

  it("compares with the previous period and only counts complete question pairs", () => {
    const sessions = [
      s(0, 60, { focus: 4, questionsAttempted: 10, questionsCorrect: 8 }),
      s(1, 60, { focus: 2, questionsAttempted: 5, questionsCorrect: null }),
      s(8, 60),
    ];
    const k = studyKpis(sessions, addLocalDays(TODAY, -6), TODAY);
    expect(k.totalSeconds).toBe(7200);
    expect(k.prevTotalSeconds).toBe(3600);
    expect(k.totalChange).toBeCloseTo(1);
    expect(k.avgFocus).toBe(3);
    expect(k.accuracy).toBeCloseTo(0.8);
    expect(k.studyDays).toBe(2);
  });

  it("caps corrupted correct > attempted at 100%", () => {
    const k = studyKpis([s(0, 30, { questionsAttempted: 4, questionsCorrect: 9 })], TODAY, TODAY);
    expect(k.accuracy).toBe(1);
  });
});

describe("weeklyStudy", () => {
  it("returns the requested number of weeks with a partial current week", () => {
    const byDay = studySecondsByDay([s(0, 60), s(2, 30), s(9, 120)]);
    const weeks = weeklyStudy(byDay, TODAY, 4, 1);
    expect(weeks).toHaveLength(4);
    const cur = weeks.at(-1)!;
    expect(cur).toMatchObject({ weekStart: "2026-10-05", isCurrent: true, daysElapsed: 3, seconds: 5400 });
    expect(weeks.at(-2)!.seconds).toBe(7200);
  });
});

describe("focus by hour", () => {
  it("only trusts hours with enough sessions", () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => s(1, 30, { startHour: 8, focus: 5 })),
      ...Array.from({ length: 3 }, () => s(1, 30, { startHour: 9, focus: 4 })),
      ...Array.from({ length: 3 }, () => s(1, 30, { startHour: 20, focus: 2 })),
      s(1, 30, { startHour: 22, focus: 5 }),
    ];
    const cells = focusByHour(sessions);
    expect(cells[22]).toMatchObject({ sessions: 1, avgFocus: 5 });
    const best = bestFocusWindow(cells);
    expect(best).toMatchObject({ from: 8, to: 10, avg: 4.5, otherAvg: 2 });
  });

  it("returns null with too little data", () => {
    expect(bestFocusWindow(focusByHour([s(0, 10, { focus: 3 })]))).toBeNull();
  });
});

describe("effortVsWeight", () => {
  it("flags subjects whose time share is under 60% of their weight share", () => {
    const { rows, hasWeights } = effortVsWeight(
      [
        { id: "a", name: "DBMS", weight: 10 },
        { id: "b", name: "OS", weight: 10 },
        { id: "c", name: "Notes", weight: null },
      ],
      new Map([["a", 9000], ["b", 1000]]),
    );
    expect(hasWeights).toBe(true);
    expect(rows.find((r) => r.name === "OS")?.underInvested).toBe(true);
    expect(rows.find((r) => r.name === "DBMS")?.underInvested).toBe(false);
    expect(rows.find((r) => r.name === "Notes")?.weightShare).toBeNull();
  });

  it("reports when no weights exist", () => {
    expect(effortVsWeight([{ id: "a", name: "X", weight: null }], new Map()).hasWeights).toBe(false);
  });
});

describe("observations", () => {
  it("stays silent with fewer than 14 paired days", () => {
    const f = facts(13, (i) => ({ sleepHours: i % 2 ? 8 : 5, avgFocus: i % 2 ? 4.5 : 2 }));
    expect(observations(f)).toEqual([]);
  });

  it("labels 14–29 paired days as an early signal and 30+ as a pattern", () => {
    const mk = (n: number) => facts(n, (i) => ({ sleepHours: i % 2 ? 8 : 5, avgFocus: i % 2 ? 4.5 : 2 }));
    expect(observations(mk(20))[0]).toMatchObject({ id: "sleep-focus", strength: "early", n: 20 });
    expect(observations(mk(40))[0]).toMatchObject({ strength: "pattern", n: 40 });
  });

  it("needs both groups to be big enough", () => {
    const f = facts(30, (i) => ({ sleepHours: i < 27 ? 8 : 5, avgFocus: i < 27 ? 4 : 1 }));
    expect(observations(f).find((o) => o.id === "sleep-focus")).toBeUndefined();
  });

  it("ignores small differences", () => {
    const f = facts(30, (i) => ({ energy: i % 2 ? 7 : 3, studySeconds: i % 2 ? 3600 : 3500 }));
    expect(observations(f).find((o) => o.id === "energy-study")).toBeUndefined();
  });

  it("phrases the energy and reduce-habit observations without causal claims", () => {
    const f = facts(30, (i) => ({ energy: i % 2 ? 7 : 3, studySeconds: i % 2 ? 7200 : 1800, reduceCount: i % 2 ? 1 : 4 }));
    const obs = observations(f, "Late-night scrolling");
    expect(obs.map((o) => o.id)).toEqual(["energy-study", "reduce-lowstudy"]);
    for (const o of obs) expect(o.text).not.toMatch(/because|causes|leads to/i);
  });
});

describe("trendDirection", () => {
  it("uses a dead zone", () => {
    expect(trendDirection(0.5, 0.52)).toBe("flat");
    expect(trendDirection(0.5, 0.7)).toBe("up");
    expect(trendDirection(0.7, 0.5)).toBe("down");
    expect(trendDirection(null, 0.5)).toBeNull();
  });
});
