# Block B — repo audit. Lists only, nothing deleted.

Read-only. Every verdict below has a mechanical check behind it, named inline so
it can be re-run. **No files, branches or dependencies were removed.**

Two method notes, because both changed the answer:

- **File reachability is a resolved import graph, not greps.** Aliases (`@/`),
  extension resolution and `index.*` are all resolved, and reachability is
  walked from `main.tsx`. A substring grep produced a false "two lazy chunks
  share it" claim once before.
- **Branch state comes from the GitHub PR API, not `git branch --merged` or
  `git cherry`.** Both under-report: `--merged` misses squash merges entirely,
  and `git cherry` over-reports them, because squashing changes the patch-id.
  Using `git cherry` alone would have flagged 37 branches as carrying unique
  work when only 24 do.

---

## 1. Files under `client/src`

174 files. **137 reachable from `main.tsx`; 37 not.**

### DELETE — 32 unused shadcn primitives

None is imported by any reachable file. Two of them (`separator`, `toggle`) are
imported, but only by other files in this same dead set — a self-contained
cluster, which a naive "has importers" check would have kept.

```
components/ui/  accordion  alert  aspect-ratio  avatar  breadcrumb
                button-group  calendar  carousel  chart  collapsible
                empty  field  form  hover-card  input-group  input-otp
                item  kbd  menubar  navigation-menu  pagination  progress
                radio-group  resizable  scroll-area  separator  sidebar
                slider  spinner  tabs  toggle  toggle-group
```

Proof: `zeroImporters` ∪ dead-cluster from the resolved graph; re-runnable.

### KEEP — 5 test files

`lib/{catalogQuery,orderMessage,orderingModel,priceEntryMode,searchFilter}.test.ts`
are unreachable from `main.tsx` **by design** — vitest is their entry point, not
the app. A reachability-only sweep would delete the entire test suite.

### ASK THE OWNER — 1

- **`components/ui/breadcrumb.tsx`.** Unused, but three storefront pages now
  hand-roll a breadcrumb (`Catalog`, `ProductDetail`, `Account`). Deleting it
  and later rebuilding it by hand is the drift this audit exists to prevent.
  Either delete it *and* record that crumbs are hand-rolled, or adopt it. Not a
  judgment I should make alone.

---

## 2. Remote branches

**135 branches. 111 are merged and safe to delete.**

| state | count | safe to delete |
| --- | --- | --- |
| merged, ancestor of `main` | 85 | yes |
| merged by squash (PR closed as merged) | 26 | yes |
| PR closed **without** merging | 6 | see below |
| never had a PR | 18 | see below |

### KEEP — 1, as instructed

