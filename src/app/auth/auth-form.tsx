"use client";
import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton, type FormState } from "@/components/form";
import { signIn, signUp } from "./actions";

export function AuthForm({ mode, next }: { mode: "signin" | "signup"; next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(mode === "signin" ? signIn : signUp, {});
  const isSignIn = mode === "signin";
  return (
    <form action={action} className="card" noValidate={false}>
      <FormMessage state={state} />
      {state.error?.includes("Sign in instead") && (
        <p>
          <Link href="/signin">Sign in instead</Link>
        </p>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus={!state.values?.email}
          defaultValue={state.values?.email}
          key={state.values?.email}
        />
      </div>
      <div className="field">
        <label htmlFor="password">
          Password
          {!isSignIn && <span className="hint">At least 8 characters</span>}
        </label>
        {/* After a failed attempt the email is kept, so the cursor goes straight to the password. */}
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignIn ? "current-password" : "new-password"}
          required
          autoFocus={Boolean(state.values?.email)}
          key={`pw-${state.error ?? ""}-${state.values?.email ?? ""}`}
        />
      </div>
      <SubmitButton pending={isSignIn ? "Signing in…" : "Creating account…"}>{isSignIn ? "Sign in" : "Create account"}</SubmitButton>
    </form>
  );
}
