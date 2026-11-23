# WooCommerce Core Patterns

Official docs: https://developer.woocommerce.com/docs/ · Code reference: https://woocommerce.github.io/code-reference/

## 1. Where code lives: site plugin skeleton

One small plugin per client site (or per feature if it may be reused). Never `functions.php` for business logic.

```php
<?php
/**
 * Plugin Name: Client Site Customizations
 * Description: Custom WooCommerce behaviour for <client>.
 * Version:     1.0.0
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 * Text Domain: prefix
 */

defined( 'ABSPATH' ) || exit;

define( 'PREFIX_VERSION', '1.0.0' );
define( 'PREFIX_PATH', plugin_dir_path( __FILE__ ) );
define( 'PREFIX_URL', plugin_dir_url( __FILE__ ) );

// Declare HPOS + Blocks checkout compatibility.
add_action( 'before_woocommerce_init', function () {
	if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
		\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
	}
} );

// Boot only when WooCommerce is active.
add_action( 'plugins_loaded', function () {
	if ( ! class_exists( 'WooCommerce' ) ) {
		return;
	}
	require_once PREFIX_PATH . 'includes/class-prefix-plugin.php';
	Prefix_Plugin::init();
} );
```

Suggested layout: `includes/` (classes by concern: cart, checkout, orders, admin, api), `assets/js|css/`, `templates/` (only if overriding output).

## 2. CRUD (HPOS-safe)

```php
// Orders
$order = wc_get_order( $order_id );
if ( ! $order instanceof WC_Order ) {
	return;
}
$order->update_meta_data( '_prefix_ref', sanitize_text_field( $ref ) );
$order->add_order_note( __( 'Synced to ERP.', 'prefix' ) );
$order->save(); // Always save after setters / meta changes.

$value = $order->get_meta( '_prefix_ref' );

// Query orders: never WP_Query / get_posts for orders.
$ids = wc_get_orders( array(
	'status'       => array( 'wc-processing' ),
	'date_created' => '>' . strtotime( '-7 days' ),
	'meta_key'     => '_prefix_synced', // phpcs:ignore WordPress.DB.SlowDBQuery
	'meta_compare' => 'NOT EXISTS',
	'limit'        => 50,
	'return'       => 'ids',
) );

// Products
$product = wc_get_product( $product_id );
if ( $product && $product->is_type( 'variable' ) ) {
	foreach ( $product->get_children() as $variation_id ) {
		$variation = wc_get_product( $variation_id );
	}
}
$product->set_stock_quantity( 10 );
$product->save();

// Customers
$customer = new WC_Customer( get_current_user_id() );
$customer->update_meta_data( '_prefix_tier', 'gold' );
$customer->save();
```

HPOS checks for admin code:

```php
use Automattic\WooCommerce\Utilities\OrderUtil;

$hpos = OrderUtil::custom_orders_table_usage_is_enabled();

// Order list columns differ by storage:
add_filter( $hpos ? 'manage_woocommerce_page_wc-orders_columns' : 'manage_edit-shop_order_columns', 'prefix_add_column' );
add_action( $hpos ? 'manage_woocommerce_page_wc-orders_custom_column' : 'manage_shop_order_posts_custom_column', 'prefix_render_column', 10, 2 );
// HPOS passes ( $column, $order ); legacy passes ( $column, $post_id ). Normalise with wc_get_order().
```

## 3. Key hooks by area

| Area | Hook | Use for |
|---|---|---|
| Product | `woocommerce_get_price_html` (filter) | Change price display only |
| Product | `woocommerce_before_add_to_cart_button` (action) | Add fields on product page |
| Cart | `woocommerce_add_to_cart_validation` (filter) | Block/validate add to cart |
| Cart | `woocommerce_add_cart_item_data` (filter) | Attach custom data to a cart item |
| Cart | `woocommerce_get_item_data` (filter) | Show that data in cart/checkout |
| Cart | `woocommerce_before_calculate_totals` (action) | Change item prices in cart (`$item['data']->set_price()`) |
| Cart | `woocommerce_cart_calculate_fees` (action) | Add fees/surcharges (`$cart->add_fee()`) |
| Checkout (classic) | `woocommerce_checkout_fields` (filter) | Add/edit fields |
| Checkout (classic) | `woocommerce_after_checkout_validation` (action) | Validate (`$errors->add()`) |
| Checkout (both) | `woocommerce_checkout_create_order_line_item` (action) | Copy cart item data to order item meta |
| Checkout (classic) | `woocommerce_checkout_create_order` (action) | Set order meta before first save |
| Checkout (Blocks) | `woocommerce_store_api_checkout_update_order_from_request` (action) | Read Store API request data into the order |
| Order | `woocommerce_order_status_changed` (action) | React to any status change (`$order_id, $from, $to, $order`) |
| Order | `woocommerce_payment_complete` (action) | Run after successful payment |
| Email | `woocommerce_email_after_order_table` (action) | Add content to order emails |
| My Account | `woocommerce_account_menu_items` (filter) + `add_rewrite_endpoint()` | New account tab (flush permalinks once) |

