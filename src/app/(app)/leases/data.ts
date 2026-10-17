// Read helpers shared by the lease pages. All queries run as the landlord (RLS).
import { createClient } from "@/lib/supabase/server";

export type LeaseRow = {
  id: string;
  status: "draft" | "active" | "ended";
  start_date: string;
  end_date: string;
  due_day: number;
  move_out_date: string | null;
  deposit_waived_on: string | null;
  deposit_waiver_reason: string | null;
  renewed_from_id: string | null;
  unit: { id: string; label: string; property: { id: string; name: string } };
  tenant: { id: string; full_name: string; email: string | null; phone: string | null };
  rent: { effective_period: string; monthly_rent_cents: number }[];
};

export const LEASE_SELECT =
  "id, status, start_date, end_date, due_day, move_out_date, deposit_waived_on, deposit_waiver_reason, renewed_from_id, " +
  "unit:units(id, label, property:properties(id, name)), tenant:tenants(id, full_name, email, phone), " +
  "rent:lease_rent_schedule(effective_period, monthly_rent_cents)";

export function unitName(l: Pick<LeaseRow, "unit">) {
  return `${l.unit.property.name} · ${l.unit.label}`;
}

/** The rent row in force for a month ('YYYY-MM-DD'); the first row if the month is before the lease. */
export function rentFor(l: Pick<LeaseRow, "rent">, isoDate: string) {
  const rows = [...l.rent].sort((a, b) => a.effective_period.localeCompare(b.effective_period));
  return [...rows].reverse().find((r) => r.effective_period <= isoDate) ?? rows[0];
}

export async function getLease(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("leases").select(LEASE_SELECT).eq("id", id).maybeSingle();
  return data as unknown as LeaseRow | null;
}
