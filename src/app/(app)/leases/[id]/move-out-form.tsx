"use client";
// US-09: record when the tenant moved out
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { recordMoveOut } from "../actions";

export function MoveOutForm({ leaseId, defaultDate, min, max }: { leaseId: string; defaultDate: string; min: string; max: string }) {
  const [state, action] = useActionState<FormState, FormData>(recordMoveOut, {});
  return (
    <form action={action} key={state.seq}>
      <FormMessage state={state} />
      <input type="hidden" name="lease_id" value={leaseId} />
      <div className="row">
        <div className="field">
          <label htmlFor="mo-date">
            Move-out date <span className="hint">The last day the tenant had the unit</span>
          </label>
          <input id="mo-date" name="move_out_date" type="date" required defaultValue={state.values?.move_out_date ?? defaultDate} />
        </div>
        <div className="field shrink">
          <SubmitButton className="danger" pending="Recording…">
            Record move-out
          </SubmitButton>
        </div>
      </div>
      <p className="hint">
        The lease ends. The move-out month is charged only up to that day, months already charged after it are cancelled, and
        anything the tenant paid for those days becomes credit. This can&apos;t be undone. Allowed range: {min} to {max}.
      </p>
    </form>
  );
}
