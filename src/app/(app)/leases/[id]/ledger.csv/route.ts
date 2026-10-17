// US-22: the lease ledger as CSV, same rows and columns as the page.
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { todayISO } from "@/lib/dates";
import { getLease } from "../../data";
import { ledgerLines } from "../ledger-rows";
import type { LedgerRow } from "../money";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lease = await getLease(id);
  if (!lease) return new Response("Not found", { status: 404 });
  const supabase = await createClient();
  const [{ data: rows }, { data: reversedRows }] = await Promise.all([
    supabase.from("lease_ledger").select("*").eq("lease_id", id).order("seq"),
    supabase.from("payment_balances").select("payment_id").eq("lease_id", id).eq("reversed", true),
  ]);
  const reversed = new Set((reversedRows ?? []).map((r) => r.payment_id as string));
  const lines = ledgerLines((rows ?? []) as LedgerRow[], reversed, null);
  const slug = `${lease.unit.property.name}-${lease.unit.label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return csvResponse(
    `ledger-${slug}-${todayISO()}.csv`,
    toCsv(["Date", "Entry", "Amount", "Balance"], lines.map((l) => [l.date, l.entry, l.amount, l.balance])),
  );
}
