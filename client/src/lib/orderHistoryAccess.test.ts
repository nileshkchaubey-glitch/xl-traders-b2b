import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
describe("inspected production history policies", () => {
  it("isolates customer orders/items, hides legacy unowned orders and preserves admin access", async () => {
    const db = new PGlite();
    const root = new URL("../../../", import.meta.url);
    try {
      await db.exec(
        await readFile(
          new URL("supabase/test-fixtures/authorization-baseline.sql", root),
          "utf8"
        )
      );
      await db.exec(
        await readFile(
          new URL(
            "supabase/migrations/20260919104358_authorization_security_hardening.sql",
            root
          ),
          "utf8"
        )
      );
      await db.exec(`
        insert into auth.users(id,email) values
          ('10000000-0000-0000-0000-000000000001','one@example.invalid'),
          ('10000000-0000-0000-0000-000000000002','two@example.invalid'),
          ('10000000-0000-0000-0000-000000000003','admin@example.invalid');
        insert into public.user_profiles(id,email,is_admin) select id,email,id='10000000-0000-0000-0000-000000000003'::uuid from auth.users;
        create table public.orders(id uuid primary key,user_id uuid,total_amount numeric);
        create table public.order_items(id uuid primary key,order_id uuid references public.orders(id),quantity integer,unit_price numeric);
        grant all on public.orders,public.order_items to anon,authenticated;
        alter table public.orders enable row level security;
        alter table public.order_items enable row level security;
        create policy admins_manage_orders on public.orders for all using(public.is_admin()) with check(public.is_admin());
        create policy users_read_own_orders on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
        create policy admins_manage_order_items on public.order_items for all using(public.is_admin()) with check(public.is_admin());
        create policy users_read_own_order_items on public.order_items for select to authenticated using(public.is_admin() or exists(select 1 from public.orders o where o.id=order_items.order_id and o.user_id=auth.uid()));
        insert into public.orders values
          ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',100),
          ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',200),
          ('20000000-0000-0000-0000-000000000003',null,300);
        insert into public.order_items select id,id,2,100 from public.orders;
      `);
      for (const [role, sub, total] of [
        ["anon", "", 0],
        ["authenticated", "10000000-0000-0000-0000-000000000001", 1],
        ["authenticated", "10000000-0000-0000-0000-000000000002", 1],
        ["authenticated", "10000000-0000-0000-0000-000000000003", 3],
      ] as const) {
        await db.exec(
          `reset role;set role ${role};select set_config('request.jwt.claims','${JSON.stringify({ role, ...(sub ? { sub } : {}) })}',false);`
        );
        const orders = await db.query<{ user_id: string | null }>(
          "select user_id from public.orders"
        );
        const items = await db.query("select id from public.order_items");
        expect(orders.rows).toHaveLength(total);
        expect(items.rows).toHaveLength(total);
        if (total === 1) expect(orders.rows[0].user_id).toBe(sub);
        if (total !== 3)
          await expect(
            db.exec(
              "insert into public.orders values(gen_random_uuid(),auth.uid(),1)"
            )
          ).rejects.toMatchObject({ code: "42501" });
      }
    } finally {
      await db.close();
    }
  }, 15000);
});
