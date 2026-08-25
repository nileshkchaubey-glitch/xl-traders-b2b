# PDP and Cart — deviation list (measured, before any fix)

Method: the standalone prototype served locally and read via **computed
styles** at 1440 and 390 (STOREFRONT_RULES §6.1), compared against our pages in
a second tab at the same widths. Every row below is a measurement, not a
reading of markup.

**Nothing here is fixed yet.** This is the list to agree before work starts.

## Coverage and its limits

| | prototype | ours |
| --- | --- | --- |
| PDP desktop 1440 | guest | guest |
| PDP mobile 390 | **signed in** | guest |
| Cart desktop 1440 | guest | guest (seeded line, on-enquiry product) |
| Cart mobile 390 | guest | guest (seeded line) |

Two gaps, stated rather than papered over:

- **Our signed-in states are not measured.** `hasSession()` reads the real
  Supabase session, so it needs the temporary local harness in §4.1. I will run
  it before claiming parity on any price-bearing row (P-12, P-16, C-5, C-6).
- **Our cart line is an on-enquiry product**, because the only products a guest
  can add are on-enquiry ones. So our money rows read "On enquiry" where the
  prototype reads "—". That is the price gate behaving correctly, not a
  deviation, and the two are not comparable until the harness runs.

---

## PDP — desktop 1440

| # | element | prototype | ours | kind |
| --- | --- | --- | --- | --- |
| **P-1** | hero image box | 653 × **430**, `bg #f8fafc`, radius 16, **no border** | 665 × **665** (square), `bg #fff`, radius 16, **1px #e2e8f0 border** | structural — ours is 235px taller and boxed |
| **P-2** | right column | `position: static` | `position: sticky; top: 96px` | structural |
| **P-3** | title | 28px / 800 | 24px / 800 | −4px |
| **P-4** | spec line | `AL-4CP · 25 pcs/pack · Areca leaf` — 12.5 / 600 `#64748b` | `SKU HINGED-BOX-2000-ML` — 11 / 400 `#64748b` | content + type: ours carries SKU only, no pack size, no material |
| **P-5** | MOQ / step | two pills under the price — MOQ amber (`#fffbeb` on `#fef3c7`, text `#b45309`) and **Step** (white on `#e2e8f0`, text `#334155`), both 11.5 / 700, padding 6/11, radius 99 | no pill pair in that slot; MOQ appears lower as plain text, **no step affordance at all** | structural |
| **P-6** | primary action | `Add to cart` red `#dc2626`, 14 / 800, 350 × 50, radius 12 — beside `Enquire` (`#ecfdf5` on `#a7f3d0`, text `#047857`, 13 / 800, 87 × 50) | one full-width `Enquire on WhatsApp` (white on `#a7f3d0`, 15 / 700, 631 × 48) | structural — prototype pairs a primary and secondary; ours has one |
| **P-7** | guest price block | `Sign in for rates` 12 / 800 + a sentence naming per-piece rates + a Sign in button | `Sign in for rates` **20px** / 800 red + `Wholesale rates for businesses` | type + copy |
| **P-8** | below the split | nothing — specs and description sit **inside the right column** | a full-width `Similar products` section | structural (ours adds) |
| **P-9** | split grid | `653px 653px`, gap 32 | `664.5px 664.5px`, gap 32 | ✔ **matches** (width differs only by shell padding) |
| **P-10** | thumb strip | 4-up, 155.75px, gap 10, h 96 | 4-up, 158.6px, gap 10, h 96 | ✔ **matches** |

## PDP — mobile 390

| # | element | prototype | ours | kind |
| --- | --- | --- | --- | --- |
| **P-11** | top of page | `←` back and `Share`, overlaid on the image area | breadcrumb `Home / Catalogue / <name>`, no back arrow, no share | structural — same split the catalogue had, already settled there in favour of the back arrow |
| **P-12** | title | 19 / 800 | 24 / 800 | −5px |
| **P-13** | action bar | **none fixed** — `Order quantity`, stepper, line total and `Add to cart · ₹5,187` all sit inline in the flow | a **fixed** bar at the bottom (65px, above the 65px nav) carrying `Sign in for rates · Minimum 480 pack · Enquire` | structural — needs a decision, see below |
| **P-14** | price (signed in) | `₹17.29` 27 / 800 red + `/ 1 pcs` 12 / 700 + `₹865 per pack of 50` 12 / 600 | not measured — needs the §4.1 harness | — |

