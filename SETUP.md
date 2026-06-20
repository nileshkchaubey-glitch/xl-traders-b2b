# XL Traders — Claude Code AI Product Manager (Full Kit)

Ye kit Claude Code me ek **AI product manager** banata hai jo aapke products khud manage
karta hai: duplicate rokta hai, AI se description likhta hai, suggestions deta hai, aur
images (upload ya AI-generate) handle karta hai. Plus website me 2-level category +
category image (emoji ki jagah) laga deta hai.

## ⚠️ Pehle ye karo (security)

Aapne purani secret key share kar di thi. Supabase → Settings → API → secret key
**Regenerate** karke nayi banao, aur sirf wahi nayi key `.env` me daalo.

## Kit me kya hai

```
.claude/agents/product-manager.md     # AI agent ka dimaag (dedup + desc + suggestions + images)
.claude/commands/setup-catalog-ui.md  # /setup-catalog-ui : website me 2-level + category image
scripts/xl-products.mjs               # Supabase product CLI (agent isi ko chalata hai)
sql/01-category-groups-migration.sql  # Supabase me chalao (groups + category images)
sql/02-master-admin-sheet.csv         # 284 products ka master sheet (import ke liye)
.env.example                          # keys (rename to .env, fill, DON'T commit)
```

## Install (ek baar)

Kit ke andar ki `.claude/`, `scripts/`, `sql/` folders apne repo (xl-traders-b2b) root me
copy karo, fir:

```bash
npm i @supabase/supabase-js
cp .env.example .env
# .env me nayi SUPABASE_SECRET_KEY paste karo
echo ".env" >> .gitignore
```

Supabase SQL Editor me `sql/01-category-groups-migration.sql` chala do.

## Use (Claude Code me normal language)

- "product-manager: 9 inch pizza box, 100 pcs, ₹290 add karo" → wo category/group pakdega,
  duplicate check karega, AI description likhega, aur add karega.
- "ye photo product pe laga do" + file path → upload karke laga dega.
- "is product ki AI image bana do" → `gen-image` (agar IMAGE*GEN*\* set hai).
- "master sheet import kar do" → `sql/02-master-admin-sheet.csv` se, duplicates skip.
- "Banners category ki image ye set karo: <url>"
- `/setup-catalog-ui` → website ke catalog me 2-level + emoji ki jagah category image laga dega.

## Notes

- `add` exact duplicate ko apne-aap block karta hai. Similar naam pe sirf heads-up.
- AI image **optional** hai — Claude khud image generate nahi karta; iske liye `.env` me
  apni image-API key chahiye. Description aur suggestions ke liye kuch extra nahi chahiye.
- Secret key kabhi GitHub pe push mat karna.
