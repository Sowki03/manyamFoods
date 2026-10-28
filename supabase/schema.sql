-- =====================================================================
-- Manyam Foods: database schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Then run seed.sql.
-- =====================================================================

-- ---------- Admins ----------
-- Google accounts (emails) that may open admin.html
create table public.admins (
  email text primary key
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- Shop settings (single row) ----------
create table public.settings (
  id int primary key default 1 check (id = 1),
  upi_id text not null default '',
  upi_payee_name text not null default 'Manyam Foods',
  whatsapp_number text not null default '',          -- with country code, no +
  delivery_fee int not null default 60 check (delivery_fee >= 0),
  free_delivery_above int not null default 499 check (free_delivery_above >= 0),
  updated_at timestamptz not null default now()
);

-- ---------- Catalogue ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'other',
  badge text not null default '',
  badge_hot boolean not null default false,
  image_url text not null default '',
  featured boolean not null default false,             -- shown on the home page
  active boolean not null default true,                -- false = hidden from customers
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,                                  -- e.g. "250g", "1 L"
  price int not null check (price > 0),                 -- whole rupees
  stock int check (stock is null or stock >= 0),        -- null = unlimited
  sort_order int not null default 0,
  active boolean not null default true
);
create index on public.product_variants (product_id);

create table public.coupons (
  code text primary key check (code = upper(code)),
  kind text not null check (kind in ('percent', 'flat')),
  value int not null check (value > 0),
  min_order int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'flat' or value <= 100)
);

-- ---------- Customers ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  address text not null default '',
  updated_at timestamptz not null default now()
);

-- ---------- Orders ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  user_id uuid not null references auth.users(id),
  customer_email text not null default '',
  customer_name text not null,
  phone text not null,
  address text not null,
  subtotal int not null,
  discount int not null default 0,
  delivery_fee int not null default 0,
  total int not null,
  coupon_code text,
  payment_method text not null check (payment_method in ('UPI', 'PAY_LATER')),
  utr text,                                             -- UPI transaction ref entered by customer
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'verified', 'failed')),
  status text not null default 'placed'
    check (status in ('placed', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  tracking_info text not null default '',
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (user_id, created_at desc);
create index on public.orders (status, created_at desc);
create unique index orders_utr_unique on public.orders (utr) where utr is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,                           -- snapshot at time of order
  variant_label text not null,
  unit_price int not null,
  qty int not null check (qty between 1 and 99),
  line_total int not null,
  image_url text not null default ''
);
create index on public.order_items (order_id);

-- Timeline shown to customers ("Placed → Confirmed → Shipped ...")
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('status', 'payment')),
  value text not null,
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);

-- =====================================================================
-- Triggers
-- =====================================================================
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- Block reopening cancelled orders; put stock back when an order is cancelled
create or replace function public.guard_order_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update product_variants v
       set stock = v.stock + oi.qty
      from order_items oi
     where oi.order_id = new.id and oi.variant_id = v.id and v.stock is not null;
  end if;
  return new;
end $$;

create trigger orders_guard before update on public.orders
  for each row execute function public.guard_order_update();

create or replace function public.log_order_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into order_events (order_id, kind, value)
    values (new.id, 'status', new.status), (new.id, 'payment', new.payment_status);
  else
    if new.status is distinct from old.status then
      insert into order_events (order_id, kind, value) values (new.id, 'status', new.status);
    end if;
    if new.payment_status is distinct from old.payment_status then
      insert into order_events (order_id, kind, value) values (new.id, 'payment', new.payment_status);
    end if;
  end if;
  return new;
end $$;

create trigger orders_log after insert or update on public.orders
  for each row execute function public.log_order_event();

