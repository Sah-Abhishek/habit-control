import { describe, expect, it } from "vitest";
import { buildReviewText, changePct, type ReviewInput } from "./review";

const NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function week(hours: number[]): ReviewInput["studyByDay"] {
  return hours.map((h, i) => ({ date: `2026-09-${String(28 + i).padStart(2, "0")}`, seconds: h * 3600, future: false, weekday: NAMES[i] }));
}
const base: ReviewInput = { studyByDay: week([2, 2, 2, 2, 2, 2, 2]), prevStudySeconds: 14 * 3600, targetSecondsPerDay: 7200, subjects: [], habits: [], sleepHours: [], prevSleepHours: [] };

describe("weekly review text", () => {
  it("reports rises and missed days with specific numbers", () => {
    const r = buildReviewText({ ...base, studyByDay: week([3, 3, 3, 0, 3, 2, 2]), prevStudySeconds: 12 * 3600 });
    expect(r.wentWell).toContain("Study time rose 33% to 16h.");
    expect(r.needsAttention).toContain("No study on Thu.");
  });

  it("flags a subject that gets far less time than its weight and suggests a specific fix", () => {
    const r = buildReviewText({
      ...base,
      subjects: [
        { id: "a", name: "DBMS", seconds: 10 * 3600, weight: 10 },
        { id: "b", name: "OS", seconds: 0.5 * 3600, weight: 10 },
      ],
    });
    expect(r.needsAttention.some((s) => s.startsWith("OS got 30m — 5% of your time for 50% of the weight"))).toBe(true);
    expect(r.suggestion).toContain("OS");
    expect(r.wentWell).toContain("Most time went to DBMS (10h).");
  });

  it("compares habits and sleep only past meaningful thresholds", () => {
    const r = buildReviewText({
      ...base,
      habits: [
        { name: "Exercise", thisWeek: 6 / 7, prevWeek: 3 / 7 },
        { name: "Reading", thisWeek: 0.5, prevWeek: 0.55 },
      ],
      sleepHours: [6, 6, 6],
      prevSleepHours: [7, 7, 7],
    });
    expect(r.wentWell).toContain("Exercise consistency rose from 43% to 86%.");
    expect(r.wentWell.join(" ") + r.needsAttention.join(" ")).not.toContain("Reading");
    expect(r.needsAttention).toContain("Average logged sleep dropped 60m to 6h.");
  });

  it("handles an empty week without inventing praise", () => {
    const r = buildReviewText({ ...base, studyByDay: week([0, 0, 0, 0, 0, 0, 0]), prevStudySeconds: 0 });
    expect(r.wentWell).toEqual([]);
    expect(r.needsAttention).toEqual(["No study sessions were logged this week."]);
    expect(r.suggestion).not.toBeNull();
  });

  it("ignores future days of a week in progress", () => {
    const days = week([2, 2, 2, 0, 0, 0, 0]).map((d, i) => ({ ...d, future: i >= 3 }));
    const r = buildReviewText({ ...base, studyByDay: days });
    expect(r.needsAttention.join(" ")).not.toContain("No study on");
  });

  it("computes change only with a baseline", () => {
    expect(changePct(10, 0)).toBeNull();
    expect(changePct(12, 10)).toBeCloseTo(0.2);
  });
});