**P-13 is the one I would not change without you.** The prototype puts the buy
action inline; we ship a fixed bottom bar. The bar is a real mobile-commerce
affordance and it is what `CLAUDE.md` records as deliberate. Following the
prototype here removes a persistent buy button on a long page. My
recommendation: **keep our bar**, record it as a deviation, and take the
prototype's inline block as well so the action is reachable both ways — but
that is a product call, not a layout one.

## Cart — desktop 1440

| # | element | prototype | ours | kind |
| --- | --- | --- | --- | --- |
| **C-1** | title | `Your cart` 24 / 800, with `1 item · 700 pcs` on its **own line** beneath, plus a `Continue shopping` link | `Your Cart1 item · 3,360 quantities` — the count is **inside the `<h1>`**, so a screen reader reads it as part of the page heading. No `Continue shopping`. | structural + a11y |
| **C-2** | guest banner | `Rates and order total are visible once you sign in. Quantities you set now are kept.` + Sign in | **absent** | content — the second sentence is the reassurance that makes a guest keep filling the cart |
| **C-3** | line item | brand eyebrow, name, `Sign in for rates`, `100 pcs/pack · MOQ 700 pcs · 7 packs`, `—`, Remove, then labelled **ORDER RULE** and **QUANTITY** blocks | name, `7 packs`, `MOQ 1 pack`, `Price on enquiry`, an unlabelled stepper, `—` | structural — no brand, no pack size, no labelled sections |
| **C-4** | summary rows | `Subtotal (700 pcs)` / `Freight` / `Total payable` | `Items` / `Quantities` / `Selling units` / `Total` | content — ours reports inventory facts, the prototype reports money |
| **C-5** | summary header | a band, `bg #f8fafc`, 12 / 800, 10/13 padding, bottom border | no band — heading sits on white | presentation |
| **C-6** | actions | `Sign in to place order` **and** `Send cart on WhatsApp` | `Send order on WhatsApp` only | structural |
| **C-7** | order notes | none | `ORDER NOTES (OPTIONAL)` textarea | ours adds — keep, it feeds the WhatsApp message |
| **C-8** | grid | `984px 340px`, gap 20; summary sticky `top: 80px`, radius 16 | `1016px 340px`, gap 20; summary sticky `top: 96px`, radius 16 | ✔ **matches** (the 96 vs 80 is our taller header) |

## Cart — mobile 390

| # | element | prototype | ours | kind |
| --- | --- | --- | --- | --- |
| **C-9** | title bar | `←` · `Your cart` 16 / 800 over `1 item · 700 pcs` 11 / 600 — **the same bar the catalogue uses** | `<h1>` 24 / 800 with the count inside it; no back arrow | structural — and the catalogue already has the prototype's bar, so the two of ours now disagree |
| **C-10** | checkout bar | a red `#dc2626` bar, radius 14, 55px: `Sign in for rates` / `1 item · 700 pcs` / white `Checkout` pill (12 / 800, `#b91c1c`) | **none** — only the bottom nav | structural — no way to check out from the bottom of the page |
| **C-11** | summary card | radius 14 with the `#f8fafc` header band | white card, no band | presentation |

---

## Proposed order

1. **C-9 + C-1** — the cart title bar, both breakpoints. Highest value: it is the
   pattern the catalogue already ships, it fixes an `<h1>` that currently
   swallows the item count, and the two pages stop disagreeing.
2. **C-10** — the mobile checkout bar. Today there is no checkout affordance at
   the bottom of a long cart.
3. **P-1 + P-3 + P-4 + P-5** — PDP image proportion, title size, spec line, and
   the MOQ/step pill pair. P-1 is the biggest single visual difference on the
   page.
4. **P-11 + P-12** — PDP mobile top bar and title.
5. **C-2 … C-6** — cart line and summary content. Some of this is copy that
   needs your eye, since the prototype's money rows assume a rate we hide.
6. **P-2, P-6, P-13, C-7** — the four where I would keep ours or want a decision
   first.

`§4.1` card-height parity is unaffected so far — nothing above touches
`ProductCard` or `PriceSlot`. I will re-measure it if that changes.
