"use client";
// Shared form pieces. Every form shows its own pending state and keeps what
// the landlord typed when the server says no, so nothing has to be retyped.
import { useFormStatus } from "react-dom";

export type FormState = {
  error?: string;
  ok?: string;
  values?: Record<string, string>;
  /** Bumped on success so forms that should clear can re-mount. */
  done?: number;
};

export function SubmitButton({
  children,
  pending: pendingLabel,
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending} name={name} value={value}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="alert error">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="alert ok">
        {state.ok}
      </p>
    );
  return null;
}
