// What every server action returns to its form. `seq` changes on every
// response, and forms use it as their React key: after a success the form
// re-mounts empty; after an error it re-mounts with what the landlord typed.
export type FormState = {
  error?: string;
  ok?: string;
  values?: Record<string, string>;
  seq?: number;
};

export const fail = (error: string, values?: Record<string, string>): FormState => ({ error, values, seq: Date.now() });
export const succeed = (ok: string, values?: Record<string, string>): FormState => ({ ok, values, seq: Date.now() });

export function pick(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "").trim()]));
}
