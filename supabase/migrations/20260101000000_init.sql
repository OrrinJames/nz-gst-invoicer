-- nz-gst-invoicer: initial schema
--
-- Every row belongs to exactly one Supabase Auth user (owner_id) and row-level
-- security ensures users can only ever see or change their own data, even if
-- the anon key is used directly from a browser.
--
-- Money is stored as bigint cents. Quantities are numeric(12,3).
-- gen_random_uuid() is built into Postgres 13+.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Business profile (the supplier details printed on every tax invoice)
-- ---------------------------------------------------------------------------

create table public.business_profiles (
  owner_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 200),
  gst_number    text check (gst_number ~ '^\d{2,3}-?\d{3}-?\d{3}$'),
  email         text,
  address       text,
  bank_account  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger business_profiles_updated_at
  before update on public.business_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clients
-- ---------------------------------------------------------------------------

create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  email       text,
  address     text,
  gst_number  text check (gst_number ~ '^\d{2,3}-?\d{3}-?\d{3}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index clients_owner_id_name_idx on public.clients (owner_id, name);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Invoices
-- ---------------------------------------------------------------------------

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id       uuid not null references public.clients (id) on delete restrict,
  invoice_number  text not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'sent', 'paid', 'void')),
  tax_mode        text not null check (tax_mode in ('exclusive', 'inclusive')),
  issue_date      date not null,
  due_date        date not null,
  notes           text,
  subtotal_cents  bigint not null,
  gst_cents       bigint not null,
  total_cents     bigint not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_number_unique_per_owner unique (owner_id, invoice_number),
  constraint invoices_due_after_issue check (due_date >= issue_date),
  constraint invoices_totals_balance check (subtotal_cents + gst_cents = total_cents)
);

create index invoices_owner_id_issue_date_idx on public.invoices (owner_id, issue_date desc);
create index invoices_client_id_idx on public.invoices (client_id);

create trigger invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- Status workflow, enforced in the database as well as the app
-- (src/lib/invoice-status.ts), so it holds even for direct API calls:
--   draft -> sent | void,  sent -> paid | void,  paid and void are final.
-- Once an invoice has left draft, its contents are frozen.
create or replace function public.enforce_invoice_workflow()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and not (
       (old.status = 'draft' and new.status in ('sent', 'void'))
    or (old.status = 'sent'  and new.status in ('paid', 'void'))
  ) then
    raise exception 'invoice status cannot change from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  if old.status <> 'draft' and (
       new.client_id      is distinct from old.client_id
    or new.invoice_number is distinct from old.invoice_number
    or new.tax_mode       is distinct from old.tax_mode
    or new.issue_date     is distinct from old.issue_date
    or new.due_date       is distinct from old.due_date
    or new.subtotal_cents is distinct from old.subtotal_cents
    or new.gst_cents      is distinct from old.gst_cents
    or new.total_cents    is distinct from old.total_cents
  ) then
    raise exception 'only draft invoices can be edited' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger invoices_enforce_workflow
  before update on public.invoices
  for each row execute function public.enforce_invoice_workflow();

-- ---------------------------------------------------------------------------
-- Invoice line items
-- ---------------------------------------------------------------------------

create table public.invoice_items (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references public.invoices (id) on delete cascade,
  position          integer not null check (position >= 0),
  description       text not null check (char_length(description) between 1 and 500),
  quantity          numeric(12, 3) not null check (quantity > 0),
  unit_price_cents  bigint not null,
  amount_cents      bigint not null,
  constraint invoice_items_position_unique unique (invoice_id, position),
  -- Postgres numeric round() is half away from zero, matching src/lib/gst.ts.
  constraint invoice_items_amount_matches check (amount_cents = round(quantity * unit_price_cents))
);

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.business_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- (select auth.uid()) is evaluated once per statement instead of per row.

create policy "Owners manage their business profile"
  on public.business_profiles for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners manage their clients"
  on public.clients for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners read their invoices"
  on public.invoices for select to authenticated
  using (owner_id = (select auth.uid()));

-- Inserts must reference one of the caller's own clients.
create policy "Owners create invoices for their clients"
  on public.invoices for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.clients c
      where c.id = client_id and c.owner_id = (select auth.uid())
    )
  );

create policy "Owners update their invoices"
  on public.invoices for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Only drafts can be deleted; issued invoices are voided instead.
create policy "Owners delete their draft invoices"
  on public.invoices for delete to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft');

-- Line items inherit access from their parent invoice.
create policy "Owners read items on their invoices"
  on public.invoice_items for select to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.owner_id = (select auth.uid())
  ));

-- Items can only be written while the parent invoice is a draft.
create policy "Owners write items on their draft invoices"
  on public.invoice_items for all to authenticated
  using (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.owner_id = (select auth.uid()) and i.status = 'draft'
  ))
  with check (exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.owner_id = (select auth.uid()) and i.status = 'draft'
  ));

-- ---------------------------------------------------------------------------
-- create_invoice: insert an invoice and its items atomically
-- ---------------------------------------------------------------------------
--
-- security invoker: runs as the calling user, so every RLS policy above still
-- applies. Invoice numbers are allocated per owner under a transaction-scoped
-- advisory lock so concurrent creates cannot collide.

create or replace function public.create_invoice(
  p_client_id      uuid,
  p_tax_mode       text,
  p_issue_date     date,
  p_due_date       date,
  p_notes          text,
  p_subtotal_cents bigint,
  p_gst_cents      bigint,
  p_total_cents    bigint,
  p_items          jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner_id   uuid := auth.uid();
  v_invoice_id uuid;
  v_next       integer;
begin
  if v_owner_id is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'an invoice needs at least one line item' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_owner_id::text, 0));

  select coalesce(max(substring(invoice_number from '^INV-(\d+)$')::integer), 0) + 1
    into v_next
    from public.invoices
   where owner_id = v_owner_id;

  insert into public.invoices (
    owner_id, client_id, invoice_number, tax_mode, issue_date, due_date, notes,
    subtotal_cents, gst_cents, total_cents
  ) values (
    v_owner_id, p_client_id, 'INV-' || lpad(v_next::text, 4, '0'), p_tax_mode,
    p_issue_date, p_due_date, p_notes, p_subtotal_cents, p_gst_cents, p_total_cents
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, position, description, quantity, unit_price_cents, amount_cents
  )
  select v_invoice_id,
         (item.ordinality - 1)::integer,
         item.value ->> 'description',
         (item.value ->> 'quantity')::numeric,
         (item.value ->> 'unit_price_cents')::bigint,
         (item.value ->> 'amount_cents')::bigint
    from jsonb_array_elements(p_items) with ordinality as item(value, ordinality);

  return v_invoice_id;
end;
$$;

revoke all on function public.create_invoice(uuid, text, date, date, text, bigint, bigint, bigint, jsonb) from public, anon;
grant execute on function public.create_invoice(uuid, text, date, date, text, bigint, bigint, bigint, jsonb) to authenticated;
