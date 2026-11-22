import { getDb } from "@/db";
import { checkRange, toCsv } from "@/domain/report";
import { buildReport } from "@/server/admin";
import { getStaff } from "@/server/session";

/** CSV download for the report: `jenis=penjualan` (every service sold) or `jenis=komisi`. */
export async function GET(request: Request) {
  const staff = await getStaff();
  if (!staff || (staff.role !== "admin" && staff.role !== "owner"))
    return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get("dari") ?? "";
  const to = url.searchParams.get("sampai") ?? "";
  const problem = checkRange(from, to);
  if (problem) return new Response(problem, { status: 400 });
  const report = await buildReport(await getDb(), from, to);
  const kind = url.searchParams.get("jenis") === "komisi" ? "komisi" : "penjualan";
  const body =
    kind === "komisi"
      ? toCsv(
          ["barber", "layanan", "penjualan", "komisi"],
          report.commission.map((c) => [c.name, c.services, c.sales, c.commission]),
        )
      : toCsv(
          ["tanggal", "cabang", "barber", "layanan", "kategori", "sumber", "nilai"],
          report.lines.map((l) => [l.date, l.branch, l.barber, l.name, l.category, l.source, l.amount]),
        );
  return new Response(`﻿${body}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="consigliere-${kind}-${from}-${to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
