// Signs up real users through Supabase Auth and returns clients that call
// the REST API with each user's JWT, exactly as the app's server does.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export async function signedUpClient(label = "api"): Promise<{ client: SupabaseClient; userId: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Run `make env` first: NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY are missing");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signUp({
    email: `${label}-${randomUUID().slice(0, 8)}@api.test`,
    password: "api-test-password-1",
  });
  if (error || !data.user) throw error ?? new Error("sign-up returned no user");
  return { client, userId: data.user.id };
}

export function anonClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
}
