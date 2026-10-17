"use client";
// US-07: set a new rent from a month that isn't charged yet
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { changeRent } from "../actions";

export function RentChangeForm({ leaseId, fromMonth }: { leaseId: string; fromMonth: string }) {
  const [state, action] = useActionState<FormState, FormData>(changeRent, {});
  const v = state.values ?? {};
  return (
    <details open={Boolean(state.error)}>
      <summary style={{ cursor: "pointer" }}>Change the rent</summary>
      <form action={action} key={state.seq} style={{ marginTop: "0.75rem" }}>
        <FormMessage state={state} />
        <input type="hidden" name="lease_id" value={leaseId} />
        <div className="row">
          <div className="field">
            <label htmlFor="rc-rent">New monthly rent</label>
            <input id="rc-rent" name="rent" inputMode="decimal" required defaultValue={v.rent} />
          </div>
          <div className="field">
            <label htmlFor="rc-from">
              From month <span className="hint">Months already charged keep their old rent</span>
            </label>
            <input id="rc-from" name="from_month" type="month" required defaultValue={v.from_month ?? fromMonth} />
          </div>
          <div className="field shrink">
            <SubmitButton className="secondary">Set new rent</SubmitButton>
          </div>
        </div>
      </form>
    </details>
  );
}
