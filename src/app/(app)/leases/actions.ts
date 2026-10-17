"use server";
// US-05 Create a lease · US-06 Deposit gate · US-17 Record a deposit
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NOT_FOUND, dbErrorMessage } from "@/lib/errors";
import { fail, pick, succeed, type FormState } from "@/lib/form-state";
import { formatMoney, parseMoney } from "@/lib/money";

const done = (id: string, message: string) => redirect(`/leases/${id}?done=${encodeURIComponent(message)}`);

export async function createLease(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["unit_id", "tenant_id", "start_date", "end_date", "rent", "due_day"]);
  const rent = parseMoney(values.rent);
  if (rent === null) return fail("Enter the monthly rent as an amount like 1,200.00", values);
  if (!values.unit_id) return fail("Choose a unit", values);
  if (!values.tenant_id) return fail("Choose a tenant", values);
  let id: string;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_lease", {
      p_unit_id: values.unit_id,
      p_tenant_id: values.tenant_id,
      p_start: values.start_date,
      p_end: values.end_date,
      p_monthly_rent_cents: rent,
      p_due_day: Number(values.due_day),
    });
    if (error) return fail(dbErrorMessage(error), values);
    id = data as string;
  } catch (err) {
    return fail(dbErrorMessage(err as Error), values);
  }
  revalidatePath("/leases");
  done(id, "Lease saved as draft. Record the deposit or a waiver, then activate it.");
  return {};
}

export async function recordDeposit(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "amount", "received_on"]);
  const cents = parseMoney(values.amount);
  if (cents === null) return fail("Enter the deposit as an amount like 1,200.00", values);
  const supabase = await createClient();
  const { error } = await supabase
    .from("deposits")
    .insert({ lease_id: values.lease_id, amount_cents: cents, received_on: values.received_on });
  if (error) return fail(dbErrorMessage(error), values);
  revalidatePath(`/leases/${values.lease_id}`);
  const recorded = `Deposit of ${formatMoney(cents)} recorded`;
  // "Record and activate": the deposit is saved either way; if activation is
  // refused (say, an overlapping lease) the reason is shown with the deposit kept.
  if (formData.get("then") === "activate") {
    const { error: activateError } = await supabase.from("leases").update({ status: "active" }).eq("id", values.lease_id);
    if (activateError) return fail(`${recorded}, but the lease wasn't activated: ${dbErrorMessage(activateError)}`);
    revalidatePath("/leases");
    done(values.lease_id, `${recorded}. Lease is active.`);
  }
  return succeed(recorded);
}

export async function waiveDeposit(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "waived_on", "reason"]);
  if (!values.reason) return fail("Add a reason for the waiver", values);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leases")
    .update({ deposit_waived_on: values.waived_on, deposit_waiver_reason: values.reason })
    .eq("id", values.lease_id)
    .select("id");
  if (error) return fail(dbErrorMessage(error), values);
  if (!data?.length) return fail(NOT_FOUND, values);
  revalidatePath(`/leases/${values.lease_id}`);
  return succeed("Deposit waived");
}

export async function activateLease(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("lease_id"));
  const supabase = await createClient();
  const { data, error } = await supabase.from("leases").update({ status: "active" }).eq("id", id).select("id");
  if (error) return fail(dbErrorMessage(error));
  if (!data?.length) return fail(NOT_FOUND);
  revalidatePath(`/leases/${id}`);
  revalidatePath("/leases");
  done(id, "Lease is active");
  return {};
}
