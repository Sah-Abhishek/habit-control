import { describe, expect, it } from "vitest";
import { daysLeft, estimatedFinish, expectedProgress, goalProgress, neededPerWeek, paceStatus, velocityPerWeek } from "./goals";

describe("goalProgress", () => {
  it("is 0 with no milestones", () => expect(goalProgress([])).toBe(0));
  it("averages milestone progress and clamps bad values", () => {
    expect(goalProgress([{ progress: 50 }, { progress: 100 }])).toBeCloseTo(0.75);
    expect(goalProgress([{ progress: 150 }, { progress: -10 }])).toBeCloseTo(0.5);
  });
});

describe("expectedProgress", () => {
  it("is null without a target date", () => expect(expectedProgress("2026-01-01", null, "2026-06-01")).toBeNull());
  it("is 0 before the start and 1 after the target", () => {
    expect(expectedProgress("2026-01-11", "2026-01-21", "2026-01-01")).toBe(0);
    expect(expectedProgress("2026-01-01", "2026-01-11", "2026-02-01")).toBe(1);
  });
  it("is the elapsed fraction in between", () => expect(expectedProgress("2026-01-01", "2026-01-11", "2026-01-06")).toBeCloseTo(0.5));
  it("handles a same-day target", () => {
    expect(expectedProgress("2026-01-01", "2026-01-01", "2025-12-31")).toBe(0);
    expect(expectedProgress("2026-01-01", "2026-01-01", "2026-01-01")).toBe(1);
  });
});

describe("paceStatus", () => {
  it("uses a ±5 point tolerance", () => {
    expect(paceStatus(0.42, 0.4)).toBe("on_pace");
    expect(paceStatus(0.46, 0.4)).toBe("ahead");
    expect(paceStatus(0.34, 0.4)).toBe("behind");
  });
  it("is null without an expectation and ahead when finished", () => {
    expect(paceStatus(0.5, null)).toBeNull();
    expect(paceStatus(1, 1)).toBe("ahead");
  });
});

describe("rates and projections", () => {
  it("computes days left (negative when overdue)", () => {
    expect(daysLeft("2026-10-17", "2026-10-07")).toBe(10);
    expect(daysLeft("2026-10-01", "2026-10-07")).toBe(-6);
    expect(daysLeft(null, "2026-10-07")).toBeNull();
  });
  it("velocity per week since start", () => {
    expect(velocityPerWeek(0.2, "2026-01-01", "2026-01-15")).toBeCloseTo(0.1);
    expect(velocityPerWeek(0.2, "2026-01-15", "2026-01-15")).toBeNull();
  });
  it("needed per week to finish on time", () => {
    expect(neededPerWeek(0.5, "2026-01-15", "2026-01-01")).toBeCloseTo(0.25);
    expect(neededPerWeek(0.5, "2026-01-01", "2026-01-05")).toBeNull();
  });
  it("estimates finish linearly, null with no progress", () => {
    expect(estimatedFinish(0.5, "2026-01-01", "2026-01-11")).toBe("2026-01-21");
    expect(estimatedFinish(0, "2026-01-01", "2026-01-11")).toBeNull();
    expect(estimatedFinish(1, "2026-01-01", "2026-01-11")).toBe("2026-01-11");
  });
});
