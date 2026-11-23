# REST API, Webhooks & Integrations

Docs: https://developer.wordpress.org/rest-api/extending-the-rest-api/ · https://developer.woocommerce.com/docs/apis/

## 1. Custom REST endpoint

```php
add_action( 'rest_api_init', function () {
	register_rest_route( 'prefix/v1', '/orders/(?P<id>\d+)/status', array(
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'prefix_rest_get_order_status',
		'permission_callback' => function ( WP_REST_Request $request ) {
			$order = wc_get_order( (int) $request['id'] );
			// Owner or shop manager only (prevents IDOR).
			return $order && (
				current_user_can( 'manage_woocommerce' ) ||
				(int) $order->get_customer_id() === get_current_user_id()
			);
		},
		'args'                => array(
			'id' => array(
				'required'          => true,
				'validate_callback' => fn( $v ) => is_numeric( $v ) && $v > 0,
				'sanitize_callback' => 'absint',
			),
		),
	) );
} );

function prefix_rest_get_order_status( WP_REST_Request $request ) {
	$order = wc_get_order( $request['id'] );
	if ( ! $order ) {
		return new WP_Error( 'prefix_not_found', __( 'Order not found.', 'prefix' ), array( 'status' => 404 ) );
	}
	return new WP_REST_Response( array(
		'id'     => $order->get_id(),
		'status' => $order->get_status(),
	), 200 );
}
```

Rules:

- `permission_callback` is mandatory. `__return_true` only for truly public read-only data, or for webhook receivers that verify a signature in the callback.
- Validate and sanitize every arg. Return `WP_Error` with a proper HTTP status.
- External systems authenticate with **Application Passwords** (WP users) or **WooCommerce REST API keys** (WooCommerce → Settings → Advanced → REST API), with the least permissions needed (Read vs Read/Write).

## 2. Extend the built-in WC REST / Store API

```php
// Add a field to WC REST order responses (/wp-json/wc/v3/orders).
add_filter( 'woocommerce_rest_prepare_shop_order_object', function ( $response, $order ) {
	$response->data['prefix_erp_id'] = $order->get_meta( '_prefix_erp_id' );
	return $response;
}, 10, 2 );
```

Store API (used by Blocks cart/checkout):

```php
use Automattic\WooCommerce\StoreApi\Schemas\V1\CartSchema;

add_action( 'woocommerce_blocks_loaded', function () {
	woocommerce_store_api_register_endpoint_data( array(
		'endpoint'        => CartSchema::IDENTIFIER,
		'namespace'       => 'prefix',
		'data_callback'   => fn() => array( 'free_shipping_left' => prefix_free_shipping_left() ),
		'schema_callback' => fn() => array(
			'free_shipping_left' => array( 'type' => 'number', 'context' => array( 'view', 'edit' ), 'readonly' => true ),
		),
		'schema_type'     => ARRAY_A,
	) );
} );
```

For JS-triggered cart updates on Blocks, see `woocommerce_store_api_register_update_callback` in `ajax-frontend.md`.

## 3. Incoming webhook receiver (from a third party)

Principles: **verify signature → de-duplicate → store → respond 200 fast → process async**.

```php
add_action( 'rest_api_init', function () {
	register_rest_route( 'prefix/v1', '/webhook/vendor', array(
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'prefix_handle_vendor_webhook',
		'permission_callback' => '__return_true', // Auth = signature check below.
	) );
} );

function prefix_handle_vendor_webhook( WP_REST_Request $request ) {
	$body      = $request->get_body(); // Raw body: sign/verify exactly what was sent.
	$signature = (string) $request->get_header( 'x-vendor-signature' );
	$expected  = base64_encode( hash_hmac( 'sha256', $body, PREFIX_VENDOR_WEBHOOK_SECRET, true ) );

	if ( ! hash_equals( $expected, $signature ) ) {
		return new WP_Error( 'prefix_bad_signature', 'Invalid signature', array( 'status' => 401 ) );
	}

	$payload  = json_decode( $body, true );
	$event_id = isset( $payload['id'] ) ? sanitize_key( $payload['id'] ) : '';
	if ( '' === $event_id ) {
		return new WP_Error( 'prefix_bad_payload', 'Missing id', array( 'status' => 400 ) );
	}

	// Idempotency: ignore events already received.
	$seen_key = 'prefix_wh_' . md5( $event_id );
	if ( get_transient( $seen_key ) ) {
		return new WP_REST_Response( array( 'status' => 'duplicate' ), 200 );
	}
	set_transient( $seen_key, 1, DAY_IN_SECONDS );

	// Store payload, pass only the key to the async job.
	set_transient( 'prefix_whp_' . md5( $event_id ), $payload, DAY_IN_SECONDS );
	as_enqueue_async_action( 'prefix_process_vendor_event', array( 'event_id' => $event_id ), 'prefix' );

	return new WP_REST_Response( array( 'status' => 'queued' ), 200 );
}

add_action( 'prefix_process_vendor_event', function ( $event_id ) {
	$payload = get_transient( 'prefix_whp_' . md5( $event_id ) );
	if ( ! $payload ) {
		return;
	}
	// … do the work. Throwing an exception marks the action failed (visible in Tools → Scheduled Actions).
} );
```

