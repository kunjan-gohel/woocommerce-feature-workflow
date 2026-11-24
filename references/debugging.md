# Debugging WooCommerce

Work in order. Don't change code until the cause is evidenced.

## 1. Step-by-step

1. **Reproduce on staging.** Write down the exact steps, user role (guest/customer/admin), product type, payment method, browser and device.
2. **Turn on logging** in `wp-config.php`:
   ```php
   define( 'WP_DEBUG', true );
   define( 'WP_DEBUG_LOG', true );      // wp-content/debug.log
   define( 'WP_DEBUG_DISPLAY', false ); // Never show errors to visitors.
   ```
   Then read `wp-content/debug.log` and **WooCommerce → Status → Logs** (look for `fatal-errors` and the plugin's source).
3. **Browser DevTools:** Console for JS errors; Network tab for failing `admin-ajax.php`, `/wp-json/`, `?wc-ajax=` or `/wc/store/` requests. 400/403 usually means nonce or permission; 500 means a PHP fatal (check the log).
4. **Query Monitor plugin:** PHP errors, slow/duplicate queries, which hooks ran, HTTP API calls and their responses.
5. **Conflict test:** Health Check & Troubleshooting plugin (troubleshooting mode affects only your session): Storefront theme + WooCommerce only, then re-enable plugins one at a time.
6. **Script conflicts:** `define( 'SCRIPT_DEBUG', true ); define( 'CONCATENATE_SCRIPTS', false );`. Some hosts (e.g. WP Engine) concatenate scripts, which hides the real source. Remove these after debugging.
7. **Caching:** cart, checkout and my-account must be excluded from page cache. Purge page cache, object cache (Redis/Memcached) and CDN. Test in a private window.
8. **Background jobs:** **Tools → Scheduled Actions** for pending/failed Action Scheduler jobs (webhooks, emails, syncs). Failed actions show the exception message.
9. **Environment:** **WooCommerce → Status**: WC/WP/PHP versions, outdated template overrides, HPOS state, missing pages, memory limit.
10. **Write up:** root cause, the fix, how to verify, and whether production needs the same fix.

## 2. Common symptoms → likely causes

| Symptom | Check first |
|---|---|
| Checkout spins forever / "error processing order" | PHP fatal in log during `?wc-ajax=checkout`; payment gateway response; a plugin echoing output (breaks JSON) |
| Custom checkout field not saving | Site uses **Blocks checkout** but code uses classic hooks |
| Additional checkout field not showing on Blocks checkout | Plugin not active (check Plugins list or REST `wp/v2/plugins`), WC older than 8.9, or the checkout page lacks the Additional information block |
| Plugin File Editor change "reverted" | WordPress loopback request failed (common on staging behind auth or a firewall). Deliver changes as a new plugin zip and upload/replace instead |
| Cart empties / random logouts | Cart pages cached; session cookie stripped by CDN; mixed http/https |
| Wrong prices or totals | Multiple `woocommerce_before_calculate_totals` callbacks (runs more than once; guard with `did_action()`), tax display settings, rounding |
| Order meta missing in admin | Code uses `get_post_meta()` / `update_post_meta()` while **HPOS is on** |
| Order list column empty | Hooked only the legacy `manage_shop_order_posts_custom_column`, not the HPOS hook |
| Emails not sending | Email enabled in settings? SMTP plugin log; Action Scheduler failures; spam folder |
| AJAX 400 `0` / `-1` response | Action name mismatch, missing `nopriv` hook, or nonce failed (`-1`) |
| Admin AJAX / editor broken after a frontend change | Output buffering or `render_block` filters running in admin; guard with `is_admin()` / `wp_doing_ajax()` |
| `get_the_ID()` returns wrong product | AJAX, shortcode or page-builder context; use `$product->get_id()` |
| Programmatic products don't appear in shop | Missing `product_visibility` terms (set via CRUD `set_catalog_visibility()` + `save()`) |
| Webhook "stopped" | WooCommerce disabled it after repeated delivery failures; check status and receiver logs |
| Scheduled actions pile up | WP-Cron not running (low traffic or `DISABLE_WP_CRON` without a server cron) |
| Form JS library object exists but is empty | Another script defines the global before the library loads; check script order |
| Plugin in "maintenance mode" on staging only | Stored DB version option differs from the installed plugin version after a migration |

## 3. WP-CLI quick commands

```bash
wp plugin list --status=active
wp option get woocommerce_custom_orders_table_enabled     # HPOS: yes/no
wp wc tool run clear_transients --user=1                  # Clear WC transients
wp transient delete --all
wp action-scheduler run --group=prefix                    # Run pending actions for a group
wp cron event list
wp wc shop_order get 123 --user=1                         # Inspect an order via WC REST
wp eval 'var_dump( wc_get_order( 123 )->get_meta( "_prefix_ref" ) );'
wp cache flush
```

## 4. Integration debugging

- Log request path, HTTP code and the vendor's error code (not secrets or full payloads) at the boundary.
- Reproduce the call with `curl` from the server to rule out WordPress (firewalls, CDNs and bot protection may block server-to-server requests that a browser can make).
- Check the vendor's dashboard/logs for the same timestamp.
- Confirm timezone handling (site timezone vs UTC) and number formats (avoid scientific notation when casting large numbers to strings).

## 5. After the fix

- Remove debug constants and temporary logging.
- Add a regression test case to the test table.
- Note the root cause in the ticket so the team learns from it.
