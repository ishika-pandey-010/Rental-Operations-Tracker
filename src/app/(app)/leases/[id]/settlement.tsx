"use client";
// US-18, US-19: deductions and the refund for an ended lease
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { formatMoney } from "@/lib/money";
import { addDeduction, payRefund } from "../actions";

export function DeductionForm({ leaseId, hideOk }: { leaseId: string; hideOk?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(addDeduction, {});
  const v = state.values ?? {};
  return (
    <form action={action} key={state.seq}>
      <FormMessage state={hideOk ? { ...state, ok: undefined } : state} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <div className="row">
        <div className="field">
          <label htmlFor="ded-amount">Deduction amount</label>
          <input id="ded-amount" name="amount" inputMode="decimal" required defaultValue={v.amount} autoFocus={Boolean(state.seq)} />
        </div>
        <div className="field">
          <label htmlFor="ded-reason">Reason</label>
          <input id="ded-reason" name="reason" required defaultValue={v.reason} placeholder="e.g. carpet cleaning" />
        </div>
        <div className="field shrink">
          <SubmitButton className="secondary">Add deduction</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function RefundForm({ leaseId, dueCents, today }: { leaseId: string; dueCents: number; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(payRefund, {});
  const label = dueCents > 0 ? `Mark ${formatMoney(dueCents)} refund paid` : "Close the deposit (nothing to refund)";
  return (
    <form action={action} key={state.seq}>
      <FormMessage state={state} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <input type="hidden" name="amount_cents" value={dueCents} />
      <div className="row">
        <div className="field">
          <label htmlFor="ref-date">Refund paid on</label>
          <input id="ref-date" name="paid_on" type="date" required defaultValue={state.values?.paid_on ?? today} />
        </div>
        <div className="field shrink">
          <SubmitButton pending="Saving…">{label}</SubmitButton>
        </div>
      </div>
      <p className="hint">Once the refund is marked paid, the deposit is closed: no more deductions.</p>
    </form>
  );
}