- Use the vendor's documented signature scheme (header name, hex vs base64, timestamp tolerance).
- For high-volume or long-lived idempotency, use a custom table with a unique index on `event_id` instead of transients.
- Endpoint URL: `https://<site>/wp-json/prefix/v1/webhook/vendor`. Exclude it from page caching and security-plugin REST blocking.

## 4. WooCommerce's own outgoing webhooks

- Configure in **WooCommerce → Settings → Advanced → Webhooks** (topics like `order.created`, `order.updated`).
- Payload signature: header `X-WC-Webhook-Signature` = base64 HMAC-SHA256 of the raw body using the webhook secret. The receiver must verify it.
- Deliveries run through Action Scheduler; failed deliveries are logged and the webhook is disabled after repeated failures. Check the webhook's status if a receiver "stops getting events".

## 5. Outgoing API client

```php
class Prefix_Api_Client {
	private string $base = 'https://api.vendor.example/v2';

	public function post( string $path, array $data ) {
		$response = wp_remote_post( $this->base . $path, array(
			'timeout' => 15,
			'headers' => array(
				'Authorization' => 'Bearer ' . PREFIX_VENDOR_API_KEY,
				'Content-Type'  => 'application/json',
				'Accept'        => 'application/json',
			),
			'body'    => wp_json_encode( $data ),
		) );

		if ( is_wp_error( $response ) ) {
			$this->log( 'HTTP error: ' . $response->get_error_message(), $path );
			return $response;
		}

		$code = wp_remote_retrieve_response_code( $response );
		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( $code < 200 || $code >= 300 ) {
			$this->log( "HTTP $code", $path );
			return new WP_Error( 'prefix_api_' . $code, 'API request failed', array( 'status' => $code ) );
		}
		return $body;
	}

	private function log( string $msg, string $path ): void {
		wc_get_logger()->error( $msg, array( 'source' => 'prefix-api', 'path' => $path ) );
	}
}
```

- **Secrets**: define in `wp-config.php` (`define( 'PREFIX_VENDOR_API_KEY', '…' );`) or the host's environment settings. Never in code, the database export, JS, or logs.
- **Retries**: on 429/5xx/timeout, re-queue with Action Scheduler and back off: `as_schedule_single_action( time() + 60 * pow( 2, $attempt ), 'prefix_sync_order', array( $order_id, $attempt + 1 ), 'prefix' )`, capped at ~5 attempts, then add an order note and log.
- **Order sync**: trigger on `woocommerce_order_status_processing` / `woocommerce_payment_complete`, enqueue an async action, save the remote ID in order meta, and skip if already synced (idempotent).

## 6. Testing endpoints

```bash
# Read (Application Password)
curl -u 'user:app-password' https://staging.example.com/wp-json/prefix/v1/orders/123/status

# Simulate a signed webhook
BODY='{"id":"evt_1","type":"order.paid"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)
curl -X POST -H "Content-Type: application/json" -H "X-Vendor-Signature: $SIG" \
  -d "$BODY" https://staging.example.com/wp-json/prefix/v1/webhook/vendor
```

Test: valid, bad signature (401), duplicate (200 duplicate), malformed body (400), vendor API down (retry queued).