-- =====================================================================
-- Checkout functions (prices are always taken from the database,
-- never from the customer's browser)
-- =====================================================================

-- p_items: [{"variant_id": "...", "qty": 2}, ...]
create or replace function public.quote_order(p_items jsonb, p_coupon text default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_item jsonb;
  v_var record;
  v_qty int;
  v_lines jsonb := '[]'::jsonb;
  v_sub int := 0;
  v_disc int := 0;
  v_fee int := 0;
  v_set settings;
  v_c coupons;
  v_code text := nullif(upper(trim(coalesce(p_coupon, ''))), '');
  v_coupon_msg text;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many items in one order';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'qty')::int;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'Invalid quantity';
    end if;

    select v.id, v.label, v.price, v.stock, p.id as product_id, p.name, p.image_url
      into v_var
      from product_variants v
      join products p on p.id = v.product_id
     where v.id = (v_item ->> 'variant_id')::uuid and v.active and p.active;

    if not found then
      raise exception 'An item in your cart is no longer available. Please remove it and try again.';
    end if;
    if v_var.stock is not null and v_var.stock < v_qty then
      raise exception '% (%) has only % left in stock', v_var.name, v_var.label, v_var.stock;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_var.id, 'product_id', v_var.product_id,
      'product_name', v_var.name, 'variant_label', v_var.label,
      'unit_price', v_var.price, 'qty', v_qty,
      'line_total', v_var.price * v_qty, 'image_url', v_var.image_url);
    v_sub := v_sub + v_var.price * v_qty;
  end loop;

  if v_code is not null then
    select * into v_c from coupons
     where code = v_code and active and (expires_at is null or expires_at > now());
    if not found then
      v_coupon_msg := 'Invalid or expired coupon';
      v_code := null;
    elsif v_sub < v_c.min_order then
      v_coupon_msg := format('This coupon needs a minimum order of ₹%s', v_c.min_order);
      v_code := null;
    else
      v_disc := case when v_c.kind = 'percent'
                     then round(v_sub * v_c.value / 100.0)::int
                     else least(v_c.value, v_sub) end;
    end if;
  end if;

  select * into v_set from settings where id = 1;
  v_fee := case when v_sub >= coalesce(v_set.free_delivery_above, 0) then 0
                else coalesce(v_set.delivery_fee, 0) end;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal', v_sub,
    'discount', v_disc,
    'delivery_fee', v_fee,
    'total', greatest(0, v_sub - v_disc) + v_fee,
    'coupon_code', v_code,
    'coupon_message', v_coupon_msg);
end $$;

create or replace function public.place_order(
  p_items jsonb,
  p_coupon text,
  p_name text,
  p_phone text,
  p_address text,
  p_payment_method text,
  p_expected_total int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_q jsonb;
  v_line jsonb;
  v_order_id uuid;
  v_no text;
  v_try int := 0;
begin
  if v_uid is null then
    raise exception 'Please sign in to place an order';
  end if;

  p_name := trim(coalesce(p_name, ''));
  p_address := trim(coalesce(p_address, ''));
  p_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if length(p_phone) = 12 and left(p_phone, 2) = '91' then
    p_phone := substr(p_phone, 3);
  end if;

  if length(p_name) < 2 then raise exception 'Please enter your full name'; end if;
  if p_phone !~ '^[6-9][0-9]{9}$' then raise exception 'Please enter a valid 10-digit mobile number'; end if;
  if length(p_address) < 10 then raise exception 'Please enter your complete delivery address'; end if;
  if p_payment_method not in ('UPI', 'PAY_LATER') then raise exception 'Invalid payment method'; end if;

  v_q := quote_order(p_items, p_coupon);

  if nullif(trim(coalesce(p_coupon, '')), '') is not null and v_q ->> 'coupon_code' is null then
    raise exception '%', v_q ->> 'coupon_message';
  end if;
  if p_expected_total is not null and (v_q ->> 'total')::int <> p_expected_total then
    raise exception 'Prices have changed since you opened your cart. The new total is ₹%. Please review and try again.', v_q ->> 'total';
  end if;

  loop
    v_no := 'MF' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-'
            || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from orders where order_no = v_no);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'Could not create an order number, please try again'; end if;
  end loop;

  insert into orders (order_no, user_id, customer_email, customer_name, phone, address,
                      subtotal, discount, delivery_fee, total, coupon_code, payment_method)
  values (v_no, v_uid, coalesce(auth.jwt() ->> 'email', ''), p_name, p_phone, p_address,
          (v_q ->> 'subtotal')::int, (v_q ->> 'discount')::int, (v_q ->> 'delivery_fee')::int,
          (v_q ->> 'total')::int, v_q ->> 'coupon_code', p_payment_method)
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_q -> 'lines') loop
    insert into order_items (order_id, product_id, variant_id, product_name, variant_label,
                             unit_price, qty, line_total, image_url)
    values (v_order_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'variant_id')::uuid,
            v_line ->> 'product_name', v_line ->> 'variant_label',
            (v_line ->> 'unit_price')::int, (v_line ->> 'qty')::int,
            (v_line ->> 'line_total')::int, v_line ->> 'image_url');

    update product_variants
       set stock = stock - (v_line ->> 'qty')::int
     where id = (v_line ->> 'variant_id')::uuid and stock is not null;
  end loop;

  -- Remember delivery details for next time
  insert into profiles (id, full_name, phone, address)
  values (v_uid, p_name, p_phone, p_address)
  on conflict (id) do update
    set full_name = excluded.full_name, phone = excluded.phone, address = excluded.address;

  return v_q || jsonb_build_object('order_no', v_no, 'order_id', v_order_id);
