-- =====================================================================
-- Manyam Foods migration 002 (run once in Supabase → SQL Editor)
--  1. Stock goes down when a payment is verified (not when the order is placed),
--     and comes back if the payment is un-verified or a paid order is cancelled.
--  2. Orders are UPI only (Pay later removed).
--  3. Contact-form messages table, readable only by admins.
-- =====================================================================

-- 1) Stock follows verified payments
create or replace function public.guard_order_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  was_deducted boolean := old.payment_status = 'verified' and old.status <> 'cancelled';
  is_deducted  boolean := new.payment_status = 'verified' and new.status <> 'cancelled';
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened';
  end if;

  if is_deducted and not was_deducted then
    -- never below zero, so verifying a late payment can't fail
    update product_variants v
       set stock = greatest(0, v.stock - oi.qty)
      from order_items oi
     where oi.order_id = new.id and oi.variant_id = v.id and v.stock is not null;
  elsif was_deducted and not is_deducted then
    update product_variants v
       set stock = v.stock + oi.qty
      from order_items oi
     where oi.order_id = new.id and oi.variant_id = v.id and v.stock is not null;
  end if;
  return new;
end $$;

-- 2) place_order: UPI only, and no stock change at order time
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
  if p_payment_method is distinct from 'UPI' then raise exception 'Only UPI payment is available'; end if;

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
          (v_q ->> 'total')::int, v_q ->> 'coupon_code', 'UPI')
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(v_q -> 'lines') loop
    insert into order_items (order_id, product_id, variant_id, product_name, variant_label,
                             unit_price, qty, line_total, image_url)
    values (v_order_id, (v_line ->> 'product_id')::uuid, (v_line ->> 'variant_id')::uuid,
            v_line ->> 'product_name', v_line ->> 'variant_label',
            (v_line ->> 'unit_price')::int, (v_line ->> 'qty')::int,
            (v_line ->> 'line_total')::int, v_line ->> 'image_url');
  end loop;

  -- Remember delivery details for next time
  insert into profiles (id, full_name, phone, address)
  values (v_uid, p_name, p_phone, p_address)
  on conflict (id) do update
    set full_name = excluded.full_name, phone = excluded.phone, address = excluded.address;

  return v_q || jsonb_build_object('order_no', v_no, 'order_id', v_order_id);
end $$;

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
    raise exception 'This order can no longer be cancelled online. Please contact us from the Support page.';
  end if;
end $$;

-- 3) Contact-form messages
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(name) between 2 and 80),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  topic text not null default 'Other' check (length(topic) <= 60),
  message text not null check (length(message) between 5 and 2000),
  handled boolean not null default false
);
create index if not exists contact_messages_created on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;

drop policy if exists "messages: anyone can send" on public.contact_messages;
create policy "messages: anyone can send" on public.contact_messages
  for insert to anon, authenticated
  with check (handled = false and (user_id is null or user_id = auth.uid()));
drop policy if exists "messages: admin read" on public.contact_messages;
create policy "messages: admin read" on public.contact_messages
  for select to authenticated using (public.is_admin());
drop policy if exists "messages: admin update" on public.contact_messages;
create policy "messages: admin update" on public.contact_messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "messages: admin delete" on public.contact_messages;
create policy "messages: admin delete" on public.contact_messages
  for delete to authenticated using (public.is_admin());
