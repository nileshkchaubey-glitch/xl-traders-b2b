-- Enforce the existing storefront minimum-order rule inside the order RPC.
-- No configuration values are changed. All-enquiry orders retain their exemption.
-- Apply only with owner approval; this file has only been tested locally.

begin;


create or replace function public.place_order_from_cart(
  p_customer_name text,
  p_phone text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_total numeric;
  v_minimum numeric;
  v_user_id uuid := auth.uid();
  v_item record;
  v_input_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in is required to place an order' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Order must contain between 1 and 100 items' using errcode = '22023';
  end if;

  if length(btrim(coalesce(p_customer_name, ''))) not between 1 and 120 then
    raise exception 'A customer name is required' using errcode = '22023';
  end if;

  if coalesce(p_phone, '') !~ '^[6-9][0-9]{9}$' then
    raise exception 'A valid 10-digit Indian mobile number is required' using errcode = '22023';
  end if;

  select count(*) into v_input_count
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer);

  if v_input_count <> (
    select count(distinct i.product_id)
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
  ) then
    raise exception 'Each product may appear only once in an order' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
    left join public.products p on p.id = i.product_id
    where i.quantity is null
       or i.quantity < 1
       or i.quantity > 1000000
       or p.id is null
       or p.status <> 'published'
       or coalesce(p.is_active, false) is false
  ) then
    raise exception 'One or more products are unavailable or have an invalid quantity'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
    join public.products p on p.id = i.product_id
    where i.quantity < greatest(1, coalesce(p.moq, 1))
       or (
         p.order_step is not null
         and p.order_step > 0
         and coalesce(p.quantity_in_unit, 1) > 0
         and p.order_step % coalesce(nullif(p.quantity_in_unit, 0), 1) = 0
         and (i.quantity * coalesce(nullif(p.quantity_in_unit, 0), 1)) % p.order_step <> 0
       )
  ) then
    raise exception 'One or more quantities do not meet the current MOQ or order step'
      using errcode = '22023';
  end if;

  insert into public.orders (
    customer_name, phone, status, total_amount, item_count, source, user_id
  )
  select
    btrim(p_customer_name),
    p_phone,
    'new',
    sum(i.quantity * greatest(0, coalesce(p.price, 0))),
    sum(i.quantity),
    'cart',
    v_user_id
  from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
  join public.products p on p.id = i.product_id
  returning id, total_amount into v_order_id, v_order_total;

  -- Check the actual stored total, never a client-provided price or subtotal.
  -- Raising here rolls the header back before any lines can be inserted.
  if v_order_total > 0 and coalesce((
    select value = 'true'::jsonb from public.site_content
    where key = 'min_order_enabled'
  ), false) then
    select greatest(0, coalesce((
      select (value #>> '{}')::numeric from public.site_content
      where key = 'min_order_value'
    ), 0)) into v_minimum;

    if v_order_total < v_minimum then
      raise exception 'Order total is below the minimum order value of %', v_minimum
        using errcode = '22023';
    end if;
  end if;

  for v_item in
    select
      i.quantity,
      p.id as product_id,
      p.sku,
      p.name,
      greatest(0, coalesce(p.price, 0)) as unit_price,
      p.unit_of_measure
    from jsonb_to_recordset(p_items) as i(product_id uuid, quantity integer)
    join public.products p on p.id = i.product_id
  loop
    insert into public.order_items (
      order_id, product_id, sku, product_name, quantity, unit_price,
      unit_of_measure, subtotal
    ) values (
      v_order_id,
      v_item.product_id,
      v_item.sku,
      v_item.name,
      v_item.quantity,
      v_item.unit_price,
      v_item.unit_of_measure,
      v_item.quantity * v_item.unit_price
    );
  end loop;

  return v_order_id;
end;
$$;

revoke all on function public.place_order_from_cart(text, text, jsonb)
  from public, anon;
grant execute on function public.place_order_from_cart(text, text, jsonb)
  to authenticated;

commit;
