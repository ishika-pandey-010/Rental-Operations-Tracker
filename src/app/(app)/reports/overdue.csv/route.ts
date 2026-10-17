// US-22: the Overdue report as CSV.
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { validDate } from "@/components/as-of";

export async function GET(req: Request) {
  const asOf = validDate(new URL(req.url).searchParams.get("as_of") ?? undefined, todayISO());
  const supabase = await createClient();
  const { data } = await supabase.rpc("overdue_rent", { p_as_of: asOf });
  const rows = (data ?? []) as { tenant_name: string; unit_name: string; description: string; due_date: string; days_overdue: number; balance_cents: number }[];
  return csvResponse(
    `overdue-${asOf}.csv`,
    toCsv(
      ["Tenant", "Unit", "Charge", "Due", "Days overdue", "Balance"],
      rows.map((r) => [r.tenant_name, r.unit_name, r.description, r.due_date, r.days_overdue, formatMoney(r.balance_cents, null)]),
    ),
  );
}