end $$;

-- Customer submits the UPI transaction reference after paying
create or replace function public.submit_payment_ref(p_order_no text, p_utr text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in'; end if;
  p_utr := regexp_replace(coalesce(p_utr, ''), '\s', '', 'g');
  if p_utr !~ '^[0-9]{12}$' then
    raise exception 'Please enter the 12-digit UPI transaction ID (UTR)';
  end if;

  begin
    update orders
       set utr = p_utr
     where order_no = p_order_no
       and user_id = auth.uid()
       and payment_method = 'UPI'
       and payment_status <> 'verified'
       and status <> 'cancelled';
  exception when unique_violation then
    raise exception 'This UPI transaction ID has already been used for another order';
  end;

  if not found then
    raise exception 'Order not found, or its payment is already verified';
  end if;
end $$;

-- Customer cancels their own order before it is confirmed
create or replace function public.cancel_my_order(p_order_no text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update orders
     set status = 'cancelled'
   where order_no = p_order_no
     and user_id = auth.uid()
     and status = 'placed'
     and payment_status <> 'verified';
  if not found then
    raise exception 'This order can no longer be cancelled online. Please contact us on WhatsApp.';
  end if;
end $$;

revoke execute on function public.quote_order(jsonb, text) from public;
revoke execute on function public.place_order(jsonb, text, text, text, text, text, int) from public;
revoke execute on function public.submit_payment_ref(text, text) from public;
revoke execute on function public.cancel_my_order(text) from public;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.quote_order(jsonb, text) to anon, authenticated;
grant execute on function public.place_order(jsonb, text, text, text, text, text, int) to authenticated;
grant execute on function public.submit_payment_ref(text, text) to authenticated;
grant execute on function public.cancel_my_order(text) to authenticated;

-- =====================================================================
-- Row Level Security: who can read/write what
-- =====================================================================
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.coupons enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;

grant select on public.settings, public.products, public.product_variants to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

create policy "admins: admin read" on public.admins
  for select to authenticated using (public.is_admin());

create policy "settings: public read" on public.settings
  for select using (true);
create policy "settings: admin write" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "products: public read active" on public.products
  for select using (active or public.is_admin());
create policy "products: admin write" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "variants: public read active" on public.product_variants
  for select using (
    (active and exists (select 1 from public.products p where p.id = product_id and p.active))
    or public.is_admin());
create policy "variants: admin write" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "coupons: admin only" on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "profiles: own or admin read" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles: own insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles: own update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Customers can only read their own orders; orders are created via place_order()
create policy "orders: own or admin read" on public.orders
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy "orders: admin update" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "order_items: own or admin read" on public.order_items
  for select to authenticated using (exists (
    select 1 from public.orders o
     where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

create policy "order_events: own or admin read" on public.order_events
  for select to authenticated using (exists (
    select 1 from public.orders o
     where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- =====================================================================
-- Product photo storage (public to view, admins upload)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product images: admin upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images' and public.is_admin());
create policy "product images: admin update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images' and public.is_admin());
create policy "product images: admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images' and public.is_admin());
