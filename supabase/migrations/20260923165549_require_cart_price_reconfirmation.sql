-- Requires the minimum-order migration. No production execution is authorized.
-- The new endpoint fails closed until deployed; legacy clients cannot bypass
-- price confirmation via the former endpoint after this migration is applied.
begin;

create or replace function public.place_order_from_confirmed_cart(
  p_customer_name text, p_phone text, p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to place an order' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Order must contain between 1 and 100 items' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where jsonb_typeof(i) is distinct from 'object'
       or jsonb_typeof(i->'expected_price') is distinct from 'number'
       or (i->>'expected_price')::numeric < 0
  ) then
    raise exception 'Every line must include its confirmed price' using errcode = '22023';
  end if;

  -- Stable lock order, held through validation and both header/line inserts.
  -- FOR SHARE also blocks non-key price, publication and ordering-rule updates.
  perform p.id
  from public.products p
  join jsonb_to_recordset(p_items) as i(product_id uuid) on p.id = i.product_id
  order by p.id
  for share of p;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(product_id uuid)
    left join public.products p on p.id = i.product_id
    where p.id is null or p.status is distinct from 'published'
       or coalesce(p.is_active, false) is false
  ) then
    raise exception 'One or more products are unavailable' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(product_id uuid, expected_price numeric)
    join public.products p on p.id = i.product_id
    where i.expected_price is distinct from greatest(0, coalesce(p.price, 0))
  ) then
    -- No writes and no prices in the error. The client refreshes the public
    -- catalogue with the customer's own permissions before showing changes.
    raise exception 'CART_PRICE_CHANGED' using errcode = 'P0001';
  end if;

  return public.place_order_from_cart(p_customer_name, p_phone, p_items);
end;
$$;

revoke all on function public.place_order_from_confirmed_cart(text, text, jsonb)
  from public, anon;
grant execute on function public.place_order_from_confirmed_cart(text, text, jsonb)
  to authenticated;
revoke execute on function public.place_order_from_cart(text, text, jsonb)
  from public, anon, authenticated;

commit;
