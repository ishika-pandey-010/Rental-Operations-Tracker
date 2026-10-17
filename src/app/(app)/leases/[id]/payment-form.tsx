"use client";
// US-12, US-13: record a payment, oldest-first by default or split by hand
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { formatMoney } from "@/lib/money";
import { recordPayment } from "../actions";

export const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

type OpenCharge = { charge_id: string; description: string; balance_cents: number };

export function PaymentForm({
  leaseId,
  today,
  lastMethod,
  openCharges,
  unpaid,
  hideOk,
}: {
  /** True while a page-level confirmation is showing, so two messages never stack. */
  hideOk?: boolean;
  leaseId: string;
  today: string;
  lastMethod: string;
  openCharges: OpenCharge[];
  unpaid?: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(recordPayment, {});
  return (
    <PaymentFields
      key={state.seq}
      state={state}
      action={action}
      leaseId={leaseId}
      today={today}
      lastMethod={lastMethod}
      openCharges={openCharges}
      unpaid={unpaid}
      hideOk={hideOk}
    />
  );
}

function PaymentFields({
  state,
  action,
  leaseId,
  today,
  lastMethod,
  openCharges,
  unpaid,
  hideOk,
}: {
  hideOk?: boolean;
  unpaid?: string;
  state: FormState;
  action: (fd: FormData) => void;
  leaseId: string;
  today: string;
  lastMethod: string;
  openCharges: OpenCharge[];
}) {
  const v = state.error ? (state.values ?? {}) : {};
  const [mode, setMode] = useState(v.mode === "manual" ? "manual" : "oldest");
  return (
    <form action={action}>
      <FormMessage state={hideOk ? { ...state, ok: undefined } : state} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <div className="row">
        <div className="field">
          <label htmlFor="pay-amount">Amount received</label>
          <input id="pay-amount" name="amount" inputMode="decimal" required placeholder={unpaid ? `${unpaid} unpaid` : "e.g. 1,200.00"} defaultValue={v.amount} autoFocus={Boolean(state.seq)} />
        </div>
        <div className="field">
          <label htmlFor="pay-date">Paid on</label>
          <input id="pay-date" name="paid_on" type="date" required defaultValue={v.paid_on ?? state.values?.paid_on ?? today} />
        </div>
        <div className="field">
          <label htmlFor="pay-method">Method</label>
          <select id="pay-method" name="method" defaultValue={v.method ?? state.values?.method ?? lastMethod}>
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pay-ref">
            Reference <span className="hint">Optional; can&apos;t repeat on this lease</span>
          </label>
          <input id="pay-ref" name="reference" defaultValue={v.reference} autoComplete="off" />
        </div>
      </div>
      {openCharges.length > 0 && (
        <fieldset>
          <legend>What it pays</legend>
          <label className="check">
            <input type="radio" name="mode" value="oldest" checked={mode === "oldest"} onChange={() => setMode("oldest")} />
            The oldest charges first; anything left over is kept as credit
          </label>
          <label className="check">
            <input type="radio" name="mode" value="manual" checked={mode === "manual"} onChange={() => setMode("manual")} />
            Choose which charges it pays
          </label>
          {mode === "manual" && (
            <div style={{ marginTop: "0.75rem" }}>
              {openCharges.map((c) => (
                <div className="field" key={c.charge_id}>
                  <label htmlFor={`alloc-${c.charge_id}`}>
                    Amount for {c.description}
                    <span className="hint">{formatMoney(c.balance_cents)} still owed. Leave blank to skip.</span>
                  </label>
                  <input id={`alloc-${c.charge_id}`} name={`alloc_${c.charge_id}`} inputMode="decimal" defaultValue={v[`alloc_${c.charge_id}`]} />
                </div>
              ))}
              <p className="hint">Whatever isn&apos;t given to a charge is kept as credit.</p>
            </div>
          )}
        </fieldset>
      )}
      <SubmitButton pending="Recording…">Record payment</SubmitButton>
    </form>
  );
}
