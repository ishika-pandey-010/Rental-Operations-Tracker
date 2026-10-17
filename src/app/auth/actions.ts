"use server";
// US-01 Sign up, sign in and sign out (FR-01)
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage, safeNext } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";

function credentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: String(formData.get("next") ?? ""),
  };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const { email, password, next } = credentials(formData);
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: authErrorMessage(error), values: { email } };
  } catch (err) {
    return { error: authErrorMessage(err as Error), values: { email } };
  }
  redirect(safeNext(next));
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const { email, password } = credentials(formData);
  if (password.length < 8) return { error: authErrorMessage({ code: "weak_password" }), values: { email } };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: authErrorMessage(error), values: { email } };
    // With email confirmation on (hosted), there is no session until the
    // landlord clicks the link; say so instead of bouncing them to sign-in.
    if (!data.session) return { ok: `Check ${email} for a confirmation link, then sign in.`, values: { email } };
  } catch (err) {
    return { error: authErrorMessage(err as Error), values: { email } };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
