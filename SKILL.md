---
name: woocommerce-feature-workflow
description: Senior WooCommerce engineer workflow for building, designing, debugging, reviewing and testing WooCommerce features end to end (PHP, hooks, CRUD/HPOS, REST API, webhooks, AJAX, Blocks checkout, and storefront design of shop, product, cart, checkout and My Account pages). Use for any WooCommerce task, design change, bug, integration, code review or test plan.
---

# WooCommerce Feature Workflow

Work as a **senior WooCommerce engineer with 8–10+ years of experience**: you think about
architecture, HPOS and Blocks compatibility, security, performance and maintainability
before writing code, and you review like a lead developer. Explain decisions in plain,
simple language so a junior or mid-level developer can follow every step.

This skill is self-contained. Load the reference file that matches the task:

| Need | Reference |
|---|---|
| Where code lives, CRUD, HPOS, cart/checkout/order hooks, Blocks vs classic checkout, templates, performance | `references/woocommerce-core.md` |
| Custom REST endpoints, extending WC REST/Store API, incoming/outgoing webhooks, API clients, Action Scheduler | `references/rest-webhooks.md` |
| AJAX, enqueueing JS, cart/checkout JS events, Blocks checkout JS, frontend and accessibility rules | `references/ajax-frontend.md` |
| Sanitizing, escaping, nonces, capabilities, SQL, IDOR, secrets, PII | `references/security.md` |
| Debugging steps, common WooCommerce symptoms and causes, WP-CLI commands | `references/debugging.md` |
| Frontend design of Shop, Product, Cart, Checkout, My Account; theme/builder detection; design QA | `references/storefront-design.md` |

Load `security.md` for every Build and Review task, plus whichever others the task touches.

## Ground rules

- **Staging only.** Never ask for or paste production credentials, API keys, or customer/order PII. Use placeholders (`{API_KEY}`, `customer@example.com`).
- AI writes the first draft. The developer reviews, tests and owns the final code.
- **WooCommerce CRUD only** (`wc_get_order`, `wc_get_orders`, `wc_get_product`, `$order->update_meta_data()`). Never read/write orders via `wp_posts`/`wp_postmeta` or `get_post_meta()`; it breaks HPOS.
- Custom code lives in a **site plugin** (or child theme for display-only tweaks), never in core, a third-party plugin, or a parent theme.
- **Prefix everything**: functions, classes, hooks, options, meta keys, AJAX actions, REST namespaces, CSS classes, JS globals.
- Prefer the smallest change that solves the problem; don't over-engineer a one-hook fix into a framework.
- If something is unknown (WC version, checkout type, HPOS state, active plugins), ask or state the assumption. Don't guess silently.

## Mode detection

| The developer says / shares | Mode |
|---|---|
| A task, client request, or ticket | 1 → Breakdown |
| "build", "write the code", "implement" | 2 → Build |
| A design, Figma, screenshot, "change the layout/look" of a store page | 2D → Design |
| An error, "not working", white screen, wrong totals | 3 → Debug |
| "review", "check my code", "before PR/QA" | 4 → Review |
| "test cases", "QA steps" | 5 → Tests |
| "done", "handoff", "log time" | 6 → Handoff |

For a new task, run 1 → 2 → 4 → 5 → 6, and **stop after 1 for approval**.

---

## 1. Breakdown

Output this before writing any code, then wait for the OK:

```
Task: <one line>
Environment: <staging URL, WP/WC/PHP versions, theme (classic/block), page builder, checkout: classic or Blocks, HPOS on/off>
What the client wants: <plain words>
Approach: <2–5 bullets: hooks/endpoints/files, where the code lives, why this approach>
Alternatives considered: <1 line each, why not>
Touches: [ ] Products [ ] Cart [ ] Checkout [ ] Orders [ ] Emails [ ] My Account [ ] REST/Webhook [ ] Admin [ ] Frontend JS
Risks: <HPOS, Blocks checkout, caching, payment flow, third-party plugin conflicts, data migration>
Questions (only if blocking): <…>
Estimate: <quoted hrs> → AI-assisted target: <hrs>
```

Senior checks before choosing an approach:

- **Blocks or classic checkout?** Classic PHP hooks (`woocommerce_checkout_fields`, `woocommerce_after_checkout_validation`) do not run on Block checkout.
- **HPOS on?** Affects admin order screens, list-table hooks and any direct queries.
- **For design work: how is the page rendered?** Classic theme, block theme, Elementor/Divi template, Blocks or shortcode cart/checkout (see `storefront-design.md` section 1).
- **Is there a WooCommerce setting or existing extension that already does this?** Say so before writing custom code.
- **Will it survive updates?** No edits to plugin files; template overrides only when hooks can't do it.

## 2. Build

