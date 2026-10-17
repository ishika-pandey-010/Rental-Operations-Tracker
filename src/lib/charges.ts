// US-10 AC2: "0 new charges, 3 already existed".
export function chargeSummary(created: number, existing: number): string {
  return `${created} new charge${created === 1 ? "" : "s"}, ${existing} already existed`;
}
