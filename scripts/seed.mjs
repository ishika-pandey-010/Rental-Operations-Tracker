#!/usr/bin/env node
// NFR-09: rebuild the demo account in one command (`make seed`).
//
// Deletes the demo landlord (purge_account, D-28) and builds them again with
// 3 properties, 20 units and about 24 months of history ending this month,
// including the cases the app exists for: part-payments, an overpayment held
// as credit, a bounced transfer, a rent rise, a renewal with the deposit
// carried over, and a move-out with deductions and a refund still owed.
//
// Every row is written through the same SQL functions the app uses, as the
// demo landlord, so RLS and every money rule apply to the seed too.
//
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL
// (`make env` writes them for the local stack).
import { existsSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
pg.types.setTypeParser(1082, (v) => v); // dates stay 'YYYY-MM-DD'
pg.types.setTypeParser(20, (v) => Number(v)); // bigint cents fit a JS integer

// `--user-test` builds the starting state for the timed user test instead
// (docs/user-test-protocol.md §3): three units, October 2026 charged and paid.
const USER_TEST = process.argv.includes("--user-test");
export const DEMO_EMAIL = USER_TEST ? "usertest@rentalops.test" : process.env.DEMO_EMAIL || "demo@rentalops.test";
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo-pass-2026";

const { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey, DATABASE_URL: dbUrl } = process.env;
if (!url || !serviceKey || !dbUrl) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL. Run `make env` first.");
  process.exit(1);
}

// ---- dates (UTC calendar dates as YYYY-MM-DD) --------------------------------
const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const iso = (d) => d.toISOString().slice(0, 10);
const monthStart = (offset) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
const monthDay = (offset, day) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, day));
const monthEnd = (offset) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset + 1, 0));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const HISTORY = 24; // months back from this month

// ---- the portfolio ----------------------------------------------------------
const PROPERTIES = [
  { name: "12 Elm St", address: "12 Elm Street", units: ["A", "B", "C", "D", "E", "F", "G", "H"] },
  { name: "40 Harbour Rd", address: "40 Harbour Road", units: ["1", "2", "3", "4", "5", "6", "7", "8"] },
  { name: "7 Mill Lane", address: "7 Mill Lane", units: ["Ground", "First", "Second", "Top"] },
];
const NAMES = [
  "Sam Okafor", "Ana Ruiz", "Priya Nair", "Tom Becker", "Mei Lin", "Jonas Berg", "Fatima Zahra", "Liam O'Neill",
  "Chloe Martin", "Kwame Mensah", "Sofia Rossi", "Daniel Kim", "Aisha Bello", "Oliver Smith", "Hana Sato",
  "Lucas Silva", "Emma Dubois", "Noah Fischer", "Grace Park", "Ravi Patel",
];
const METHODS = ["bank_transfer", "bank_transfer", "bank_transfer", "cash", "cheque"];

