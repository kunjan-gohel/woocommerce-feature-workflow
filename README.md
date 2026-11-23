# WooCommerce Feature Workflow (WLIQ)

A Claude skill for building, debugging and reviewing WooCommerce features end to end at WLIQ:
PHP, hooks, REST API, webhooks, AJAX and frontend. It includes security checks, test cases and AI time logging.

## What it does

The skill walks Claude through six modes:

1. **Breakdown**: turn a task or Orbit ticket into an approach, risks and an estimate before any code is written
2. **Build**: full files with paths, following WooCommerce CRUD/HPOS, nonce, sanitizing and escaping rules
3. **Debug**: a step-by-step checklist (logs, conflicts, caching, script concatenation, common context traps)
4. **Review**: a pass/fail table covering security, WooCommerce and code quality before PR/QA
5. **Tests**: test cases for guest and logged-in users, product types, totals, nonces, mobile and API failures
6. **Handoff**: an Orbit summary plus a time-log row (quoted vs actual AI-assisted hours)

Plus a **Design mode** for the storefront: Shop, Product detail, Cart, Checkout and My Account pages, on classic themes, block themes or Elementor. It matches the existing site design (pulls colors, fonts, buttons, forms and spacing from the site's global settings) and ends with a design QA checklist.

It works at the standard of a **senior WooCommerce engineer (8–10+ years)** and is fully self-contained. It needs no other skills, so it works in any Claude account.

## Structure

```
woocommerce-feature-workflow/
├── SKILL.md                      # Workflow, modes, review & test standards
└── references/
    ├── woocommerce-core.md       # Plugin skeleton, CRUD/HPOS, hooks, Blocks vs classic, performance
    ├── rest-webhooks.md          # REST endpoints, Store API, webhooks, API clients, retries
    ├── ajax-frontend.md          # AJAX, JS events, Blocks JS, frontend & accessibility rules
    ├── security.md               # Sanitize/escape, nonces, capabilities, SQL, secrets, checklist
    ├── debugging.md              # Debug steps, symptom → cause table, WP-CLI
    └── storefront-design.md      # Shop/product/cart/checkout/account design, theme & builder detection, design QA
scripts/
└── responsive-sweep.js           # Playwright sweep: overflow, small tap targets, full-page screenshots per width
```

## Install

1. Download the zip from Releases (or **Code → Download ZIP**, then make sure the zip contains the `woocommerce-feature-workflow/` folder with `SKILL.md` at its root).
2. In Claude, go to **Settings → Capabilities → Skills → Upload skill**, choose the zip, and turn it on.
3. Org admins can share it with the whole team from the same place.

## Prompt starters

- `Use woocommerce-feature-workflow. Here is the task: <paste>. Site runs WC <ver>, <classic/Blocks> checkout. Give me the breakdown only.`
- `Approach approved. Build it as a site plugin <slug>, prefix <prefix>_. Full files with paths.`
- `Debug mode. Symptom: <…>. Steps: <…>. debug.log says: <paste, secrets removed>.`
- `Review mode. Check this code against the review checklist: <paste>.`
- `Write test cases for: <feature summary>.`
- `Handoff mode. Orbit task <id>, quoted <x> hrs, actual <y> hrs.`

## Ground rules

- Staging only. No production credentials, API keys or customer data in AI tools.
- AI writes the first draft. The developer reviews, tests and owns the final code.

## Status

v3.6: self-contained, senior-level standard, with storefront design that matches the existing site, 20+ known gotchas from real tests, and a responsive sweep script. Part of the WLIQ Pod B AI plan (Dec 31 goal); refined as it is used on real WooCommerce tasks.
