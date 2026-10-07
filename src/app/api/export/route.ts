import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { localDateIn } from "@/domain/dates";
import { getCurrentUser } from "@/server/auth/session";
import { CSV_TABLES, columnsFor, exportAll, exportTable, toCsv } from "@/server/services/export";
import { getSettings } from "@/server/services/settings";

const query = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  includeSensitive: z.enum(["0", "1"]).default("0"),
  table: z.enum(CSV_TABLES).optional(),
});

const noStore = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to export your data." }, { status: 401, headers: noStore });

  const parsed = query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Unknown export options." }, { status: 400, headers: noStore });
  const { format, includeSensitive, table } = parsed.data;
  if (format === "csv" && !table) return NextResponse.json({ error: "Choose which table to export as CSV." }, { status: 400, headers: noStore });

  try {
    const { timezone } = await getSettings(user.id);
    const stamp = localDateIn(timezone);
    const sensitive = includeSensitive === "1";
    if (format === "json") {
      const body = JSON.stringify(await exportAll(user.id, sensitive), null, 2);
      return new NextResponse(body, {
        headers: { ...noStore, "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="almanac-export-${stamp}.json"` },
      });
    }
    const t = table!;
    const rows = await exportTable(user.id, t, sensitive);
    return new NextResponse(toCsv(rows, columnsFor(t)), {
      headers: { ...noStore, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="almanac-${t.replace("_", "-")}-${stamp}.csv"` },
    });
  } catch (err) {
    console.error("[export] failed", { userId: user.id, message: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ error: "Export failed. Your data is unchanged — please try again." }, { status: 500, headers: noStore });
  }
}
