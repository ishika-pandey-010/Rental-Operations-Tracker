"use client";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { activateLease, createLease, recordDeposit, waiveDeposit } from "./actions";

type Option = { id: string; label: string };

export function NewLeaseForm({
  units,
  tenants,
  defaults,
}: {
  units: Option[];
  tenants: Option[];
  defaults: { unit_id?: string; tenant_id?: string; start_date: string; end_date: string };
}) {
  const [state, action] = useActionState<FormState, FormData>(createLease, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="card" key={state.seq}>
      <FormMessage state={state} />
      <div className="row">
        <div className="field">
          <label htmlFor="l-unit">Unit</label>
          <select id="l-unit" name="unit_id" required defaultValue={v.unit_id ?? defaults.unit_id ?? ""}>
            <option value="" disabled>
              Choose a unit
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="l-tenant">Tenant</label>
          <select id="l-tenant" name="tenant_id" required defaultValue={v.tenant_id ?? defaults.tenant_id ?? ""}>
            <option value="" disabled>
              Choose a tenant
            </option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="l-start">Start date</label>
          <input id="l-start" name="start_date" type="date" required defaultValue={v.start_date ?? defaults.start_date} />
        </div>
        <div className="field">
          <label htmlFor="l-end">End date</label>
          <input id="l-end" name="end_date" type="date" required defaultValue={v.end_date ?? defaults.end_date} />
        </div>
        <div className="field">
          <label htmlFor="l-rent">Monthly rent</label>
          <input id="l-rent" name="rent" inputMode="decimal" required placeholder="1,200.00" defaultValue={v.rent} />
        </div>
        <div className="field">
          <label htmlFor="l-due">
            Due day <span className="hint">1 to 28</span>
          </label>
          <input id="l-due" name="due_day" type="number" min={1} max={28} required defaultValue={v.due_day ?? "1"} />
        </div>
      </div>
      <SubmitButton>Save lease</SubmitButton>
    </form>
  );
}

export function DepositForm({
  leaseId,
  today,
  suggested,
  canActivate,
  hideOk,
}: {
  hideOk?: boolean;
  leaseId: string;
  today: string;
  suggested?: string;
  canActivate: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(recordDeposit, {});
  const v = state.values ?? {};
  return (
    <form action={action} key={state.seq}>
      <FormMessage state={hideOk ? { ...state, ok: undefined } : state} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <div className="row">
        <div className="field">
          <label htmlFor="d-amount">Amount</label>
          <input id="d-amount" name="amount" inputMode="decimal" required placeholder={`e.g. ${suggested ?? "1,200.00"}`} defaultValue={v.amount} />
        </div>
        <div className="field">
          <label htmlFor="d-date">Received on</label>
          <input id="d-date" name="received_on" type="date" required defaultValue={v.received_on ?? today} />
        </div>
        <div className="field shrink actions" style={{ marginTop: 0 }}>
          {canActivate && (
            <SubmitButton name="then" value="activate" pending="Saving…">
              Record and activate
            </SubmitButton>
          )}
          <SubmitButton className="secondary">Record deposit</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function WaiverForm({ leaseId, today }: { leaseId: string; today: string }) {
  const [state, action] = useActionState<FormState, FormData>(waiveDeposit, {});
  const v = state.values ?? {};
  return (
    <details>
      <summary>No deposit on this lease? Record a waiver</summary>
      <form action={action} key={state.seq} style={{ marginTop: "0.75rem" }}>
        <FormMessage state={state} />
        <input type="hidden" name="lease_id" value={leaseId} />
        <div className="row">
          <div className="field">
            <label htmlFor="w-date">Waived on</label>
            <input id="w-date" name="waived_on" type="date" required defaultValue={v.waived_on ?? today} />
          </div>
          <div className="field">
            <label htmlFor="w-reason">Reason</label>
            <input id="w-reason" name="reason" required defaultValue={v.reason} placeholder="e.g. Family member" />
          </div>
          <div className="field shrink">
            <SubmitButton className="secondary">Waive deposit</SubmitButton>
          </div>
        </div>
      </form>
    </details>
  );
}

export function ActivateButton({ leaseId }: { leaseId: string }) {
  const [state, action] = useActionState<FormState, FormData>(activateLease, {});
  return (
    <form action={action}>
      <FormMessage state={state} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <SubmitButton pending="Activating…">Activate lease</SubmitButton>
    </form>
  );
}
