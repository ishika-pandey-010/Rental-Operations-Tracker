"use client";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import type { FormState } from "@/lib/form-state";
import { addProperty, addUnit, archiveProperty, archiveUnit, updateProperty } from "./actions";

export function AddPropertyForm({ focus }: { focus: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(addProperty, {});
  return (
    <form action={action} className="card" key={state.seq}>
      <h2 style={{ marginTop: 0 }}>Add a property</h2>
      <FormMessage state={state} />
      <div className="row">
        <div className="field">
          <label htmlFor="p-name">Property name</label>
          <input id="p-name" name="name" required autoFocus={focus || Boolean(state.error)} defaultValue={state.values?.name} placeholder="12 Elm St" />
        </div>
        <div className="field">
          <label htmlFor="p-address">
            Address <span className="hint">Optional</span>
          </label>
          <input id="p-address" name="address" defaultValue={state.values?.address} />
        </div>
        <div className="field">
          <label htmlFor="p-units">
            Units <span className="hint">Labels separated by commas, e.g. A, B</span>
          </label>
          <input id="p-units" name="units" defaultValue={state.values?.units} placeholder="A, B" />
        </div>
      </div>
      <SubmitButton pending="Adding…">Add property</SubmitButton>
    </form>
  );
}

export function PropertyDetailsForm({ id, name, address }: { id: string; name: string; address: string | null }) {
  const [state, action] = useActionState<FormState, FormData>(updateProperty, {});
  return (
    <form action={action} className="card" key={state.seq}>
      <h2 style={{ marginTop: 0 }}>Details</h2>
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <div className="row">
        <div className="field">
          <label htmlFor="d-name">Name</label>
          <input id="d-name" name="name" required defaultValue={state.values?.name ?? name} />
        </div>
        <div className="field">
          <label htmlFor="d-address">Address</label>
          <input id="d-address" name="address" defaultValue={state.values?.address ?? address ?? ""} />
        </div>
      </div>
      <SubmitButton className="secondary">Save details</SubmitButton>
    </form>
  );
}

export function AddUnitForm({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState<FormState, FormData>(addUnit, {});
  return (
    <form action={action} key={state.seq}>
      <FormMessage state={state} />
      <input type="hidden" name="property_id" value={propertyId} />
      <div className="row">
        <div className="field">
          <label htmlFor="u-label">New unit label</label>
          <input id="u-label" name="label" required defaultValue={state.values?.label} autoFocus={Boolean(state.seq)} />
        </div>
        <div className="field shrink">
          <SubmitButton pending="Adding…">Add unit</SubmitButton>
        </div>
      </div>
    </form>
  );
}

export function ArchiveUnitButton({ id, propertyId, label }: { id: string; propertyId: string; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(archiveUnit, {});
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="property_id" value={propertyId} />
      <input type="hidden" name="label" value={label} />
      {state.error && (
        <span role="alert" className="alert error" style={{ display: "inline-block", margin: "0 0.5rem" }}>
          {state.error}
        </span>
      )}
      <SubmitButton className="link" pending="Archiving…" ariaLabel={`Archive unit ${label}`}>
        Archive
      </SubmitButton>
    </form>
  );
}

export function ArchivePropertyButton({ id, name }: { id: string; name: string }) {
  const [state, action] = useActionState<FormState, FormData>(archiveProperty, {});
  return (
    <form action={action}>
      <FormMessage state={state} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="name" value={name} />
      <SubmitButton className="danger" pending="Archiving…">
        Archive property
      </SubmitButton>
    </form>
  );
}
