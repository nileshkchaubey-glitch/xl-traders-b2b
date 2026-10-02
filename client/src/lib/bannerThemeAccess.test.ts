import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

describe("verified live banner/theme authorization policies", () => {
  it("keeps anonymous/customer writes blocked and admin management working", async () => {
    // In-memory only: no URLs, environment credentials, production rows or network.
    const db = new PGlite();
    const root = new URL("../../../", import.meta.url);
    const sql = (path: string) => readFile(new URL(path, root), "utf8");
    try {
      await db.exec(
        await sql("supabase/test-fixtures/authorization-baseline.sql")
      );
      await db.exec(
        await sql(
          "supabase/migrations/20260919104358_authorization_security_hardening.sql"
        )
      );
      await db.exec(`
        insert into auth.users (id,email) values
          ('10000000-0000-0000-0000-000000000001','customer@example.invalid'),
          ('10000000-0000-0000-0000-000000000002','admin@example.invalid');
        insert into public.user_profiles (id,email,is_admin) values
          ('10000000-0000-0000-0000-000000000001','customer@example.invalid',false),
          ('10000000-0000-0000-0000-000000000002','admin@example.invalid',true);
        -- Relevant objects/constraints/policies inspected live on 2 October.
        -- This is a synthetic test fixture, not an unapplied migration.
        create table public.promo_banners (
          id uuid primary key default gen_random_uuid(), headline text not null,
          image_url text, rate_line text, link_target text,
          position text not null default 'home_top' check(position in ('home_top','home_mid','category_top')),
          is_active boolean not null default false, sort_order integer not null default 0,
          starts_at timestamptz, ends_at timestamptz,
          check(starts_at is null or ends_at is null or ends_at > starts_at)
        );
        create table public.site_content (key text primary key,value jsonb,updated_at timestamptz default now());
        grant all on public.promo_banners,public.site_content to anon,authenticated;
        alter table public.promo_banners enable row level security;
        alter table public.site_content enable row level security;
        create policy public_read_live_banners on public.promo_banners for select to anon,authenticated
          using(is_active and (starts_at is null or now() >= starts_at) and (ends_at is null or now() < ends_at));
        create policy admins_manage_banners on public.promo_banners for all using(public.is_admin()) with check(public.is_admin());
        create policy "public read" on public.site_content for select using(true);
        create policy admins_manage_site_content on public.site_content for all using(public.is_admin()) with check(public.is_admin());
        insert into public.promo_banners (headline,is_active,starts_at,ends_at) values
          ('live',true,null,null),('inactive',false,null,null),
          ('future',true,now()+interval '1 day',null),('expired',true,null,now()-interval '1 day');
        insert into public.site_content values ('site_theme','{"theme":"default"}',now());
      `);
      for (const role of ["anon", "customer", "admin"]) {
        const sub =
          role === "admin"
            ? "10000000-0000-0000-0000-000000000002"
            : "10000000-0000-0000-0000-000000000001";
        await db.exec(
          `reset role; set role ${role === "anon" ? "anon" : "authenticated"}; select set_config('request.jwt.claims','${JSON.stringify(role === "anon" ? { role: "anon" } : { role: "authenticated", sub })}',false);`
        );
        const { rows } = await db.query<{ headline: string }>(
          "select headline from public.promo_banners order by headline"
        );
        if (role === "admin") {
          expect(rows.map(row => row.headline)).toEqual([
            "expired",
            "future",
            "inactive",
            "live",
          ]);
          await db.exec(
            "insert into public.promo_banners (headline) values ('new draft'); update public.promo_banners set is_active=false where headline='live'; update public.site_content set value='{\"theme\":\"diwali\"}' where key='site_theme';"
          );
          const result = await db.query<{ is_active: boolean }>(
            "select is_active from public.promo_banners where headline='new draft'"
          );
          expect(result.rows[0].is_active).toBe(false);
          const theme = await db.query<{ value: { theme: string } }>(
            "select value from public.site_content where key='site_theme'"
          );
          expect(theme.rows[0].value).toEqual({ theme: "diwali" });
        } else {
          expect(rows.map(row => row.headline)).toEqual(["live"]);
          await expect(
            db.exec(
              "insert into public.promo_banners (headline) values ('denied')"
            )
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            db.exec(
              "insert into public.site_content values ('site_theme','{\"theme\":\"holi\"}',now()) on conflict(key) do update set value=excluded.value"
            )
          ).rejects.toMatchObject({ code: "42501" });
          const update = await db.query(
            "update public.promo_banners set headline='denied' where headline='live' returning headline"
          );
          const remove = await db.query(
            "delete from public.promo_banners where headline='live' returning headline"
          );
          expect(update.rows).toEqual([]);
          expect(remove.rows).toEqual([]);
          const theme = await db.query<{ value: { theme: string } }>(
            "select value from public.site_content where key='site_theme'"
          );
          expect(theme.rows[0].value).toEqual({ theme: "default" });
        }
      }
    } finally {
      await db.close();
    }
  }, 15000);
});
