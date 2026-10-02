# Dependency cleanup after UI removal

Block B PR-3, checked after #199 removed the individually verified unused UI
primitives. The eight original runtime candidates were already removed in #182.
They were not removed twice.

`npm exec --yes --package depcheck -- depcheck --json` was followed by source,
dynamic import, CSS, config, scripts and workflow inspection. No runtime package
below has a remaining import or config consumer:

- Radix: accordion, aspect-ratio, avatar, collapsible, hover-card, menubar,
  navigation-menu, progress, radio-group, scroll-area, separator, slider, tabs,
  toggle, toggle-group (the corresponding `@radix-ui/react-*` packages).
- embla-carousel-react, input-otp, react-day-picker, react-hook-form,
  react-resizable-panels, recharts.

The three historical owner-confirmation candidates were rechecked under the
owner's October instruction to review all dependencies: `@tailwindcss/typography`,
`autoprefixer` and the direct `postcss` declaration. There is no PostCSS/Tailwind
config or typography `@plugin` consumer. Tailwind runs through `@tailwindcss/vite`.
These direct declarations were removed; PostCSS remains transitively available
to Vite's actual build pipeline.

False positives retained: `tw-animate-css` and `tailwindcss` are imported by
`client/src/index.css`. TypeScript and the type packages are used by the compiler;
the Vite/React/Tailwind/PWA/test toolchain remains. Depcheck also reports missing
node-fetch/csv-parse in the historical `scripts/import-from-sheet.ts`, which is
not a supported npm command or browser import flow; it was not executed against
production and does not justify adding runtime dependencies.

The npm v3 lockfile is regenerated and keeps the pinned SheetJS 0.20.3 tarball.
No pnpm lockfile was added. `npm audit --omit=dev --json` reports zero runtime
vulnerabilities; the existing development-tool audit findings are separate.
The first clean `npm ci` failed with Windows EPERM because the local Vite server
held lightningcss's native module open. Stopping that task-owned server releases
the file; the clean install and full CI are rerun before merge. This is recorded
as an install failure, not a passing first attempt. The retry installed 490
packages successfully. Full Node 20.20.2 `npm run ci` passed: 179 application
tests, 41 authorization, 12 minimum-order and 13 reconfirmation checks,
TypeScript, storefront guardrails, production build and PWA generation.
Every retained direct dependency's installed version matches the predecessor
lockfile; no unrelated upgrade was introduced.
