"use server";
// US-04 Tenants (FR-04)
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NOT_FOUND, dbErrorMessage } from "@/lib/errors";
import { fail, pick, succeed, type FormState } from "@/lib/form-state";

const FIELDS = ["full_name", "email", "phone"];

function row(values: Record<string, string>) {
  return { full_name: values.full_name, email: values.email || null, phone: values.phone || null };
}

export async function addTenant(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, FIELDS);
  // Same rule as the database's tenants_contact_required, checked first so
  // the landlord gets the answer without a round trip.
  if (!values.email && !values.phone) return fail("Add a phone number or email", values);
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("tenants").insert(row(values));
    if (error) return fail(dbErrorMessage(error), values);
  } catch (err) {
    return fail(dbErrorMessage(err as Error), values);
  }
  revalidatePath("/tenants");
  return succeed(`Added ${values.full_name}`);
}

export async function updateTenant(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["id", ...FIELDS]);
  if (!values.email && !values.phone) return fail("Add a phone number or email", values);
  const supabase = await createClient();
  const { data, error } = await supabase.from("tenants").update(row(values)).eq("id", values.id).select("id");
  if (error) return fail(dbErrorMessage(error), values);
  if (!data?.length) return fail(NOT_FOUND, values);
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${values.id}`);
  return succeed("Saved", values);
}

export async function archiveTenant(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["id", "full_name"]);
  const supabase = await createClient();
  const { error } = await supabase.from("tenants").update({ archived_at: new Date().toISOString() }).eq("id", values.id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/tenants");
  redirect(`/tenants?done=${encodeURIComponent(`${values.full_name} archived`)}`);
}