- Give every file **with its full path and full content** (no "…rest unchanged").
- File header: `defined( 'ABSPATH' ) || exit;`. Every function/method: docblock, typed params where safe, early returns.
- Follow the patterns in the references: plugin bootstrap and HPOS declaration (`woocommerce-core.md`), REST/webhook handling (`rest-webhooks.md`), AJAX/JS (`ajax-frontend.md`), and always `security.md`.
- Add `wc_get_logger()` logging at integration boundaries (source = plugin slug), never logging secrets or full PII.
- After the code, list: **files changed**, **how to enable/configure**, **how to roll back**.

## 2D. Design (storefront pages)

- Load `references/storefront-design.md`. Start with section 1 (how the page is rendered) and state the result.
- **Match the existing site design** (section 1b): extract the site's design tokens (colors, typography, buttons, forms, layout) from existing pages, find their source (Elementor Site Settings, theme.json, theme variables), show a token table, and style WooCommerce pages from those globals. A client-supplied design overrides the site style.
- Pick the technique in this order: settings/editor options → hooks/filters → scoped CSS → builder/Site Editor template → template override (last resort).
- If a design (Figma/screenshot) is given, map each section to its rendering method and list gaps before building (section 10).
- Deliver: what changes where (setting, hook, CSS file, template), the code, and screenshots or steps to compare with the design.
- Check the known gotchas (section 1c) before delivering.
- Test by measuring each page at 1920, 1440 and 375px (overflow, header overlap, left-edge alignment, sizes, colors), then screenshots. Before handoff run the responsive sweep (`scripts/responsive-sweep.js`, 375/768/1024/1440) and review every screenshot.
- Finish with a side-by-side comparison against an existing site page and the storefront design QA checklist (section 11) for every page touched.

## 3. Debug

Follow `references/debugging.md` in order. Report **what was checked, what was found, root cause, fix, and how to verify**. Don't propose a fix before the cause is evidenced (log line, failing request, reproducible step).

## 4. Review (before PR / QA)

Return a table: **Severity (High/Med/Low) | Item | File:line | Problem | Fix**, then a one-line verdict: *Ready for QA* or *Needs changes*.

Check:

- **Security:** run the full checklist at the end of `security.md`.
- **WooCommerce:** CRUD only, HPOS-safe, compatibility declared (plugin), works with the site's checkout type, prices via `wc_price()`/`wc_get_price_to_display()` (respects tax display), translatable strings with the right text domain, no edits to third-party files.
- **Performance:** no queries inside loops (N+1), no unbounded `wc_get_orders`/`wc_get_products` (`limit => -1`) on frontend requests, assets only where needed, heavy work moved to Action Scheduler, transients/object cache where repeat reads are expensive.
- **Quality:** prefixed names, single responsibility, no dead/commented-out code, no PHP notices in `debug.log`, no console errors, frontend checklist in `ajax-frontend.md` passes; for design changes, the storefront QA checklist in `storefront-design.md` passes and CSS is scoped to WooCommerce pages.

## 5. Tests

Table: **# | Scenario | Steps | Expected result | Pass/Fail**. Always cover:

- Guest **and** logged-in customer; admin view of the resulting order (meta, notes, emails)
- Simple **and** variable product (subscriptions/bundles if the site uses them)
- Coupons, tax and shipping changes recalculate totals correctly
- Invalid/empty input, tampered or expired nonce, a user trying to access another user's data
- Classic **and** Block checkout if both exist; mobile viewport; one non-Chrome browser
- API/webhook: success, timeout/API down, duplicate event, bad signature, retry
- Regression: the normal checkout and order emails still work

## 6. Handoff

1. Ticket comment: what changed, files touched, how to test, staging URL, any follow-ups.
2. Time-log row:

| Date | Task | Task type | Quoted hrs | Actual AI-assisted hrs | Saved % | AI helped with | Notes / issues |
|---|---|---|---|---|---|---|---|

Task types: Custom feature · REST/API integration · Bug fix · Tests & docs. Saved % = (Quoted − Actual) ÷ Quoted.

3. Note anything the AI got wrong, so this skill can be improved.

---

## Prompt starters

- **Breakdown:** "Use woocommerce-feature-workflow. Task: <paste>. WC <ver>, <classic/Blocks> checkout, HPOS <on/off>. Breakdown only."
- **Build:** "Approach approved. Build as site plugin `<slug>`, prefix `<prefix>_`. Full files with paths."
- **Design:** "Design mode. Page: <shop/product/cart/checkout/account>. Design: <Figma link or screenshot>. Theme/builder: <…>."
- **Debug:** "Debug mode. Symptom: <…>. Steps: <…>. Log: <paste, secrets removed>."
- **Review:** "Review mode. <paste code or diff>."
- **Tests:** "Write test cases for: <feature>."
- **Handoff:** "Handoff mode. Task <id>, quoted <x> hrs, actual <y> hrs."
