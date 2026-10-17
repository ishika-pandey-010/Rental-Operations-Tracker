"use client";
// Shared form pieces. Every form shows its own pending state and keeps what
// the landlord typed when the server says no, so nothing has to be retyped.
import { useEffect } from "react";
import { useFormStatus } from "react-dom";

import type { FormState } from "@/lib/form-state";
export type { FormState };

export function SubmitButton({
  children,
  pending: pendingLabel,
  className,
  name,
  value,
  ariaLabel,
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
  name?: string;
  value?: string;
  ariaLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-label={ariaLabel} name={name} value={value}>
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

/**
 * One-line confirmation after an action that redirected (the `done` query
 * parameter). The parameter is removed from the address once shown, so the
 * message doesn't come back beside the next action's message or on reload.
 */
export function Flash({ message }: { message?: string }) {
  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("done")) return;
    url.searchParams.delete("done");
    window.history.replaceState(null, "", url);
  }, [message]);
  if (!message) return null;
  return (
    <p role="status" className="alert ok">
      {message}
    </p>
  );
}
