// US-22: RFC 4180 CSV. Amounts arrive as plain decimals ("1200.00") from
// formatMoney(cents, null), so spreadsheets read them as numbers.

const NUMBER = /^-?\d+(\.\d+)?$/;

function cell(value: string | number | null | undefined): string {
  let text = value == null ? "" : String(value);
  // A cell starting with = + - @ runs as a formula in Excel and Sheets. Tenant
  // names and deduction reasons are typed by people, so neutralise them, but
  // leave real numbers such as -771.43 alone.
  if (/^[=+\-@\t\r]/.test(text) && !NUMBER.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
