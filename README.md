# NZ GST Invoicer

[![CI](https://github.com/OrrinJames/nz-gst-invoicer/actions/workflows/ci.yml/badge.svg)](https://github.com/OrrinJames/nz-gst-invoicer/actions/workflows/ci.yml)

A full-stack invoicing app for New Zealand freelancers and sole traders. You keep a list of clients, raise invoices with GST at 15% (prices entered either GST-exclusive or GST-inclusive), track them from draft through to paid, and print a clean A4 tax invoice or save it as a PDF from the browser.

Built with **Next.js (App Router)**, **TypeScript (strict)**, **Supabase (Postgres + Auth + row-level security)**, **Zod** and **Tailwind CSS**.

This is a portfolio project. It is small on purpose, so that the parts that matter in a real billing system (money arithmetic, data isolation between users, validation at every boundary) can be done properly and tested.

## Features

- **Clients**: create, edit and delete clients, with optional email, address and NZ GST number.
- **Invoices**: line items with fractional quantities (e.g. 1.5 hours), a live total preview while you type, and sequential per-user numbering (`INV-0001`, `INV-0002`, …).
- **GST both ways**: enter prices excluding GST (15% added on top) or including GST (GST extracted as 3/23 of the total).
- **Status workflow**: `draft → sent → paid`, with `void` for mistakes. Issued invoices can't be deleted or have their lines changed; they are voided instead, so the number sequence stays auditable.
- **Dashboard**: outstanding and overdue totals, worked out against today's date in New Zealand rather than the server's time zone.
- **Print / PDF view**: an A4 print stylesheet. Invoices are titled "Tax Invoice" when your business profile has a GST number, and show the supplier's GST number, buyer details, GST amount and GST-inclusive total.
- **Passwordless sign-in** with Supabase magic links.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React Server Components, Server Actions) |
| Language | TypeScript with `strict` and `noUncheckedIndexedAccess` |
| Database & auth | Supabase: Postgres, Auth, row-level security |
| Validation | Zod 4, shared by server actions and tests |
| Styling | Tailwind CSS 4 |
| Testing | Vitest; database tests run the real migration on PGlite (Postgres compiled to WASM) |
| CI | GitHub Actions: lint, typecheck, tests, production build |

## Architecture notes

### Money is integer cents, and all of it lives in one pure module

[`src/lib/gst.ts`](src/lib/gst.ts) is the only place money arithmetic happens. It has no I/O and no framework imports, so the same code runs in the browser for the live preview and on the server for the stored totals.

- Amounts are integer cents. Floats are only used to *display* a value, never to calculate one.
- `parseDollars("1,234.50")` turns user input into cents and **rejects** fractional cents instead of quietly rounding them.
- Quantities are fixed to thousandths before multiplying, which sidesteps traps like `1.005 * 1000 === 1004.9999999999999`.
- Rounding is half away from zero and uses integer-only division (`divRound`).
- GST is calculated **once on the invoice total**, not per line, so the GST shown is always exactly 15% of the subtotal (or 3/23 of an inclusive total). `subtotal + gst === total` is a tested invariant and also a database `CHECK` constraint.

### The database enforces the rules too

[`supabase/migrations/20260101000000_init.sql`](supabase/migrations/20260101000000_init.sql) defines `clients`, `invoices`, `invoice_items` and `business_profiles`, and does more than store rows:

- **Row-level security on every table.** Each row has an `owner_id` that defaults to `auth.uid()`. Policies limit every read and write to the signed-in user's rows, so data stays isolated even if someone calls the Supabase API directly with the public anon key. Line items inherit access from their parent invoice.
- **Business rules as policies, triggers and constraints.** A trigger enforces the status workflow (`draft → sent | void`, `sent → paid | void`) and freezes an invoice's amounts and dates once it leaves draft. Only draft invoices can be deleted, line items are read-only once an invoice has been sent, an invoice can only reference the caller's own clients, and a client with invoices can't be deleted (`ON DELETE RESTRICT`).
- **Integrity checks.** `amount_cents = round(quantity * unit_price_cents)` on every line (Postgres `round()` on `numeric` also rounds half away from zero, so it agrees with `gst.ts`), plus `due_date >= issue_date` and the totals-balance check.
- **Atomic creation.** `create_invoice()` is a `SECURITY INVOKER` function, so RLS still applies. It inserts the invoice and all of its lines in one transaction, and allocates the next invoice number under a per-user advisory lock so two concurrent requests can't take the same number.

### Server Actions and validation

Mutations are Server Actions ([`src/app/*/actions.ts`](src/app)). Each one:

1. Parses `FormData` with a Zod schema from [`src/lib/validation.ts`](src/lib/validation.ts), which also normalises input (trims text, turns blanks into `null`, converts prices to cents).
2. Returns field-level errors keyed by path (e.g. `items.0.unitPrice`) that forms show inline. React 19 resets uncontrolled fields after an action runs, so the submitted values are sent back to keep what the user typed.
3. **Recomputes totals on the server.** The browser preview is never trusted.
4. Runs every query as the signed-in user through `@supabase/ssr`, so RLS applies, then revalidates the affected routes.

Status changes go through a small state machine ([`src/lib/invoice-status.ts`](src/lib/invoice-status.ts)). The update is conditional on the status that was read, so two concurrent changes can't overwrite each other.

### Auth

`src/middleware.ts` refreshes the Supabase session cookie and sends signed-out visitors to `/login`. Pages and actions still check the user themselves with `supabase.auth.getUser()`, which revalidates the JWT with Supabase. The middleware is there for convenience; the security boundary is RLS in the database.

### Project layout

```
src/
  app/                    routes, pages and server actions
    invoices/[id]/        invoice detail and print view
    invoices/new/         invoice form
    clients/              client list and edit pages
    settings/             business profile (supplier details)
    login/, auth/callback magic-link sign-in
  components/             client components (forms, buttons)
  lib/
    gst.ts                money and GST maths (pure, fully tested)
    validation.ts         Zod schemas for every form
    invoice-status.ts     status state machine
    dates.ts              NZ-time-zone date helpers
    data.ts               typed read queries
    supabase/             server and middleware Supabase clients
supabase/
  migrations/             schema, RLS policies, create_invoice()
  tests/                  migration and RLS tests on PGlite
```

## Tests

```bash
npm test
```

- **Unit tests** cover the GST and money module (rounding edge cases, inclusive/exclusive maths, a 500-case property-style sweep checking `subtotal + gst === total`), the Zod schemas, the status transitions and the NZ date helpers.
- **Database tests** (`supabase/tests/schema.test.ts`) load the real migration into an in-process Postgres (PGlite), using a minimal stand-in for Supabase's `auth` schema. They then act as two different users to check that RLS isolates their data, that sent invoices are locked, that the `CHECK` constraints reject bad totals, and that the database's rounding matches `gst.ts`. No Docker or Supabase account is needed.

`npm run check` runs lint, typecheck and tests together. CI runs the same steps, plus a production build, on every push and pull request.

## Getting started

Requirements: Node.js 20.9+ (22 recommended) and a Supabase project (the free tier is fine).

1. **Clone and install**

   ```bash
   git clone https://github.com/OrrinJames/nz-gst-invoicer.git
   cd nz-gst-invoicer
   npm install
   ```

2. **Create the database schema.** Either paste `supabase/migrations/20260101000000_init.sql` into the Supabase SQL editor and run it, or use the Supabase CLI:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

3. **Configure auth.** In Supabase, go to *Authentication → URL Configuration* and add `http://localhost:3000/auth/callback` as a redirect URL.

4. **Set environment variables**

   ```bash
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

5. **Run it**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000, sign in with your email, add your business details, then a client, then raise an invoice.

## Scope and limitations

- Single currency (NZD) and a single GST rate (15%). The maths functions take a rate in basis points, but the UI and schema don't yet support zero-rated lines.
- PDFs come from the browser's print dialog using a print stylesheet, rather than being generated on the server.
- Invoices aren't emailed from the app.
- This is not tax advice. Check IRD's current requirements for taxable supply information before relying on any invoice format.

## License

[MIT](LICENSE) © 2026 Tyrel Orrin
