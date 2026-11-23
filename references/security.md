# Security

Docs: https://developer.wordpress.org/apis/security/ · https://developer.woocommerce.com/docs/

Rule of thumb: **sanitize on input, validate the meaning, escape on output, verify intent (nonce), check permission (capability/ownership).**

## 1. Sanitize input

| Input | Function |
|---|---|
| Plain text | `sanitize_text_field( wp_unslash( $_POST['x'] ) )` |
| Multi-line text | `sanitize_textarea_field()` |
| Integer / ID | `absint()` or `(int)` |
| Decimal / price | `wc_format_decimal()` |
| Email | `sanitize_email()` + `is_email()` |
| URL | `esc_url_raw()` |
| Key / slug | `sanitize_key()` / `sanitize_title()` |
| Allowed list | `in_array( $v, $allowed, true )` |
| WooCommerce mixed data | `wc_clean()` (recursive on arrays) |
| Trusted HTML | `wp_kses_post()` / `wp_kses( $html, $allowed )` |

Always `wp_unslash()` superglobals before sanitizing.

## 2. Escape output

| Context | Function |
|---|---|
| HTML text | `esc_html()` / `esc_html__()` |
| HTML attribute | `esc_attr()` |
| URL in `href`/`src` | `esc_url()` |
| Inline JS value | `wp_json_encode()` (or pass via `wp_localize_script`) |
| Textarea | `esc_textarea()` |
| Price | `wc_price()` (already escaped markup) |
| Field value that contains intended HTML | `wp_kses_post()` (`esc_html` would print the tags as text) |

Escape late: at the moment of output, not when saving.

## 3. Nonces (intent)

```php
// Form
wp_nonce_field( 'prefix_save_settings', 'prefix_nonce' );
// Handler
if ( ! isset( $_POST['prefix_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['prefix_nonce'] ), 'prefix_save_settings' ) ) {
	wp_die( esc_html__( 'Security check failed.', 'prefix' ), 403 );
}
// AJAX
check_ajax_referer( 'prefix_action', 'nonce' );
// REST from logged-in JS: send header X-WP-Nonce: wp_create_nonce( 'wp_rest' )
```

A nonce proves intent, **not** permission. Always pair it with a capability or ownership check.

## 4. Capabilities and ownership (IDOR)

```php
if ( ! current_user_can( 'manage_woocommerce' ) ) { // Shop managers + admins.
	wp_send_json_error( null, 403 );
}

// A customer may only touch their own order.
$order = wc_get_order( $order_id );
if ( ! $order || (int) $order->get_customer_id() !== get_current_user_id() ) {
	wp_send_json_error( null, 403 );
}
// Guest order links: verify the order key instead.
if ( ! hash_equals( $order->get_order_key(), wc_clean( wp_unslash( $_GET['key'] ?? '' ) ) ) ) { /* deny */ }
```

Never trust IDs, prices, totals, or roles sent from the browser. Recalculate server-side.

## 5. Database

```php
global $wpdb;
$rows = $wpdb->get_results( $wpdb->prepare(
	"SELECT id, status FROM {$wpdb->prefix}prefix_jobs WHERE status = %s AND created < %s LIMIT %d",
	$status, $date, 50
) );
```

- Always `$wpdb->prepare()` with placeholders (`%s`, `%d`, `%f`, `%i` for identifiers on WP 6.2+).
- Use `$wpdb->esc_like()` before adding `%` wildcards for LIKE.
- Prefer CRUD functions over raw SQL for orders/products.

## 6. Other risks

- **Redirects:** `wp_safe_redirect()` + `exit;` never redirect to a raw user-supplied URL.
- **File uploads:** `wp_handle_upload()` with an allowed `mimes` list; check `wp_check_filetype_and_ext()`; never trust the extension alone; don't store in web-executable paths.
- **Unserialize:** never `unserialize()` user data; use JSON.
- **Remote requests:** don't fetch arbitrary user-supplied URLs (SSRF); use `wp_safe_remote_get()` if needed.
- **Rate limiting:** for public endpoints (coupon checks, stock checks, forms), throttle per IP/session with a transient counter.
- **Secrets:** constants in `wp-config.php` or host env vars. Never in Git, JS, HTML, logs, order notes or error messages.
- **PII:** log order IDs, not names/addresses/emails. Respect WooCommerce's personal data exporter/eraser if storing new customer data (`wp_privacy_personal_data_exporters`).
- **Payment data:** never store card numbers or CVV. Use the gateway's tokenization.
- **Errors:** generic messages to users, details only in logs.

## 7. Security review checklist

- [ ] Every form, AJAX and admin action verifies a nonce
- [ ] Every privileged action checks `current_user_can()`; every user-data action checks ownership or order key
- [ ] All input sanitized with the right function; all output escaped for its context
- [ ] All SQL uses `$wpdb->prepare()`; no raw superglobals in queries
- [ ] REST routes have a real `permission_callback`; webhooks verify signatures with `hash_equals()`
- [ ] Prices/totals/roles are never taken from the client
- [ ] No secrets, keys or PII in code, JS, logs or order notes
- [ ] Redirects use `wp_safe_redirect()`; uploads restricted by MIME type
- [ ] Errors shown to users don't leak paths, SQL or stack traces
