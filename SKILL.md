---
name: woocommerce-feature-workflow
description: WLIQ workflow for building, debugging and reviewing WooCommerce features end to end (PHP, hooks, REST API, webhooks, AJAX, frontend) with security checks, tests and time logging.
---

# WooCommerce Feature Workflow (WLIQ)

A step-by-step workflow for delivering WooCommerce work at WLIQ. This skill covers the
**process**: requirement breakdown, build, security, review, tests, handoff and time log.
For code patterns, load the matching reference file from the `wordpress-expert` skill
instead of repeating them here:

| Need | Load from `wordpress-expert` |
|---|---|
| CRUD, hooks, gateways, shipping, HPOS, REST, Blocks checkout | `references/woocommerce.md` |
| Subscriptions | `references/wc-subscriptions.md` |
| Nonces, sanitizing, escaping, capability checks, OWASP | `references/security.md` |
| PHP/JS naming, docblocks, i18n | `references/coding-standards.md` |
| AJAX, `wp_localize_script`, `wp.apiFetch`, jQuery | `references/javascript-jquery.md` |
| WP_DEBUG, Query Monitor, performance | `references/performance-debug-devops.md` |

For any frontend output (markup, CSS, responsive, a11y), also follow `wliq-dev-baseline`
(`wl-` class prefix, no unexplained `!important`, §17 pre-QA self-check).

## Ground rules

- Work on **staging only**. Never paste production credentials, API keys, or customer/order PII into AI tools. Use placeholders (`{API_KEY}`, `customer@example.com`).
- AI writes the first draft. The developer reviews, tests and owns the final code.
- Use WooCommerce CRUD (`wc_get_order`, `wc_get_products`, `$order->update_meta_data`). Never query `wp_posts`/`wp_postmeta` for orders (breaks HPOS).
- Custom code goes in a site plugin or child theme, not core/plugin files and not a growing `functions.php`.
- Prefix everything: functions, hooks, options, meta keys, CSS classes, JS globals.

## Mode detection

| User says | Mode |
|---|---|
| Pastes a task, client request, or Orbit ticket | 1 → Breakdown |
| "build", "write the code", "implement" | 2 → Build |
| Error, "not working", white screen, wrong totals | 3 → Debug |
| "review", "check my code", "before PR/QA" | 4 → Review |
| "test cases", "QA steps" | 5 → Tests |
| "log time", "done", "handoff" | 6 → Handoff + time log |

Default for a new task: run 1 → 2 → 4 → 5 → 6 in order, pausing after 1 for approval.

---

## 1. Requirement breakdown

Output this, short, before writing code. Wait for the developer's OK.

```
Task: <one line>
Site / environment: <staging URL, WC version, theme, checkout type: classic or Blocks>
What the client wants: <plain words>
Approach: <2–5 bullets: which hooks/endpoints/files, where code lives>
Touches: [ ] Cart [ ] Checkout [ ] Orders [ ] Products [ ] Emails [ ] REST/Webhook [ ] Admin [ ] Frontend JS
Risks / unknowns: <HPOS, Blocks vs classic checkout, caching, third-party plugins, payment flow>
Questions for PM/client: <only if blocking>
Estimate: <Orbit quoted hrs> → AI-assisted target: <hrs>
```

Check before choosing hooks: is checkout **Blocks or classic**? Classic hooks such as
`woocommerce_checkout_fields` do not fire on Block checkout (use Store API / Additional
Checkout Fields API instead).

## 2. Build

- Give the file path for each code block and the full code (no "…rest unchanged").
- Every function: docblock, typed params where safe, early returns, `defined( 'ABSPATH' ) || exit;` at file top.
- **AJAX**: `check_ajax_referer()`, capability check if privileged, sanitize input, `wp_send_json_success/error`. Register both `wp_ajax_` and `wp_ajax_nopriv_` only when guests need it.
- **REST endpoints**: always set `permission_callback` (never `__return_true` for write routes), `args` with `sanitize_callback`/`validate_callback`, return `WP_REST_Response` / `WP_Error`.
- **Webhooks (incoming)**: verify the signature (`hash_equals` on the HMAC), respond 200 fast, move heavy work to Action Scheduler (`as_enqueue_async_action`), make handlers idempotent (store processed event IDs).
- **Outgoing API calls**: `wp_remote_post/get` with timeout, check `is_wp_error()` and response code, log failures with `wc_get_logger()` (source = plugin slug), store secrets in `wp-config.php` constants or options, never hard-code them.
- **JS**: enqueue only on the pages that need it, pass `ajaxurl` + nonce through `wp_localize_script`, handle errors and loading state in the UI, re-bind on `updated_checkout` / `updated_cart_totals` when touching cart or checkout DOM.