`feat/storefront-rate-card` (PR #142 closed unmerged). Note it is **also pinned
by the tag `pr142-backup`**, which exists locally and on the remote — so the
work survives even if the branch is ever deleted. Keeping both is belt and
braces, which is fine.

### KEEP — 1, because a live doc depends on it

`docs/data-entry-ux-audit` carries `docs/XL-Traders-Data-Entry-UX-Audit.md`,
which is **not in `main`**, and `CLAUDE.md:625` points at the branch by name:
_"audit doc lives on branch `docs/data-entry-ux-audit`, not yet merged"_.
Deleting the branch deletes the document. Either merge the doc or keep the
branch — but the reference must not outlive the branch.

### ASK THE OWNER — 22

- **`claude/storefront-design-proposals-77zaju`** — same shape as above, but
  worse. It carries `docs/STOREFRONT_DESIGN_PROPOSALS.md` (470 lines), which is
  **not in `main`**, while `CLAUDE.md` and `docs/DESIGN_SYSTEM.md` both cite it
  as the source of shipped PR1/PR2/PR3. **This one is already a broken
  reference** (list 6). Merge the doc or drop the citations.
- **4 × `devin/*`** (PRs #21–#24, closed unmerged, 5 Jun) — unit tests, shared
  utils, error handling, security fixes. Old, but the *subjects* are things we
  have since done by hand. Worth a look before deletion.
- **`feat/price-protection`** (PR #15, closed unmerged, 3 Jun) — superseded:
  price security now lives in column-level grants. Almost certainly deletable.
- **16 × `claude/friendly-dijkstra-*`** — bot branches from June, no PR ever
  opened, 1 commit each. Almost certainly deletable; listed rather than assumed.

---

## 3. Dependencies, exports and SQL

### DELETE — 8 dependencies with zero references

Checked against the import graph **plus** every config file, `scripts/`, and the
npm scripts — and *excluding* `package.json` itself, which names every dependency
and made the first run of this check report zero.

| package | note |
| --- | --- |
| `framer-motion` | **This one matters** — `CLAUDE.md` still describes Home's scroll-reveal sections as framer-motion. Those components were deleted; the dependency outlived them. Also list 4. |
| `@hookform/resolvers` | `react-hook-form` is used in exactly 1 file; the resolver is not |
| `zod` | not imported anywhere |
| `@tanstack/react-virtual` | not imported anywhere |
| `axios` | not imported anywhere — the app uses the Supabase client |
| `nanoid` | not imported anywhere |
| `streamdown` | not imported anywhere |
| `tailwindcss-animate` | a Tailwind **v3** plugin in a v4 project with no config file |

### ASK THE OWNER — 4 devDependencies

`@tailwindcss/typography`, `autoprefixer`, `postcss` — there is **no
`postcss.config.*` or `tailwind.config.*` in the repo** and no `@plugin` in
`index.css`, so none appears to be loaded. But Tailwind v4 runs through the Vite
plugin, and I would rather you confirm than have me break the build.
(`typescript` and the four `@types/*` packages also show no textual reference;
those are **false positives** — `tsc` consumes them implicitly. Not for deletion.)

### Unused exports — 242 total, but only ~10 worth touching

Most are `components/ui/**` re-exports (expected for shadcn) or **type**
exports, which are a module's legitimate public surface. The value exports never
named in any other file:

```
lib/adminDailyImprovements.ts  QUICK_WINS, MEDIUM_IMPROVEMENTS,
                               MAJOR_IMPROVEMENTS, COMPLETED_SUGGESTIONS
lib/aiService.ts               chatAssist
lib/bulkImportService.ts       generateCSVTemplate
lib/catalogHealth.ts           metaDescriptionFor
lib/googleSheetsService.ts     buildCsvExportUrl, parseSheetInput
lib/imageUtils.ts              extractDriveFileId
lib/templateService.ts         TEMPLATE_COLUMNS
```

`adminDailyImprovements` exporting **all four** of its data sets unused is the
one that suggests a dead feature rather than a stray export. Worth a look.

### SQL — nothing dead, two unreferenced

Everything in `sql/` and `docs/sql/` is a historical migration or its
verification record — evidence, not executable code. Two have no inbound
reference: `docs/sql/pr1-verification.md` and `sql/03-assign-groups.sql`.

**`sql/02-public-read-policies.sql` must be KEPT regardless of references.** It
is annotated in place as "must never be re-run" — the file is a *warning*, and
deleting it deletes the warning.

---

## 4. Doc claims contradicting the code — the #168 species

Assume more exist than are listed; this is what a mechanical name-check found.

| claim | reality |
| --- | --- |
| `CLAUDE.md` describes **`HeroMotionTiles`** in the present tense across **5 passages** — "auto-rotating motion tiles", "gains a wildcard beat", "is `hidden lg:block`" | The component **does not exist**. Its CSS (`.xl-kenburns`, `.xl-hero-crossfade`) is still in `index.css` with zero consumers (list 5). |
| `CLAUDE.md` describes **`HomeCatalogueShowcase`** as shipped | **Does not exist** |
| `CLAUDE.md` Home section lists scroll-reveal sections **(framer-motion)** | framer-motion is imported **nowhere** (list 3) |
| `CLAUDE.md` cites `docs/STOREFRONT_DESIGN_PROPOSALS.md` as the source of PR1/2/3 | **Not in the repo** — branch-only (list 2) |
| `CLAUDE.md` cites `scripts/check-price-entry.ts` | **Does not exist** — it became a vitest suite, which `CLAUDE.md` itself says elsewhere. The doc contradicts itself. |
| `docs/DESIGN_SYSTEM.md` cites `HomeCatalogueShowcase.tsx` | Does not exist |
| `docs/ORDERING_MODEL.md` cites `scripts/check-ordering-model.ts` and `check-price-entry.ts` | Neither exists |
| **Home's actual composition** is `HeroSlideshow → PromoBanners → HomeCategoryGrid → HomeSpotlightStrip → PromoBanners → MerchandisedRow ×2` | `MerchandisedRow` and `HomeSpotlightStrip` are **not mentioned once** in `CLAUDE.md`. The doc describes a Home page that no longer exists. |

Four further references point at files documented as deleted (`CartDrawer`,
`AddToCartButton`, `HomeDailySuggestion`, `dailySuggestions.ts`) — those read as
history and are **correct**, not defects.

---

## 5. Out-of-layer arbitrary properties

Unlayered CSS outranks Tailwind's `utilities` layer, so a utility on the same
element silently loses. Six unlayered class rules exist; four set `animation`.

| rule | consumers | who wins today |
| --- | --- | --- |
| `.xl-marquee` (`index.css:28`) | `HomeSpotlightStrip` | **Utility loses, inline style wins.** `[animation-duration:52s]` was measured doing nothing (34s rendered); an inline style is used instead and is the only thing that cannot lose. Already fixed and documented. |
| `.xl-kenburns` (`:24`) | **none** | Dead — its component was deleted. DELETE candidate. |
| `.xl-hero-crossfade` (in the reduced-motion block) | **none** | Dead — same. DELETE candidate. |
| `.xl-hero-slide` (`:260`) | `HeroSlideshow` | No competing utility today. **Latent** — any future `animate-*` on that element loses silently. |
| `.xl-hero-dot` (`:280`) | `HeroSlideshow` | Same latent risk. |
| `.dark` (`:388`) | theme selector | Not a conflict. |

### The same pattern in component classes — two still LOSING

| site | competing rule | winner |
| --- | --- | --- |
| `MobileCategorySheet.tsx:101` `max-h-[88vh]` | `ui/drawer` sets `data-[vaul-drawer-direction=bottom]:max-h-[80vh]` (0,2,0) | **The variant. The `88vh` is inert** — the sheet is 80vh. |
| `MobileMasterSheet.tsx:55` `max-h-[88vh]` | same | **Inert, same defect** |
| `CatalogFilterSheet.tsx:124` | matches the variant, so tailwind-merge dedupes | **Correct — the fixed reference case** |
| Admin `DialogContent max-h-[90vh]` ×3 | `ui/dialog` sets **no** max-h | **The utility wins. Fine.** |

`.container` is no longer used by any component — `xl-shell` replaced it — so
the #167 conflict is now dormant rather than live.

---

## 6. Dead internal links

**Routes: clean.** Every internal link target (`/`, `/admin`, `/admin/masters`,
`/auth`, `/cart`, `/catalog`, `/categories`, `/product/:id`) resolves to a route
in `App.tsx`. No dead route links.

**Docs: 11 broken references**, listed in full in list 4 above plus:

```
.claude/skills/setup-catalog-ui/SKILL.md -> client/src/pages/Admin.tsx   (gone)
docs/STOREFRONT_V3_PLAN.md               -> 4 files deleted in the dead-code pass
```

The `STOREFRONT_V3_PLAN` four are historical narrative and read correctly. The
skill reference is a live instruction pointing at a file that does not exist —
that one will mislead whoever runs `/setup-catalog-ui`.

*(My first run of this check reported 17 broken links. Six were my own bug —
backtick paths are repo-root-relative and I resolved them against the containing
file's directory. Corrected before this list.)*

---

## Summary of what deletion would remove

| | count |
| --- | --- |
| files (`components/ui/**`) | 32 |
| remote branches (merged) | 111 |
| dependencies | 8 |
| devDependencies (pending your confirmation) | 3 |
| unlayered dead CSS rules | 2 |
| value exports | ~10 |

**Ask-the-owner items: 24** — 22 branches, 1 file, 3 devDependencies, plus the
two branch-only documents that live references depend on.

Nothing above has been deleted.
