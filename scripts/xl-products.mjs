#!/usr/bin/env node
/**
 * XL Traders — Product management CLI (used by the Claude Code product-manager agent)
 * Uses the Supabase SECRET (service) key from .env. Never commit .env.
 *
 * Commands:
 *   categories                      list groups -> categories
 *   list [--group G] [--category C] list products
 *   check --name "..."              duplicate / similar check (run BEFORE add)
 *   add --name --group --category --price [--image] [--desc] [--sku] [--force]
 *   update --id <uuid> [--name --price --desc --image --category --group]
 *   delete --id <uuid>
 *   set-category-image --category C --image URL
 *   upload-image --file ./x.jpg [--as name.jpg] [--type image/jpeg]   -> prints public URL
 *   gen-image --prompt "..." --as name.png   (OPTIONAL: needs IMAGE_GEN_* in .env)
 *   import-csv ./02-master-admin-sheet.csv [--force]
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// ---- load .env ----
try {
  const env = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "product-images";
if (!URL_ || !KEY) {
  console.error("❌ Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env");
  process.exit(1);
}
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const [cmd, ...rest] = process.argv.slice(2);
const args = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    args[rest[i].slice(2)] =
      rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true;
  } else args._ = rest[i];
}
const slug = s =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// EXACT-duplicate key: keep size/color/numbers (those distinguish products),
// only normalize case + punctuation + spacing. So "9 Inch Box (100 pcs)" stays
// different from "12 Inch Box (100 pcs)".
function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// LOOSE key (for similarity warning only): drop pack/size units so families group up.
function loose(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(
      /\b\d+\s?(pcs|pc|pkt|roll|rolls|kg|g|ml|ltr|l|inch|in|mtr|m|yard|set)\b/g,
      " "
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokens(s) {
  return new Set(loose(s).split(" ").filter(Boolean));
}
function jaccard(a, b) {
  const A = tokens(a),
    B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

async function allProducts() {
  const { data } = await db
    .from("products")
    .select(
      "id, name, price, image_url, category_id, categories(name, group_name)"
    );
  return data || [];
}

// returns {exact:[...], similar:[{name,score,id}...]}
async function duplicates(name) {
  const all = await allProducts();
  const n = norm(name);
  const exact = all.filter(p => norm(p.name) === n);
  const similar = all
    .map(p => ({ id: p.id, name: p.name, score: jaccard(name, p.name) }))
    .filter(x => x.score >= 0.6 && norm(x.name) !== n)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return { exact, similar };
}

async function ensureCategory(group, category, image) {
  const { data: ex } = await db
    .from("categories")
    .select("id, group_name, image_url")
    .eq("name", category)
    .maybeSingle();
  if (ex) {
    const patch = {};
    if (group && ex.group_name !== group) patch.group_name = group;
    if (image && !ex.image_url) patch.image_url = image;
    if (Object.keys(patch).length)
      await db.from("categories").update(patch).eq("id", ex.id);
    return ex.id;
  }
  let group_order = 99;
  if (group) {
    const { data: g } = await db
      .from("categories")
      .select("group_order")
      .eq("group_name", group)
      .limit(1)
      .maybeSingle();
    group_order = g?.group_order || 99;
  }
  const { data, error } = await db
    .from("categories")
    .insert({
      name: category,
      slug: slug(category),
      group_name: group || null,
      group_order,
      image_url: image || null,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`  ➕ category created: ${category} (group: ${group})`);
  return data.id;
}

async function genImage(prompt, asName) {
  const u = process.env.IMAGE_GEN_URL,
    k = process.env.IMAGE_GEN_KEY;
  if (!u || !k)
    throw new Error(
      "gen-image needs IMAGE_GEN_URL and IMAGE_GEN_KEY in .env (optional feature)"
    );
  const model = process.env.IMAGE_GEN_MODEL || "gpt-image-1";
  const res = await fetch(u, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size: process.env.IMAGE_GEN_SIZE || "1024x1024",
      n: 1,
    }),
  });
  if (!res.ok)
    throw new Error(
      "image gen failed: " + res.status + " " + (await res.text())
    );
  const j = await res.json();
  const item = j?.data?.[0] || {};
  let buf;
  if (item.b64_json) buf = Buffer.from(item.b64_json, "base64");
  else if (item.url)
    buf = Buffer.from(await (await fetch(item.url)).arrayBuffer());
  else throw new Error("image gen: no image in response");
  const key = `products/${Date.now()}-${(asName || "ai").replace(/\s+/g, "-")}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(key, buf, { contentType: "image/png", upsert: true });
  if (error) throw error;
  return db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

async function main() {
  switch (cmd) {
    case "categories": {
      const { data } = await db
        .from("categories")
        .select("name, group_name, group_order, image_url")
        .order("group_order")
        .order("name");
      let cur = null;
      for (const c of data || []) {
        if (c.group_name !== cur) {
          cur = c.group_name;
          console.log(`\n=== ${cur} ===`);
        }
        console.log(`  • ${c.name}${c.image_url ? " 🖼️" : " (no img)"}`);
      }
      break;
    }
    case "list": {
      let rows = await allProducts();
      if (args.group)
        rows = rows.filter(r => r.categories?.group_name === args.group);
      if (args.category)
        rows = rows.filter(r => r.categories?.name === args.category);
      rows.forEach(r =>
        console.log(
          `${r.id}  ₹${r.price}  ${r.name}  [${r.categories?.group_name} / ${r.categories?.name}]${r.image_url ? " 🖼️" : " (no image)"}`
        )
      );
      console.log(`\n${rows.length} products`);
      break;
    }
    case "check": {
      if (!args.name) {
        console.error("need --name");
        process.exit(1);
      }
      const { exact, similar } = await duplicates(args.name);
      if (exact.length) {
        console.log("DUPLICATE — already exists:");
        exact.forEach(p => console.log(`  ${p.id}  ${p.name}`));
      } else console.log("No exact duplicate.");
      if (similar.length) {
        console.log("Similar (confirm before adding):");
        similar.forEach(s =>
          console.log(`  ${(s.score * 100) | 0}%  ${s.name}`)
        );
      }
      break;
    }
    case "add": {
      if (!args.name || !args.category) {
        console.error("need --name and --category");
        process.exit(1);
      }
      const { exact, similar } = await duplicates(args.name);
      if (exact.length && !args.force) {
        console.error(
          `❌ DUPLICATE: "${exact[0].name}" already exists (id ${exact[0].id}). Use 'update' to edit it, or --force to add anyway.`
        );
        process.exit(2);
      }
      if (similar.length) {
        console.error(
          "ℹ️  Similar products already exist (heads-up, not blocking):"
        );
        similar.forEach(s =>
          console.error(`   ${(s.score * 100) | 0}%  ${s.name}`)
        );
      }
      const category_id = await ensureCategory(
        args.group,
        args.category,
        args.image
      );
      const { data, error } = await db
        .from("products")
        .insert({
          name: args.name,
          category_id,
          price: args.price ? Number(args.price) : 0,
          description: args.desc || "",
          image_url: args.image || null,
          sku: args.sku || null,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      console.log(`✅ added: ${args.name}  (id ${data.id})`);
      break;
    }
    case "update": {
      if (!args.id) {
        console.error("need --id");
        process.exit(1);
      }
      const patch = {};
      if (args.name) patch.name = args.name;
      if (args.price) patch.price = Number(args.price);
      if (args.desc) patch.description = args.desc;
      if (args.image) patch.image_url = args.image;
      if (args.category)
        patch.category_id = await ensureCategory(
          args.group,
          args.category,
          args.image
        );
      const { error } = await db
        .from("products")
        .update(patch)
        .eq("id", args.id);
      if (error) throw error;
      console.log(`✅ updated ${args.id}`);
      break;
    }
    case "delete": {
      if (!args.id) {
        console.error("need --id");
        process.exit(1);
      }
      const { error } = await db.from("products").delete().eq("id", args.id);
      if (error) throw error;
      console.log(`🗑️  deleted ${args.id}`);
      break;
    }
    case "set-category-image": {
      if (!args.category || !args.image) {
        console.error("need --category and --image");
        process.exit(1);
      }
      const { error } = await db
        .from("categories")
        .update({ image_url: args.image })
        .eq("name", args.category);
      if (error) throw error;
      console.log(`✅ category image set: ${args.category}`);
      break;
    }
    case "upload-image": {
      if (!args.file) {
        console.error("need --file");
        process.exit(1);
      }
      const buf = fs.readFileSync(args.file);
      const key = `products/${Date.now()}-${(args.as || path.basename(args.file)).replace(/\s+/g, "-")}`;
      const { error } = await db.storage
        .from(BUCKET)
        .upload(key, buf, {
          contentType: args.type || "image/jpeg",
          upsert: true,
        });
      if (error) throw error;
      console.log(db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl);
      break;
    }
    case "gen-image": {
      if (!args.prompt) {
        console.error("need --prompt");
        process.exit(1);
      }
      console.log(await genImage(args.prompt, args.as));
      break;
    }
    case "import-csv": {
      const file = args._ || args.file;
      if (!file) {
        console.error("usage: import-csv <path>");
        process.exit(1);
      }
      const rows = parseCSV(
        fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")
      );
      const head = rows.shift().map(h => h.trim().toLowerCase());
      const at = n => head.indexOf(n);
      const all = await allProducts();
      const seen = new Map(all.map(p => [norm(p.name), p.id]));
      let added = 0,
        updated = 0,
        skipped = 0;
      for (const r of rows) {
        const name = r[at("name")];
        if (!name) continue;
        const n = norm(name);
        const category_id = await ensureCategory(
          r[at("group")],
          r[at("category")],
          r[at("image_url")]
        );
        const payload = {
          name,
          category_id,
          price: Number((r[at("price")] || "0").replace(/[₹,]/g, "")) || 0,
          description: at("description") >= 0 ? r[at("description")] || "" : "",
          image_url: at("image_url") >= 0 ? r[at("image_url")] || null : null,
          sku: at("sku") >= 0 ? r[at("sku")] || null : null,
          is_active: true,
        };
        if (seen.has(n)) {
          await db.from("products").update(payload).eq("id", seen.get(n));
          updated++;
        } else {
          const { data } = await db
            .from("products")
            .insert(payload)
            .select("id")
            .single();
          if (data) seen.set(n, data.id);
          added++;
        }
        if ((added + updated) % 25 === 0)
          console.log(`  ...${added + updated} processed`);
      }
      console.log(
        `✅ done. added ${added}, updated ${updated}, skipped ${skipped} (dedup by normalized name)`
      );
      break;
    }
    default:
      console.log(
        "commands: categories | list | check | add | update | delete | set-category-image | upload-image | gen-image | import-csv"
      );
  }
}

function parseCSV(text) {
  const out = [];
  let row = [],
    f = "",
    q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        f += '"';
        i++;
      } else if (c === '"') q = false;
      else f += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        row.push(f);
        f = "";
      } else if (c === "\n") {
        row.push(f);
        out.push(row);
        row = [];
        f = "";
      } else if (c === "\r") {
      } else f += c;
    }
  }
  if (f.length || row.length) {
    row.push(f);
    out.push(row);
  }
  return out;
}

main().catch(e => {
  console.error("❌", e.message || e);
  process.exit(1);
});
