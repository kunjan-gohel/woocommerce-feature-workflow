# AJAX, JavaScript & Frontend

## 1. Enqueue only where needed

```php
add_action( 'wp_enqueue_scripts', function () {
	if ( ! is_product() && ! is_cart() && ! is_checkout() ) {
		return;
	}
	wp_enqueue_script(
		'prefix-frontend',
		PREFIX_URL . 'assets/js/frontend.js',
		array( 'jquery' ),
		PREFIX_VERSION,
		array( 'in_footer' => true, 'strategy' => 'defer' )
	);
	wp_localize_script( 'prefix-frontend', 'prefixData', array(
		'ajaxUrl' => admin_url( 'admin-ajax.php' ),
		'nonce'   => wp_create_nonce( 'prefix_check_stock' ),
		'i18n'    => array( 'error' => __( 'Something went wrong. Please try again.', 'prefix' ) ),
	) );
	wp_enqueue_style( 'prefix-frontend', PREFIX_URL . 'assets/css/frontend.css', array(), PREFIX_VERSION );
} );
```

Use the file version (or `filemtime()` on staging) so caches bust on deploy.

## 2. AJAX handler (PHP)

```php
add_action( 'wp_ajax_prefix_check_stock', 'prefix_ajax_check_stock' );
add_action( 'wp_ajax_nopriv_prefix_check_stock', 'prefix_ajax_check_stock' ); // Only if guests need it.

function prefix_ajax_check_stock() {
	check_ajax_referer( 'prefix_check_stock', 'nonce' );

	$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
	$product    = $product_id ? wc_get_product( $product_id ) : null;

	if ( ! $product ) {
		wp_send_json_error( array( 'message' => __( 'Product not found.', 'prefix' ) ), 404 );
	}

	wp_send_json_success( array(
		'inStock' => $product->is_in_stock(),
		'qty'     => $product->get_stock_quantity(),
	) );
}
```

- Privileged actions: add `current_user_can()` after the nonce check.
- For new features, a REST endpoint (`rest-webhooks.md`) is often cleaner than admin-ajax; use `wp.apiFetch` or `fetch` with the `X-WP-Nonce` header (`wp_create_nonce( 'wp_rest' )`).
- Page caching: nonces in cached HTML expire (12–24 h). For guest-facing cached pages, fetch a fresh nonce via AJAX or exclude the page.

## 3. AJAX call (JS)

```js
( function () {
	const btn = document.querySelector( '.wl-stock-check' );
	const out = document.querySelector( '.wl-stock-result' ); // has aria-live="polite"
	if ( ! btn || ! out ) return;

	btn.addEventListener( 'click', async () => {
		btn.disabled = true;
		btn.setAttribute( 'aria-busy', 'true' );
		const body = new FormData();
		body.append( 'action', 'prefix_check_stock' );
		body.append( 'nonce', prefixData.nonce );
		body.append( 'product_id', btn.dataset.productId );

		try {
			const res  = await fetch( prefixData.ajaxUrl, { method: 'POST', body, credentials: 'same-origin' } );
			const json = await res.json();
			if ( ! json.success ) throw new Error( json.data?.message || prefixData.i18n.error );
			out.textContent = json.data.inStock ? `In stock (${ json.data.qty ?? '' })` : 'Out of stock';
		} catch ( e ) {
			out.textContent = e.message || prefixData.i18n.error;
		} finally {
			btn.disabled = false;
			btn.removeAttribute( 'aria-busy' );
		}
	} );
} )();
```

Always handle: loading state, error message, double-click, and screen-reader announcement.

## 4. Classic cart/checkout JS events

WooCommerce re-renders parts of cart and checkout with AJAX, so bind with delegation or re-bind on these jQuery events:

| Event (on `document.body`) | When |
|---|---|
| `updated_checkout` | Checkout order review refreshed |
| `update_checkout` (trigger it) | Force checkout totals refresh after your field changes |
| `updated_cart_totals` | Cart page totals refreshed |
| `added_to_cart` / `removed_from_cart` | AJAX add/remove |
| `wc_fragments_refreshed` | Mini-cart fragments updated |

```js
jQuery( function ( $ ) {
	$( document.body ).on( 'change', '#prefix_delivery_type', function () {
		$( document.body ).trigger( 'update_checkout' );
	} );
} );
```

Mini-cart / header count: add your own HTML fragment with the `woocommerce_add_to_cart_fragments` filter.

## 5. Blocks cart/checkout JS

- Blocks are React; jQuery events above do **not** fire there.
- Read cart data: `wp.data.select( 'wc/store/cart' ).getCartData()`.
- Send data from JS to PHP and refresh totals:

```js
const { extensionCartUpdate } = window.wc.blocksCheckout;
extensionCartUpdate( { namespace: 'prefix', data: { deliveryType: 'express' } } );
```

```php
add_action( 'woocommerce_blocks_loaded', function () {
	woocommerce_store_api_register_update_callback( array(
		'namespace' => 'prefix',
		'callback'  => function ( $data ) {
			WC()->session->set( 'prefix_delivery_type', sanitize_key( $data['deliveryType'] ?? '' ) );
		},
	) );
} );
// Then apply it in woocommerce_cart_calculate_fees.
```

- New visible checkout fields on Blocks: use the Additional Checkout Fields API (`woocommerce-core.md`).

## 6. Frontend standards (WLIQ)

- Custom CSS classes use the **`wl-` prefix** (`.wl-stock-check`). No generic names (`.box1`, `.new`, `.temp`).
- No inline styles. No `!important` unless overriding plugin/builder inline styles, with a comment saying why.
- Remove dead/commented-out CSS and JS before handoff.
- Mobile-first; test at phone, tablet and desktop widths with no horizontal scroll.
- `target="_blank"` links get `rel="noopener noreferrer"`.
- Images: `alt` text, `width`/`height`, `loading="lazy"` except above-the-fold images.

**Accessibility (WCAG 2.1 AA):**

- Every input has a visible `<label>`; errors are announced (`aria-live` or `role="alert"`) and linked with `aria-describedby`.
- Everything works by keyboard; visible focus outline (never `outline: none` without a replacement).
- Text contrast at least 4.5:1; don't use color alone to show state.
- Buttons are `<button>`, links are `<a href>`.

## 7. Frontend pre-QA checklist

- [ ] No console errors or 404s for assets
- [ ] Works after AJAX refresh (checkout update, cart update, mini-cart)
- [ ] Works on classic and/or Blocks checkout as used by the site
- [ ] Loading, success, error and empty states all handled
- [ ] Keyboard and screen-reader friendly; labels and focus visible
- [ ] Responsive at phone/tablet/desktop; tested in one non-Chrome browser
- [ ] Assets load only on the pages that need them
- [ ] `wl-` class prefix, no inline styles, no unexplained `!important`
