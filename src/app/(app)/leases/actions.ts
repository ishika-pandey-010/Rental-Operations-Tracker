"use server";
// US-05 Create a lease · US-06 Deposit gate · US-17 Record a deposit
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NOT_FOUND, dbErrorMessage } from "@/lib/errors";
import { fail, pick, succeed, type FormState } from "@/lib/form-state";
import { formatMoney, parseMoney, positiveAmount } from "@/lib/money";
import { monthName } from "@/lib/dates";

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

// US-12 Record a payment · US-13 default and manual allocation
export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "amount", "paid_on", "method", "reference", "mode"]);
  const allocFields = [...formData.keys()].filter((k) => k.startsWith("alloc_"));
  for (const k of allocFields) values[k] = String(formData.get(k) ?? "").trim();

  const amount = positiveAmount(values.amount, "payment");
  if ("error" in amount) return fail(amount.error, values);

  let allocations: { charge_id: string; amount_cents: number }[] | null = null;
  if (values.mode === "manual") {
    allocations = [];
    for (const k of allocFields) {
      if (!values[k]) continue;
      const part = positiveAmount(values[k]);
      if ("error" in part) return fail(part.error, values);
      allocations.push({ charge_id: k.slice("alloc_".length), amount_cents: part.cents });
    }
    // An early, friendlier version of the check the allocation trigger makes
    // anyway. BigInt keeps it integer-only (CLAUDE.md money rules).
    const total = allocations.reduce((s, a) => s + BigInt(a.amount_cents), 0n);
    if (total > BigInt(amount.cents))
      return fail(
        `The amounts for each charge add up to ${formatMoney(total)}, more than the ${formatMoney(amount.cents)} received`,
        values,
      );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("record_payment", {
      p_lease_id: values.lease_id,
      p_amount_cents: amount.cents,
      p_paid_on: values.paid_on,
      p_method: values.method,
      p_reference: values.reference || null,
      p_allocations: allocations,
    });
    if (error) return fail(dbErrorMessage(error), values);
  } catch (err) {
    return fail(dbErrorMessage(err as Error), values);
  }
  revalidatePath(`/leases/${values.lease_id}`);
  return succeed(`Payment of ${formatMoney(amount.cents)} recorded`, { method: values.method, paid_on: values.paid_on });
}

// US-15 Reverse a bounced payment
export async function reversePayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "payment_id", "reason", "reversed_on"]);
  if (!values.reason) return fail("Add a reason, for example 'bounced'", values);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_payment", {
    p_payment_id: values.payment_id,
    p_reversed_on: values.reversed_on,
    p_reason: values.reason,
  });
  if (error) return fail(dbErrorMessage(error), values);
  revalidatePath(`/leases/${values.lease_id}`);
  done(values.lease_id, "Payment reversed. Its charges are open again.");
  return {};
}

// US-09 Early move-out (also the normal end of a lease)
export async function recordMoveOut(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "move_out_date"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_out", { p_lease_id: values.lease_id, p_move_out_date: values.move_out_date });
  if (error) return fail(dbErrorMessage(error), values);
  revalidatePath(`/leases/${values.lease_id}`);
  revalidatePath("/leases");
  done(values.lease_id, `Move-out on ${values.move_out_date} recorded. The lease has ended.`);
  return {};
}

// US-18 Deposit deductions
export async function addDeduction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "amount", "reason"]);
  const amount = positiveAmount(values.amount, "deduction");
  if ("error" in amount) return fail(amount.error, values);
  if (!values.reason) return fail("Add a reason", values);
  const supabase = await createClient();
  const { error } = await supabase
    .from("deposit_deductions")
    .insert({ lease_id: values.lease_id, amount_cents: amount.cents, reason: values.reason });
  if (error) return fail(dbErrorMessage(error), values);
  revalidatePath(`/leases/${values.lease_id}`);
  return succeed(`Deduction of ${formatMoney(amount.cents)} added`);
}

// US-19 Mark the refund paid
export async function payRefund(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "amount_cents", "paid_on"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_refund", {
    p_lease_id: values.lease_id,
    p_amount_cents: Number(values.amount_cents),
    p_paid_on: values.paid_on,
  });
  if (error) return fail(dbErrorMessage(error), values);
  revalidatePath(`/leases/${values.lease_id}`);
  revalidatePath("/reports/refunds");
  done(values.lease_id, `Refund of ${formatMoney(values.amount_cents)} marked paid`);
  return {};
}

// US-07 Change rent mid-lease
export async function changeRent(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "rent", "from_month"]);
  const amount = positiveAmount(values.rent, "new rent");
  if ("error" in amount) return fail(amount.error, values);
  if (!/^\d{4}-\d{2}$/.test(values.from_month)) return fail("Choose the month the new rent starts", values);
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_rent", {
    p_lease_id: values.lease_id,
    p_from: `${values.from_month}-01`,
    p_monthly_rent_cents: amount.cents,
  });
  if (error) return fail(dbErrorMessage(error), values);
  revalidatePath(`/leases/${values.lease_id}`);
  done(values.lease_id, `Rent is ${formatMoney(amount.cents)} a month from ${monthName(values.from_month)}`);
  return {};
}

// US-08 Renew a lease
export async function renewLease(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["lease_id", "start_date", "end_date", "rent", "carry"]);
  const amount = positiveAmount(values.rent, "monthly rent");
  if ("error" in amount) return fail(amount.error, values);
  const carry = values.carry === "on";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("renew_lease", {
    p_lease_id: values.lease_id,
    p_start: values.start_date,
    p_end: values.end_date,
    p_monthly_rent_cents: amount.cents,
    p_carry_deposit: carry,
  });
  if (error) return fail(dbErrorMessage(error), values);
  const newId = data as string;
  const { data: held } = await supabase.from("lease_deposit_summary").select("held_cents").eq("lease_id", newId).single();
  revalidatePath("/leases");
  revalidatePath(`/leases/${values.lease_id}`);
  const span = `Renewed from ${values.start_date} to ${values.end_date}.`;
  done(
    newId,
    held && held.held_cents > 0
      ? `${span} The ${formatMoney(held.held_cents)} deposit carried over and the lease is active.`
      : `${span} Record a deposit or a waiver, then activate it.`,
  );
  return {};
}
