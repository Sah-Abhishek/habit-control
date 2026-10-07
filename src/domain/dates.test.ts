import { describe, expect, it } from "vitest";
import { addLocalDays, eachLocalDay, isLocalDate, localDateIn, startOfLocalDay, startOfWeek } from "./dates";

describe("dates", () => {
  it("resolves the calendar day in the user's timezone, not the server's", () => {
    const instant = new Date("2026-10-07T20:30:00Z");
    expect(localDateIn("Asia/Kolkata", instant)).toBe("2026-10-08"); // 02:00 next day
    expect(localDateIn("America/Los_Angeles", instant)).toBe("2026-10-07");
  });

  it("handles DST transitions when adding days", () => {
    expect(addLocalDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(eachLocalDay("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("validates dates strictly", () => {
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-2-3")).toBe(false);
    expect(isLocalDate("2026-02-28")).toBe(true);
  });

  it("computes week start for a configurable first day", () => {
    expect(startOfWeek("2026-10-07", 1)).toBe("2026-10-05"); // Monday
    expect(startOfWeek("2026-10-07", 0)).toBe("2026-10-04"); // Sunday
  });

  it("finds local midnight as a UTC instant", () => {
    expect(startOfLocalDay("2026-10-07", "Asia/Kolkata").toISOString()).toBe("2026-10-06T18:30:00.000Z");
  });
});
