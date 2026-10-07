import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { account, habitLogs, habits, session, tasks } from "@/server/db/schema";
import { createTestUser } from "@/test/db";
import { columnsFor, exportAll, exportTable, toCsv } from "./export";

describe("export", () => {
  it("only contains the requesting user's rows and no auth secrets", async () => {
    const me = await createTestUser();
    const other = await createTestUser();
    await db.insert(tasks).values([{ userId: me, title: "Mine" }, { userId: other, title: "Theirs" }]);
    await db.insert(account).values({ id: `a-${me}`, accountId: me, providerId: "credential", userId: me, password: "HASH-SHOULD-NOT-LEAK" });
    await db.insert(session).values({ id: `s-${me}`, token: `TOKEN-SHOULD-NOT-LEAK-${me}`, userId: me, expiresAt: new Date(Date.now() + 1e6) });

    const data = await exportAll(me, false);
    expect(data.tasks.map((t) => t.title as string)).toEqual(["Mine"]);
    const text = JSON.stringify(data);
    expect(text).not.toContain("HASH-SHOULD-NOT-LEAK");
    expect(text).not.toContain("TOKEN-SHOULD-NOT-LEAK");
    expect(text).not.toContain(other);
  });

  it("leaves sensitive habits and their logs out unless asked", async () => {
    const me = await createTestUser();
    const [open, secret] = await db
      .insert(habits)
      .values([
        { userId: me, name: "Exercise", startedOn: "2026-10-01" },
        { userId: me, name: "Private thing", kind: "reduce", tracking: "quantity", isSensitive: true, startedOn: "2026-10-01" },
      ])
      .returning();
    await db.insert(habitLogs).values([
      { userId: me, habitId: open.id, localDate: "2026-10-02", value: 1 },
      { userId: me, habitId: secret.id, localDate: "2026-10-02", value: 3 },
    ]);
    expect((await exportTable(me, "habits", false)).map((h) => h.name)).toEqual(["Exercise"]);
    expect(await exportTable(me, "habit_logs", false)).toHaveLength(1);
    expect(await exportTable(me, "habit_logs", true)).toHaveLength(2);
    expect(JSON.stringify(await exportAll(me, false))).not.toContain("Private thing");
  });

  it("escapes CSV and neutralises spreadsheet formulas", () => {
    const csv = toCsv([{ a: '=HYPERLINK("http://x")', b: "comma, and \"quote\"", c: -5, d: "+1", e: null, f: "line\nbreak", g: "@SUM(A1)" }]);
    const [, row] = csv.replace("﻿", "").split("\r\n");
    expect(row.startsWith(`"'=HYPERLINK(""http://x"")"`)).toBe(true);
    expect(row).toContain(`"comma, and ""quote"""`);
    expect(row).toContain(",-5,");
    expect(row).toContain(",'+1,");
    expect(row).toContain(`"line\nbreak"`);
    expect(row).toContain("'@SUM(A1)");
  });

  it("produces headers for empty tables", () => {
    expect(toCsv([], columnsFor("tasks")).replace("﻿", "").split("\r\n")[0]).toContain("title");
  });
});
