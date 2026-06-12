---
name: Admin JSX closing tag pattern
description: Why plain divs are used instead of Shadcn Card for wrappers in admin tables/grids
---

## Rule
When replacing `<Card>` with a styled `<div>` in admin components, ALWAYS update both the opening and closing tag in the same edit. Babel/Vite will throw "Expected corresponding JSX closing tag for `<div>`" if the opening is `<div>` but the closing is still `</Card>`.

## How to apply
When editing any admin component that has a `<Card>` wrapper around a table or list:
1. Open the file and find BOTH the opening `<Card ...>` and its matching `</Card>`
2. Replace both in a single edit, or ensure you do two separate edits: one for open, one for close

**Why:** Multiple times during the admin redesign, only the opening `<Card>` was replaced with `<div>` but the closing `</Card>` was left, causing a compile error on every affected file (AdminProducts, AdminEnquiries, AdminCategories).