## 3. Debug checklist

Work through it in order. Report what was checked and what was found.

1. Reproduce on staging; note the exact steps, user role, product type, and browser.
2. Turn on `WP_DEBUG` + `WP_DEBUG_LOG` (`WP_DEBUG_DISPLAY` false); read `wp-content/debug.log` and **WooCommerce → Status → Logs**.
3. Browser console + Network tab: failed AJAX/REST calls, 400/403 (nonce), 500 (PHP fatal).
4. Conflict test: Health Check troubleshooting mode, or switch to Storefront and disable plugins one by one.
5. Script conflicts: `SCRIPT_DEBUG` true, `CONCATENATE_SCRIPTS` false (WP Engine: `DISABLE_CONCATENATE_SCRIPTS`). Remove afterwards.
6. Caching: exclude cart/checkout/my-account; purge page cache + object cache; check if the cart fragment request is blocked.
7. Context traps: `get_the_ID()` is unreliable in AJAX/shortcode/builder contexts, so use `$product->get_id()`. Output buffers and `render_block` filters need `is_admin()` / `wp_doing_ajax()` guards.
8. Data checks: HPOS on or off (**WooCommerce → Settings → Advanced → Features**); programmatic products need `product_visibility` terms (`wp_set_object_terms`).
9. Write up: root cause, the fix, and how to verify.

## 4. Code review (before PR / QA)

Return a table: **Item | Pass/Fail | File:line | Fix**.

Security
- [ ] Nonce verified on every form/AJAX/admin action
- [ ] Capability checked (`current_user_can`) for privileged actions
- [ ] All input sanitized (`sanitize_text_field`, `absint`, `wc_clean`), all output escaped (`esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`)
- [ ] SQL uses `$wpdb->prepare()`; no raw user input in queries
- [ ] REST `permission_callback` set; webhook signature verified
- [ ] No secrets, keys or PII in code, logs, or JS

WooCommerce
- [ ] CRUD used; HPOS-safe; compatibility declared if it's a plugin
- [ ] Works with the site's checkout type (Blocks / classic)
- [ ] Prices via `wc_price()`/`wc_get_price_to_display()`, respects tax display settings
- [ ] Translatable strings with the right text domain

Quality
- [ ] Prefixed names, no globals leaking, no dead/commented-out code
- [ ] No PHP notices/warnings in `debug.log`; no console errors
- [ ] Assets load only where needed; no N+1 queries in loops
- [ ] Frontend parts pass the `wliq-dev-baseline` §17 self-check

## 5. Test cases

Output as a table: **#, Scenario, Steps, Expected result, Pass/Fail**. Always include:

- Happy path as guest **and** logged-in customer
- Simple **and** variable product (and subscription if relevant)
- Coupon, tax and shipping changes affect totals correctly
- Invalid/empty input and expired nonce (reload after 24 h or tamper the nonce)
- Mobile viewport + one non-Chrome browser
- Admin view of the order (meta, notes, emails sent)
- For API/webhook: success, API down/timeout, duplicate event, bad signature

## 6. Handoff + time log

1. Short summary for the Orbit comment: what changed, files touched, how to test, staging URL.
2. Add a row to the developer's AI time log:

| Date | Orbit task | Task type | Quoted hrs | Actual AI-assisted hrs | Saved % | AI helped with | Notes / issues |
|---|---|---|---|---|---|---|---|

Task types: Custom feature · REST/API integration · Bug fix · Tests & docs.
Saved % = (Quoted − Actual) ÷ Quoted.

3. If the AI got something wrong or missed a step, note it so this skill can be improved.

---

## Prompt starters

- **Breakdown:** "Use woocommerce-feature-workflow. Here is the task: <paste>. Site runs WC <ver>, <classic/Blocks> checkout. Give me the breakdown only."
- **Build:** "Approach approved. Build it as a site plugin `<slug>`, prefix `<prefix>_`. Full files with paths."
- **Debug:** "Debug mode. Symptom: <…>. Steps: <…>. debug.log says: <paste, secrets removed>."
- **Review:** "Review mode. Check this code against the review checklist: <paste>."
- **Tests:** "Write test cases for: <feature summary>."
- **Log:** "Handoff mode. Orbit task <id>, quoted <x> hrs, actual <y> hrs."
