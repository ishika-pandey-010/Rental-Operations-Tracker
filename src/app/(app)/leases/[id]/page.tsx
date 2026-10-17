import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash } from "@/components/form";
import { formatMoney, centsToInput } from "@/lib/money";
import { monthName, todayISO } from "@/lib/dates";
import { getLease, unitName } from "../data";
import { ActivateButton, DepositForm, WaiverForm } from "../forms";
import { ChargesTable, LedgerTable, type ChargeBalance, type LedgerRow } from "./money";
import { PaymentForm } from "./payment-form";
import { MoveOutForm } from "./move-out-form";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// US-05, US-06, US-17: one lease, its terms, its deposit and its activation
export default async function LeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  if (!UUID_RE.test(id)) notFound();
  const lease = await getLease(id);
  if (!lease) notFound();

  const supabase = await createClient();
  const [{ data: deposits }, { data: summary }, { data: chargeData }, { data: creditRow }, { data: ledgerData }, { data: lastPayment }, { data: auth }] =
    await Promise.all([
      supabase.from("deposits").select("id, amount_cents, received_on, note").eq("lease_id", id).order("received_on"),
      supabase.from("lease_deposit_summary").select("received_cents, held_cents").eq("lease_id", id).single(),
      supabase
        .from("charge_balances")
        .select("charge_id, description, due_date, value_cents, allocated_cents, balance_cents, status")
        .eq("lease_id", id)
        .order("due_date"),
      supabase.from("lease_credit").select("credit_cents").eq("lease_id", id).single(),
      supabase.from("lease_ledger").select("*").eq("lease_id", id).order("seq"),
      supabase.from("payments").select("method").eq("lease_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.auth.getUser(),
    ]);
  const { data: reversedRows } = await supabase.from("payment_balances").select("payment_id").eq("lease_id", id).eq("reversed", true);
  const reversed = new Set((reversedRows ?? []).map((r) => r.payment_id as string));
  const charges = (chargeData ?? []) as ChargeBalance[];
  const ledger = (ledgerData ?? []) as LedgerRow[];
  // A second query to sum in Postgres isn't worth it; BigInt keeps the sum integer-only.
  const owed = charges.reduce((s, c) => s + BigInt(c.balance_cents), 0n);
  const credit = creditRow?.credit_cents ?? 0;
  const today = todayISO();
  const rent = [...lease.rent].sort((a, b) => a.effective_period.localeCompare(b.effective_period));
  const statusLabel = lease.status[0].toUpperCase() + lease.status.slice(1);

  return (
    <>
      <p>
        <Link href="/leases">← Leases</Link>
      </p>
      <div className="page-head">
        <h1>
          {unitName(lease)}: {lease.tenant.full_name}
        </h1>
        <span className={`badge ${lease.status}`} data-testid="lease-status">
          {statusLabel}
        </span>
      </div>
      <Flash message={done} />
      {lease.status === "active" && lease.end_date < today && (
        <p className="alert warn">Past end date: record the move-out below. No rent is charged after {lease.end_date}.</p>
      )}

      {lease.status !== "draft" && (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="label">Unpaid charges (due or not yet due)</div>
              <div className="value" data-testid="lease-owed">
                {formatMoney(owed)}
              </div>
            </div>
            <div className="tile">
              <div className="label">Credit (paid ahead)</div>
              <div className="value" data-testid="lease-credit">
                {formatMoney(credit)}
              </div>
            </div>
          </div>

          <section className="card" aria-labelledby="pay-h">
            <h2 id="pay-h" style={{ marginTop: 0 }}>
              Record a payment
            </h2>
            <PaymentForm
              hideOk={Boolean(done)}
              leaseId={lease.id}
              today={today}
              lastMethod={lastPayment?.method ?? "bank_transfer"}
              openCharges={charges.filter((c) => c.balance_cents > 0)}
              unpaid={owed > 0n ? formatMoney(owed, null) : undefined}
            />
          </section>

          <section className="card" aria-labelledby="charges-h">
            <h2 id="charges-h" style={{ marginTop: 0 }}>
              Charges
            </h2>
            <ChargesTable charges={charges} />
          </section>

          <section className="card" aria-labelledby="ledger-h">
            <h2 id="ledger-h" style={{ marginTop: 0 }}>
              Ledger
            </h2>
            <LedgerTable rows={ledger} userId={auth.user?.id ?? ""} leaseId={lease.id} reversed={reversed} today={today} />
          </section>
        </>
      )}

      <section className="card" aria-labelledby="terms-h">
        <h2 id="terms-h" style={{ marginTop: 0 }}>
          Terms
        </h2>
        <p>
          {lease.start_date} to {lease.end_date} · Rent due on <strong>Day {lease.due_day}</strong> of each month
        </p>
        {lease.move_out_date && (
          <p>
            <strong>Moved out {lease.move_out_date}</strong>
          </p>
        )}
        <ul>
          {rent.map((r) => (
            <li key={r.effective_period}>
              <strong>{formatMoney(r.monthly_rent_cents)}</strong> a month from {monthName(r.effective_period)}
            </li>
          ))}
        </ul>
        {lease.tenant.phone || lease.tenant.email ? (
          <p className="muted">
            Tenant: <Link href={`/tenants/${lease.tenant.id}`}>{lease.tenant.full_name}</Link>
            {lease.tenant.phone && ` · ${lease.tenant.phone}`}
            {lease.tenant.email && ` · ${lease.tenant.email}`}
          </p>
        ) : null}
      </section>

      <section className="card" aria-labelledby="deposit-h">
        <h2 id="deposit-h" style={{ marginTop: 0 }}>
          Deposit
        </h2>
        <p className="muted">Deposits are held money, kept apart from rent. They never appear in the rent ledger.</p>
        {deposits && deposits.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Received on</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => (
                  <tr key={d.id}>
                    <td>{d.received_on}</td>
                    <td className="num">{formatMoney(d.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Held</th>
                  <td className="num" data-testid="deposit-held">
                    <strong>{formatMoney(summary?.held_cents ?? 0)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          !lease.deposit_waived_on && <p>No deposit recorded yet.</p>
        )}
        {lease.deposit_waived_on && (
          <p className="alert warn">
            Deposit waived on {lease.deposit_waived_on}: {lease.deposit_waiver_reason}
          </p>
        )}
        {lease.status !== "ended" && <DepositForm hideOk={Boolean(done)} leaseId={lease.id} today={today} suggested={centsToInput(rent[0]?.monthly_rent_cents)} canActivate={lease.status === "draft"} />}
        {lease.status === "draft" && !lease.deposit_waived_on && (deposits?.length ?? 0) === 0 && (
          <WaiverForm leaseId={lease.id} today={today} />
        )}
      </section>

      {lease.status === "active" && (
        <section className="card" aria-labelledby="moveout-h">
          <h2 id="moveout-h" style={{ marginTop: 0 }}>
            Move-out
          </h2>
          <MoveOutForm
            leaseId={lease.id}
            defaultDate={today < lease.start_date ? lease.start_date : today > lease.end_date ? lease.end_date : today}
            min={lease.start_date}
            max={lease.end_date}
          />
        </section>
      )}

      {lease.status === "draft" && (
        <section className="card" aria-labelledby="activate-h">
          <h2 id="activate-h" style={{ marginTop: 0 }}>
            Activate
          </h2>
          <p className="muted">
            An active lease is charged rent each month. It needs a deposit or a waiver first; &quot;Record and activate&quot; above
            does both at once.
          </p>
          <ActivateButton leaseId={lease.id} />
        </section>
      )}
    </>
  );
}
