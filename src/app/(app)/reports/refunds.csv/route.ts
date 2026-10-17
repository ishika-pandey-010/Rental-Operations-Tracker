// US-22: the Pending refunds report as CSV.
import { createClient } from "@/lib/supabase/server";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { validDate } from "@/components/as-of";

export async function GET(req: Request) {
  const asOf = validDate(new URL(req.url).searchParams.get("as_of") ?? undefined, todayISO());
  const supabase = await createClient();
  const { data } = await supabase.rpc("pending_refunds", { p_as_of: asOf });
  const rows = (data ?? []) as {
    tenant_name: string;
    unit_name: string;
    ended_on: string;
    days_since_end: number;
    held_cents: number;
    deductions_cents: number;
    refund_due_cents: number;
  }[];
  return csvResponse(
    `pending-refunds-${asOf}.csv`,
    toCsv(
      ["Tenant", "Unit", "Ended", "Days since end", "Held", "Deductions", "Refund due"],
      rows.map((r) => [
        r.tenant_name,
        r.unit_name,
        r.ended_on,
        r.days_since_end,
        formatMoney(r.held_cents, null),
        formatMoney(r.deductions_cents, null),
        formatMoney(r.refund_due_cents, null),
      ]),
    ),
  );
}
