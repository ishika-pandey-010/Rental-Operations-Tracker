"use server";
// US-10 Generate monthly charges (FR-08)
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/errors";
import { fail, type FormState } from "@/lib/form-state";
import { chargeSummary } from "@/lib/charges";

export async function generateRent(_prev: FormState, formData: FormData): Promise<FormState> {
  const month = String(formData.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return fail("Choose a month", { month });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_rent_charges", { p_period: `${month}-01` }).single();
  if (error) return fail(dbErrorMessage(error), { month });
  const { created, existing } = data as { created: number; existing: number };
  revalidatePath("/charges");
  redirect(`/charges?month=${month}&done=${encodeURIComponent(chargeSummary(created, existing))}`);
}
