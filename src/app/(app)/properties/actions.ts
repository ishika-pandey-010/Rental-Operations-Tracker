"use server";
// US-03 Properties and units (FR-03)
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NOT_FOUND, dbErrorMessage } from "@/lib/errors";
import { fail, pick, succeed, type FormState } from "@/lib/form-state";

function plural(n: number, word: string) {
  return n === 0 ? `no ${word}s` : `${n} ${word}${n === 1 ? "" : "s"}`;
}

export async function addProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["name", "address", "units"]);
  const labels = values.units.split(/[,\n]/).map((l) => l.trim()).filter(Boolean);
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("create_property", {
      p_name: values.name,
      p_address: values.address || null,
      p_unit_labels: labels,
    });
    if (error) return fail(dbErrorMessage(error), values);
  } catch (err) {
    return fail(dbErrorMessage(err as Error), values);
  }
  revalidatePath("/properties");
  return succeed(`Added ${values.name} with ${plural(new Set(labels).size, "unit")}`);
}

export async function updateProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["id", "name", "address"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .update({ name: values.name, address: values.address || null })
    .eq("id", values.id)
    .select("id");
  if (error) return fail(dbErrorMessage(error), values);
  if (!data?.length) return fail(NOT_FOUND, values);
  revalidatePath(`/properties/${values.id}`);
  return succeed("Saved", values);
}

export async function addUnit(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["property_id", "label"]);
  const supabase = await createClient();
  const { error } = await supabase.from("units").insert({ property_id: values.property_id, label: values.label });
  if (error) return fail(dbErrorMessage(error), values);
  revalidatePath(`/properties/${values.property_id}`);
  return succeed(`Unit ${values.label} added`);
}

export async function archiveUnit(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["id", "property_id", "label"]);
  const supabase = await createClient();
  const { error } = await supabase.from("units").update({ archived_at: new Date().toISOString() }).eq("id", values.id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/properties/${values.property_id}`);
  redirect(`/properties/${values.property_id}?done=${encodeURIComponent(`Unit ${values.label} archived`)}`);
}

export async function archiveProperty(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = pick(formData, ["id", "name"]);
  const supabase = await createClient();
  const { error } = await supabase.from("properties").update({ archived_at: new Date().toISOString() }).eq("id", values.id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/properties");
  redirect(`/properties?done=${encodeURIComponent(`${values.name} archived`)}`);
}
