// A plain GET form, so a report for any date is a link that can be shared or bookmarked.
export function AsOfForm({ asOf, action }: { asOf: string; action: string }) {
  return (
    <form method="get" action={action} className="row" style={{ marginBottom: "1rem", maxWidth: 420 }}>
      <div className="field">
        <label htmlFor="as-of">As of</label>
        <input id="as-of" name="as_of" type="date" defaultValue={asOf} required />
      </div>
      <div className="field shrink">
        <button type="submit" className="secondary">
          Show
        </button>
      </div>
    </form>
  );
}

export function validDate(value: string | undefined, fallback: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}