async function main() {
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const db = new pg.Client({ connectionString: dbUrl });
  await db.connect();

  // 1. Remove the old demo account, if any.
  const { rows: old } = await db.query("select id from auth.users where email = $1", [DEMO_EMAIL]);
  for (const { id } of old) {
    await db.query("set role service_role");
    await db.query("select purge_account($1)", [id]);
    await db.query("reset role");
  }

  // 2. Create the demo landlord through Supabase Auth so they can sign in.
  const { data: created, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  const owner = created.user.id;

  // 3. Act as the demo landlord from here on: RLS and every trigger apply.
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: owner, role: "authenticated" })]);
  await db.query("set role authenticated");
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];

  if (USER_TEST) {
    await userTestAccount(db, one);
    await db.end();
    console.log(`User-test account rebuilt: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
    return;
  }

  const units = [];
  for (const p of PROPERTIES) {
    const { id } = await one("select create_property($1, $2, $3) as id", [p.name, p.address, p.units]);
    const { rows } = await db.query("select id, label from units where property_id = $1", [id]);
    for (const label of p.units) units.push({ id: rows.find((r) => r.label === label).id, name: `${p.name} · ${label}` });
  }
  const tenants = [];
  for (const [i, name] of NAMES.entries()) {
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`;
    const { id } = await one("insert into tenants (full_name, email, phone) values ($1, $2, $3) returning id", [
      name,
      email,
      i % 3 === 0 ? `555-01${String(i).padStart(2, "0")}` : null,
    ]);
    tenants.push(id);
  }

  // Leases. Unit 19 ("7 Mill Lane · Top") is empty after its tenant leaves three months ago,
  // so occupancy today reads 19 of 20.
  const leases = [];
  async function lease(unitIdx, tenantIdx, start, end, rentCents, dueDay, opts = {}) {
    const { id } = await one("select create_lease($1, $2, $3, $4, $5, $6) as id", [
      units[unitIdx].id, tenants[tenantIdx], iso(start), iso(end), rentCents, dueDay,
    ]);
    if (opts.waive) {
      await db.query("update leases set deposit_waived_on = $2, deposit_waiver_reason = $3 where id = $1", [id, iso(addDays(start, -10)), opts.waive]);
    } else {
      await db.query("insert into deposits (lease_id, amount_cents, received_on) values ($1, $2, $3)", [id, rentCents, iso(addDays(start, -7))]);
    }
    await db.query("update leases set status = 'active' where id = $1", [id]);
    const l = { id, rentCents, dueDay, start, end, behaviour: opts.behaviour ?? "on_time", unit: units[unitIdx].name, idx: leases.length };
    leases.push(l);
    return l;
  }

  const start = monthStart(-HISTORY);
  const longEnd = monthEnd(12);
  for (let u = 0; u < 16; u++) {
    const rent = 85000 + ((u * 5300) % 80000); // 850.00 to 1,649.00
    const behaviour = u === 3 ? "partial_lately" : u === 7 ? "overpays" : u === 10 ? "bounced_once" : u === 12 ? "late_this_month" : "on_time";
    await lease(u, u, start, longEnd, rent - (rent % 500), u % 4 === 0 ? 5 : 1, { behaviour });
  }
  // A family tenant with the deposit waived.
  await lease(17, 17, start, longEnd, 95000, 1, { waive: "Landlord's niece; no deposit agreed" });
  // A one-year lease renewed with the deposit carried over (US-08).
  const toRenew = await lease(16, 16, start, monthEnd(-HISTORY + 11), 110000, 1);
  // The tenant who left three months ago; refund still to pay (US-18, US-19, US-21).
  const leaving = await lease(19, 19, start, longEnd, 125000, 1);
  // A mid-month move-in six months ago (US-11).
  const midMonth = { unitIdx: 18, tenantIdx: 18, start: monthDay(-6, 16) };

  // 4. Month by month: changes that happen that month, then charges, then payments.
  for (let m = -HISTORY; m <= 0; m++) {
    if (m === -12) {
      // Rent rise of 50.00 on the first four leases (US-07).
      for (const l of leases.slice(0, 4)) {
        await db.query("select change_rent($1, $2, $3)", [l.id, iso(monthStart(m)), l.rentCents + 5000]);
        l.rentCents += 5000;
      }
      // Renewal starts this month.
      const { id } = await one("select renew_lease($1, $2, $3, $4, true) as id", [toRenew.id, iso(monthStart(m)), iso(longEnd), 115000]);
      toRenew.id = id;
      toRenew.rentCents = 115000;
    }
    if (m === -6) {
      await lease(midMonth.unitIdx, midMonth.tenantIdx, midMonth.start, longEnd, 98000, 1);
    }
    await db.query("select generate_rent_charges($1)", [iso(monthStart(m))]);
    if (m === -3) {
      await db.query("select move_out($1, $2)", [leaving.id, iso(monthDay(m, 10))]);
      await db.query("insert into deposit_deductions (lease_id, amount_cents, reason) values ($1, 15000, 'Carpet cleaning')", [leaving.id]);
      await db.query("insert into deposit_deductions (lease_id, amount_cents, reason) values ($1, 4500, 'Replacement keys')", [leaving.id]);
      leaving.gone = true;
    }

    for (const l of leases) {
      if (l.gone && m > -3) continue;
      const { rows: due } = await db.query(
        "select charge_id, balance_cents, due_date from charge_balances where lease_id = $1 and kind = 'rent' and period = $2",
        [l.id, iso(monthStart(m))],
      );
      if (!due.length) continue;
      const charge = due[0];
      const paidOn = addDays(new Date(charge.due_date + "T00:00:00Z"), (l.idx * 7 + m + 100) % 4);
      if (paidOn > today) continue;
      const method = METHODS[(l.idx + m + 100) % METHODS.length];
      const reference = method === "cash" ? null : `${method === "cheque" ? "CHQ" : "TRX"}-${l.idx + 1}-${iso(monthStart(m)).slice(0, 7)}`;
      const pay = (cents, ref = reference, on = paidOn) =>
        one("select record_payment($1, $2, $3, $4, $5, null) as id", [l.id, cents, iso(on), method, ref]);

      const amount = Number(charge.balance_cents);
      if (l.behaviour === "partial_lately" && m >= -1) {
        await pay(amount - 40000); // 400.00 short in each of the last two months
      } else if (l.behaviour === "overpays" && m === -1) {
        await pay(amount + 30000); // 300.00 ahead, held as credit (US-14)
      } else if (l.behaviour === "bounced_once" && m === -5) {
        const { id } = await pay(amount);
        await db.query("select reverse_payment($1, $2, 'Transfer bounced')", [id, iso(addDays(paidOn, 4))]);
        await pay(amount, `${reference}-RETRY`, addDays(paidOn, 9));
      } else if (l.behaviour === "late_this_month" && m === 0) {
        // Hasn't paid this month yet.
      } else if (amount > 0) {
        await pay(amount);
      }
    }
  }

  // The overpaying tenant's credit from last month went on this month's rent;
  // they've also paid 300.00 ahead today, which stays as credit until next month.
  const ahead = leases.find((l) => l.behaviour === "overpays");
  await db.query("select record_payment($1, 30000, $2, 'bank_transfer', $3, null)", [ahead.id, iso(today), `TRX-AHEAD-${iso(today)}`]);

  // One older tenant who left and was refunded in full: shows a closed deposit.
  const closed = await lease(19, 0, monthStart(-HISTORY - 12), monthEnd(-HISTORY - 1), 90000, 1);
  for (let m = -HISTORY - 12; m <= -HISTORY - 1; m++) await db.query("select generate_rent_charges($1)", [iso(monthStart(m))]);
  await db.query("select move_out($1, $2)", [closed.id, iso(monthEnd(-HISTORY - 1))]);
  const { rows: ch } = await db.query("select balance_cents from charge_balances where lease_id = $1", [closed.id]);
  for (const c of ch) if (Number(c.balance_cents) > 0)
    await db.query("select record_payment($1, $2, $3, 'bank_transfer', null, null)", [closed.id, c.balance_cents, iso(monthEnd(-HISTORY - 1))]);
  await db.query("select pay_refund($1, 90000, $2)", [closed.id, iso(addDays(monthEnd(-HISTORY - 1), 14))]);

  const totals = await one("select * from dashboard_totals($1)", [iso(today)]);
  const counts = await one(
    `select (select count(*) from leases)::int as leases, (select count(*) from charges)::int as charges,
            (select count(*) from payments)::int as payments`,
  );
  await db.end();
  console.log(`Demo account rebuilt: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(
    `${units.length} units, ${counts.leases} leases, ${counts.charges} charges, ${counts.payments} payments; ` +
      `${totals.units_occupied} of ${totals.units_total} units occupied today`,
  );
}

// The same three units, tenants and October as docs/user-test/baseline.xlsx.
async function userTestAccount(db, one) {
  const { id: property } = await one("select create_property('Test House', null, array['A', 'B', 'C']) as id");
  const { rows: units } = await db.query("select id, label from units where property_id = $1 order by label", [property]);
  const people = ["Alex Moreno", "Bea Novak", "Chris Adeyemi"];
  for (const [i, unit] of units.entries()) {
    const { id: tenant } = await one("insert into tenants (full_name, phone) values ($1, $2) returning id", [people[i], `555-020${i}`]);
    const { id: lease } = await one("select create_lease($1, $2, '2026-10-01', '2027-09-30', 120000, 1) as id", [unit.id, tenant]);
    await db.query("insert into deposits (lease_id, amount_cents, received_on) values ($1, 120000, '2026-09-25')", [lease]);
    await db.query("update leases set status = 'active' where id = $1", [lease]);
  }
  await db.query("select generate_rent_charges('2026-10-01')");
  const { rows: leases } = await db.query("select l.id, u.label from leases l join units u on u.id = l.unit_id order by u.label");
  for (const l of leases)
    await db.query("select record_payment($1, 120000, '2026-10-02', 'bank_transfer', $2, null)", [l.id, `OCT-${l.label}`]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
