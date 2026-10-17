"use client";
// US-23 + US-10: this month's rent from the dashboard, one click
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { generateRentHere } from "./charges/actions";

export function DashboardGenerate({ month, label }: { month: string; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(generateRentHere, {});
  return (
    <form action={action} className="card">
      <FormMessage state={state} />
      <input type="hidden" name="month" value={month} />
      <SubmitButton pending="Generating…">Generate rent for {label}</SubmitButton>{" "}
      <span className="hint" style={{ display: "inline" }}>
        Safe to press twice; it never charges a month twice.
      </span>
    </form>
  );
}
