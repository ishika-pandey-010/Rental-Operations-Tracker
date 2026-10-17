"use client";
// US-15: reverse a payment from its ledger row
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { reversePayment } from "../actions";

export function ReverseForm({ leaseId, paymentId, today }: { leaseId: string; paymentId: string; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(reversePayment, {});
  return (
    <details open={Boolean(state.error)}>
      <summary style={{ cursor: "pointer" }}>Reverse…</summary>
      <form action={action} key={state.seq} style={{ marginTop: "0.5rem" }}>
        <FormMessage state={state} />
        <input type="hidden" name="lease_id" value={leaseId} />
        <input type="hidden" name="payment_id" value={paymentId} />
        <div className="row">
          <div className="field">
            <label htmlFor={`rev-reason-${paymentId}`}>Reason</label>
            <input id={`rev-reason-${paymentId}`} name="reason" required defaultValue={state.values?.reason} placeholder="bounced" />
          </div>
          <div className="field">
            <label htmlFor={`rev-date-${paymentId}`}>Reversed on</label>
            <input id={`rev-date-${paymentId}`} name="reversed_on" type="date" required defaultValue={state.values?.reversed_on ?? today} />
          </div>
          <div className="field shrink">
            <SubmitButton className="danger" pending="Reversing…">
              Reverse payment
            </SubmitButton>
          </div>
        </div>
        <p className="hint">The payment stays in the ledger, marked reversed. Whatever it paid is owed again.</p>
      </form>
    </details>
  );
}