Status names in hooks have **no** `wc-` prefix (`woocommerce_order_status_processing`); in `wc_get_orders` either form works.

## 4. Pattern: custom cart item data → order item meta

```php
// 1. Save posted field into the cart item.
add_filter( 'woocommerce_add_cart_item_data', function ( $cart_item_data, $product_id ) {
	if ( isset( $_POST['prefix_engraving'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- WC verifies add-to-cart.
		$text = sanitize_text_field( wp_unslash( $_POST['prefix_engraving'] ) );
		if ( '' !== $text ) {
			$cart_item_data['prefix_engraving'] = mb_substr( $text, 0, 30 );
			$cart_item_data['prefix_key']       = md5( $text ); // Keeps different texts as separate lines.
		}
	}
	return $cart_item_data;
}, 10, 2 );

// 2. Show it in cart and checkout.
add_filter( 'woocommerce_get_item_data', function ( $item_data, $cart_item ) {
	if ( ! empty( $cart_item['prefix_engraving'] ) ) {
		$item_data[] = array(
			'key'   => __( 'Engraving', 'prefix' ),
			'value' => esc_html( $cart_item['prefix_engraving'] ),
		);
	}
	return $item_data;
}, 10, 2 );

// 3. Persist to the order line item (works for classic and Blocks checkout).
add_action( 'woocommerce_checkout_create_order_line_item', function ( $item, $cart_item_key, $values ) {
	if ( ! empty( $values['prefix_engraving'] ) ) {
		$item->add_meta_data( __( 'Engraving', 'prefix' ), $values['prefix_engraving'], true );
	}
}, 10, 3 );
```

## 5. Blocks checkout vs classic

- Detect: `WC_Blocks_Utils::has_block_in_page( wc_get_page_id( 'checkout' ), 'woocommerce/checkout' )`.
- **Extra checkout fields on Blocks** (WC 8.9+): Additional Checkout Fields API.

```php
add_action( 'woocommerce_init', function () {
	if ( ! function_exists( 'woocommerce_register_additional_checkout_field' ) ) {
		return;
	}
	woocommerce_register_additional_checkout_field( array(
		'id'       => 'prefix/po-number',
		'label'    => __( 'PO number', 'prefix' ),
		'location' => 'order',   // 'contact' | 'address' | 'order'
		'type'     => 'text',    // 'text' | 'select' | 'checkbox'
		'required' => false,
	) );
} );
```

  The value is saved on the order automatically and shown in admin and emails. Verify the stored meta key on staging before reading it in custom code.
- Server-side data for Blocks UI: extend the Store API (`woocommerce_store_api_register_endpoint_data`), see `rest-webhooks.md`.
- Never rely only on classic checkout hooks if the site uses Blocks; test both if both exist.

## 6. Templates

- Prefer hooks. Override only when markup must change: copy `plugins/woocommerce/templates/<path>` to `yourtheme/woocommerce/<path>` (or a plugin via the `woocommerce_locate_template` filter).
- After WC updates, check **WooCommerce → Status → Templates** for outdated overrides.

## 7. Performance

- Always set `limit` and `'return' => 'ids'` when you only need IDs.
- Cache expensive lookups: `get_transient()` / `set_transient()` with a clear invalidation hook (e.g. on `woocommerce_update_product`).
- Move slow work (API calls, emails to third parties, bulk updates) to Action Scheduler: `as_enqueue_async_action( 'prefix_sync_order', array( 'order_id' => $id ), 'prefix' )`.
- Don't call `WC()->cart` in admin or REST contexts where it isn't loaded; check `WC()->cart` first.
- Avoid heavy logic on `init`/`wp` for every request; hook as late and as narrowly as possible.

## 8. Logging

```php
$logger = wc_get_logger();
$logger->error( 'ERP sync failed', array( 'source' => 'prefix', 'order_id' => $order_id, 'code' => $code ) );
```

View under **WooCommerce → Status → Logs**. Never log API keys, full card data, or full customer addresses.
