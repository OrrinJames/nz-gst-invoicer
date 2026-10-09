/**
 * Runs the real migration against an in-process Postgres (PGlite) with a
 * minimal stand-in for Supabase's `auth` schema, then exercises row-level
 * security and the create_invoice function as two different users.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { calculateInvoice } from "../../src/lib/gst";

const MIGRATION = fileURLToPath(new URL("../migrations/20260101000000_init.sql", import.meta.url));

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

/** Just enough of Supabase's auth schema and roles for the migration to run. */
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create role anon nologin;
  create role authenticated nologin;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;

/** Run SQL as the given user, the way PostgREST does for an authenticated request. */
async function asUser<T>(userId: string, sql: string, params: unknown[] = []) {
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    set role authenticated;
  `);
  return db.query<T>(sql, params);
}

type Line = { description: string; quantity: number; unitPriceCents: number };

async function createInvoice(userId: string, clientId: string, lines: Line[]) {
  const totals = calculateInvoice(lines, "exclusive");
  const items = lines.map((line, index) => ({
    description: line.description,
    quantity: line.quantity,
    unit_price_cents: line.unitPriceCents,
    amount_cents: totals.lineAmounts[index],
  }));
  const result = await asUser<{ id: string }>(
    userId,
    `select public.create_invoice($1, 'exclusive', '2026-03-01', '2026-03-20', null, $2, $3, $4, $5::jsonb) as id`,
    [clientId, totals.subtotalCents, totals.gstCents, totals.totalCents, JSON.stringify(items)],
  );
  return result.rows[0]!.id;
}

let aliceClientId: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(readFileSync(MIGRATION, "utf8"));
  // Supabase grants table privileges to `authenticated` by default; RLS does the filtering.
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
  `);

  const client = await asUser<{ id: string }>(ALICE, `insert into clients (name) values ('Kiwi Widgets Ltd') returning id`);
  aliceClientId = client.rows[0]!.id;
}, 30_000);

describe("create_invoice", () => {
  it("creates an invoice with sequential per-user numbers", async () => {
    await createInvoice(ALICE, aliceClientId, [{ description: "Build", quantity: 1, unitPriceCents: 10000 }]);
    await createInvoice(ALICE, aliceClientId, [{ description: "Support", quantity: 2, unitPriceCents: 5000 }]);

    const { rows } = await asUser<{ invoice_number: string; total_cents: number }>(
      ALICE,
      `select invoice_number, total_cents from invoices order by invoice_number`,
    );
    expect(rows).toEqual([
      { invoice_number: "INV-0001", total_cents: 11500 },
      { invoice_number: "INV-0002", total_cents: 11500 },
    ]);
  });

  it("agrees with gst.ts rounding for fractional quantities", async () => {
    // The DB check constraint recomputes round(quantity * unit_price_cents).
    const lines: Line[] = [
      { description: "Half-cent up", quantity: 1.5, unitPriceCents: 3333 },
      { description: "Third of an hour", quantity: 0.333, unitPriceCents: 12500 },
      { description: "Credit", quantity: 0.25, unitPriceCents: -10 },
    ];
    await expect(createInvoice(ALICE, aliceClientId, lines)).resolves.toMatch(/[0-9a-f-]{36}/);
  });

  it("rejects line amounts that don't match quantity x price", async () => {
    await expect(
      asUser(
        ALICE,
        `select public.create_invoice($1, 'exclusive', '2026-03-01', '2026-03-20', null, 4999, 750, 5749, $2::jsonb)`,
        [aliceClientId, JSON.stringify([{ description: "x", quantity: 1.5, unit_price_cents: 3333, amount_cents: 4999 }])],
      ),
    ).rejects.toThrow(/invoice_items_amount_matches/);
  });

  it("rejects totals that don't balance", async () => {
    await expect(
      asUser(
        ALICE,
        `select public.create_invoice($1, 'exclusive', '2026-03-01', '2026-03-20', null, 100, 15, 999, $2::jsonb)`,
        [aliceClientId, JSON.stringify([{ description: "x", quantity: 1, unit_price_cents: 100, amount_cents: 100 }])],
      ),
    ).rejects.toThrow(/invoices_totals_balance/);
  });

  it("rejects an invoice with no line items", async () => {
    await expect(
      asUser(
        ALICE,
        `select public.create_invoice($1, 'exclusive', '2026-03-01', '2026-03-20', null, 0, 0, 0, '[]'::jsonb)`,
        [aliceClientId],
      ),
    ).rejects.toThrow(/at least one line item/);
  });
});

describe("row-level security", () => {
  it("hides one user's data from another", async () => {
    const clients = await asUser<{ count: number }>(BOB, `select count(*)::int as count from clients`);
    const invoices = await asUser<{ count: number }>(BOB, `select count(*)::int as count from invoices`);
    const items = await asUser<{ count: number }>(BOB, `select count(*)::int as count from invoice_items`);
    expect([clients.rows[0]!.count, invoices.rows[0]!.count, items.rows[0]!.count]).toEqual([0, 0, 0]);
  });

  it("stops a user invoicing someone else's client", async () => {
    await expect(
      createInvoice(BOB, aliceClientId, [{ description: "x", quantity: 1, unitPriceCents: 100 }]),
    ).rejects.toThrow(/row-level security/);
  });

  it("stops a user updating someone else's invoice", async () => {
    const result = await asUser(BOB, `update invoices set status = 'void'`);
    expect(result.affectedRows).toBe(0);
  });

  it("only allows draft invoices to be deleted", async () => {
    await asUser(ALICE, `update invoices set status = 'sent' where invoice_number = 'INV-0001'`);
    const sent = await asUser(ALICE, `delete from invoices where invoice_number = 'INV-0001'`);
    expect(sent.affectedRows).toBe(0);

    const draft = await asUser(ALICE, `delete from invoices where invoice_number = 'INV-0002'`);
    expect(draft.affectedRows).toBe(1);
  });

  it("enforces the status workflow in the database", async () => {
    // INV-0001 is now 'sent': it can't go back to draft (which would make it deletable)...
    await expect(
      asUser(ALICE, `update invoices set status = 'draft' where invoice_number = 'INV-0001'`),
    ).rejects.toThrow(/cannot change from sent to draft/);
    // ...and its amounts are frozen.
    await expect(
      asUser(ALICE, `update invoices set due_date = '2026-12-31' where invoice_number = 'INV-0001'`),
    ).rejects.toThrow(/only draft invoices can be edited/);
    // Notes can still be updated, and sent -> paid is allowed.
    const paid = await asUser(
      ALICE,
      `update invoices set status = 'paid', notes = 'Paid by bank transfer' where invoice_number = 'INV-0001'`,
    );
    expect(paid.affectedRows).toBe(1);
  });

  it("locks line items once an invoice is no longer a draft", async () => {
    await expect(
      asUser(
        ALICE,
        `insert into invoice_items (invoice_id, position, description, quantity, unit_price_cents, amount_cents)
         select id, 99, 'Sneaky extra', 1, 100, 100 from invoices where invoice_number = 'INV-0001'`,
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("prevents deleting a client that has invoices", async () => {
    await expect(asUser(ALICE, `delete from clients where id = $1`, [aliceClientId])).rejects.toMatchObject({
      code: "23001",
    });
  });

  it("denies anonymous access to create_invoice", async () => {
    await db.exec(`reset role; set role anon;`);
    await expect(
      db.query(`select public.create_invoice(null, 'exclusive', '2026-03-01', '2026-03-01', null, 0, 0, 0, '[]')`),
    ).rejects.toThrow(/permission denied/);
  });
});
