"use client";
// US-08: renew as a new lease linked to this one
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { formatMoney } from "@/lib/money";
import { renewLease } from "../actions";

export function RenewForm({
  leaseId,
  defaults,
  heldCents,
}: {
  leaseId: string;
  defaults: { start_date: string; end_date: string; rent: string };
  heldCents: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(renewLease, {});
  const v = state.values ?? {};
  return (
    <details open={Boolean(state.error)}>
      <summary style={{ cursor: "pointer" }}>Renew this lease</summary>
      <form action={action} key={state.seq} style={{ marginTop: "0.75rem" }}>
        <FormMessage state={state} />
        <input type="hidden" name="lease_id" value={leaseId} />
        <div className="row">
          <div className="field">
            <label htmlFor="rn-start">New start date</label>
            <input id="rn-start" name="start_date" type="date" required defaultValue={v.start_date ?? defaults.start_date} />
          </div>
          <div className="field">
            <label htmlFor="rn-end">New end date</label>
            <input id="rn-end" name="end_date" type="date" required defaultValue={v.end_date ?? defaults.end_date} />
          </div>
          <div className="field">
            <label htmlFor="rn-rent">Monthly rent from the renewal</label>
            <input id="rn-rent" name="rent" inputMode="decimal" required defaultValue={v.rent ?? defaults.rent} />
          </div>
        </div>
        {heldCents > 0 && (
          <label className="check field">
            <input type="checkbox" name="carry" defaultChecked={state.error ? v.carry === "on" : true} />
            Carry the {formatMoney(heldCents)} deposit over to the new lease (no refund on this one)
          </label>
        )}
        <SubmitButton pending="Renewing…">Renew lease</SubmitButton>
        <p className="hint">This lease ends on its end date and stays in the history; the renewal is a new lease for the same unit and tenant.</p>
      </form>
    </details>
  );
}
