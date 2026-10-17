"use client";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { generateRent } from "./actions";

export function GenerateForm({ month }: { month: string }) {
  const [state, action] = useActionState<FormState, FormData>(generateRent, {});
  return (
    <form action={action} className="card">
      <FormMessage state={state} />
      <div className="row">
        <div className="field">
          <label htmlFor="g-month">
            Month <span className="hint">Running it twice for a month never charges twice</span>
          </label>
          <input id="g-month" name="month" type="month" required defaultValue={state.values?.month ?? month} />
        </div>
        <div className="field shrink">
          <SubmitButton pending="Generating…">Generate rent</SubmitButton>
        </div>
      </div>
    </form>
  );
}
