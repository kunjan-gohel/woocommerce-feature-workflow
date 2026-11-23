# Storefront Design: Shop, Product, Cart, Checkout, My Account

Use this file for any frontend design or layout change on WooCommerce pages.

## 1. First: find out how the page is rendered

The right technique depends on this. Check **before** proposing a design approach and state the result in the Breakdown.

| Check | How | Why it matters |
|---|---|---|
| Theme type | Appearance → Themes; a block theme shows **Appearance → Editor** (Site Editor) | Block themes use templates + blocks; classic themes use PHP templates + hooks |
| Page builder | Elementor/Divi active? **Templates → Theme Builder** has Single Product / Products Archive templates? | Builder templates replace theme templates; change the builder template, not PHP |
| Cart / Checkout type | Edit the Cart/Checkout page: a Cart/Checkout **block**, a `[woocommerce_cart]` / `[woocommerce_checkout]` shortcode, or an Elementor Cart/Checkout widget | Blocks are React (CSS + block settings + JS filters); shortcode and Elementor widgets use classic PHP hooks |
| Template overrides | **WooCommerce → Status → Templates** (bottom of System Status) | Shows which templates the theme overrides and whether they are outdated |
| Child theme | Is a child theme active? | Overrides and CSS go in the child theme or site plugin, never the parent theme |

Then choose, in this order of preference:

1. **Settings / editor options** (WooCommerce settings, Customizer, Site Editor, block settings, Elementor widget controls)
2. **Hooks and filters** (move, remove or add output without copying templates)
3. **CSS** scoped to the page
4. **Builder template** (Elementor Theme Builder / Site Editor template) for layout changes
5. **Template override** only when markup must change and hooks can't do it

## 1b. Match the existing site design

WooCommerce pages must look like the rest of the site. Do this before styling anything. If the client supplied a separate Figma/design, that design wins and the site style only fills gaps.

**Step 1: extract the site's design tokens** from 2–3 existing non-store pages (home, about, contact), at desktop and mobile:

| Token | What to capture |
|---|---|
| Colors | primary, secondary, accent, text, headings, links (normal/hover), background, borders |
| Typography | font families; H1–H4 and body size, weight, line height, letter spacing, text transform |
| Buttons | background, text color, radius, padding, border, hover/focus states, font weight/case |
| Forms | input height, padding, border, radius, focus style, label style, error color |
| Layout | container max-width, side padding, section spacing, grid gap |
| Components | card style (shadow, radius, border), badges, dividers, icons |

Quick extraction in the browser console on an existing page. Run it at a **desktop width (1280px or wider)** and again at **mobile (375px)**, because sizes and container widths change per breakpoint. Sample a normal content section, not only the hero (heroes often use white text on images):

```js
( () => {
	const visible = ( el ) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && ! el.closest( '#wpadminbar' ); };
	const first = ( sel, test = () => true ) => [ ...document.querySelectorAll( sel ) ].find( ( el ) => visible( el ) && test( getComputedStyle( el ) ) );
	const read = ( el, props ) => el ? Object.fromEntries( props.map( ( p ) => [ p, getComputedStyle( el ).getPropertyValue( p ).trim() ] ) ) : null;
	const solid = ( cs ) => ! /rgba\(0, 0, 0, 0\)|transparent/.test( cs.backgroundColor );
	const type = [ 'font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'color' ];
	// Site tokens only: Elementor globals, block-theme presets, layout sizes. Skips Elementor admin (--e-a-*) and WP admin vars.
	const keep = /^--(e-global-|wp--preset--(color|font-family|font-size|spacing)--|wp--style--global--|container-max-width|content-width)/;
	const anyCon = document.querySelector( '.e-con' );
	return {
		h1: read( first( 'h1' ), type ),
		h2: read( first( 'h2' ), type ),
		h3: read( first( 'h3' ), type ),
		body: read( document.body, type.concat( 'background-color' ) ),
		paragraph: read( first( 'main p, .elementor-widget-text-editor p, p' ), type ),
		link: read( first( 'main p a, .elementor-widget-text-editor a, .entry-content a' ), [ 'color', 'text-decoration' ] ),
		buttonSolid: read( first( '.elementor-button, .wp-element-button, .button, button[type="submit"]', solid ), type.concat( 'background-color', 'border-radius', 'padding', 'border' ) ),
		input: read( first( 'input[type="text"], input[type="email"], input[type="tel"], textarea', ( cs ) => parseFloat( cs.height ) >= 30 ), [ 'height', 'padding', 'border', 'border-radius', 'font-size', 'background-color' ] ),
		container: read( first( '.e-con-boxed > .e-con-inner, .elementor-section-boxed > .elementor-container, .is-layout-constrained > *, .container', ( cs ) => cs.maxWidth !== 'none' && cs.maxWidth !== '100%' ), [ 'max-width', 'padding-left', 'padding-right' ] ),
		elementorContentWidth: anyCon ? getComputedStyle( anyCon ).getPropertyValue( '--content-width' ).trim() : null,
		measuredContentWidth: ( () => { const el = first( '.e-con-boxed > .e-con-inner, .elementor-section-boxed > .elementor-container, .is-layout-constrained > *, .container, main' ); return el ? Math.round( el.getBoundingClientRect().width ) + 'px of ' + innerWidth + 'px viewport' : null; } )(),
		globals: [ ...document.styleSheets ].flatMap( ( ss ) => { try { return [ ...ss.cssRules ]; } catch ( e ) { return []; } } )
			.filter( ( r ) => r.style && ( r.selectorText === ':root' || r.selectorText === 'body' || ( r.selectorText || '' ).includes( '.elementor-kit-' ) ) )
			.flatMap( ( r ) => [ ...r.style ].filter( ( n ) => keep.test( n ) ).map( ( n ) => n + ': ' + r.style.getPropertyValue( n ).trim() ) )
			.filter( ( v, i, a ) => a.indexOf( v ) === i ),
	};
} )();
```

**Step 2: find where each token is defined** and reuse that source instead of copying raw values:

| Site built with | Source of truth | Use in CSS |
|---|---|---|
| Elementor | Site Settings → Global Colors / Global Fonts / Buttons / Form Fields / Layout | `var(--e-global-color-primary)`, `var(--e-global-typography-primary-font-family)`, etc. (names from the kit CSS) |
| Block theme | `theme.json` / Global Styles | `var(--wp--preset--color--<slug>)`, `var(--wp--preset--font-family--<slug>)`, `var(--wp--preset--spacing--<slug>)` |
| Classic theme | Customizer / theme options / theme CSS variables | the theme's own variables or Customizer settings; raw values only if none exist |

Set as much as possible **globally** (Elementor Site Settings buttons/forms, Global Styles element styles) so WooCommerce buttons, inputs and headings inherit automatically. Write CSS only for what the global settings can't reach.

**Step 3: write a token table** in the Breakdown, for example:

```
Primary color   #C8102E   → var(--e-global-color-primary)
Heading font    Oswald 700 uppercase → var(--e-global-typography-primary-font-family)
Body            Roboto 16px / 1.6
Button          radius 4px, padding 14px 28px, hover = secondary color
Input           48px high, 1px #D0D0D0, radius 4px, focus = primary
Container       1200px, 20px side padding; sections 80px (desktop) / 48px (mobile)
```

**Step 4: map WooCommerce elements to the tokens.** Typical mapping:

| WooCommerce element | Match to site's |
|---|---|
| Product titles, page titles, section headings | H1–H3 styles |
| Prices | body/heading font, primary or text color; sale `ins` in primary/accent, `del` muted |
| Add to cart, Proceed to checkout, Place order, block buttons | primary button style incl. hover/focus |
| Secondary actions (View cart, Apply coupon) | secondary/outline button style |
| Quantity, coupon, checkout and account inputs, selects | site form field style |
| Product cards, cart/checkout panels, account boxes | site card style and spacing |
| Notices | site colors for success/info/error with enough contrast |
| Shop/product/cart/checkout containers | site container width and section spacing |

**Step 5: compare side by side.** Screenshot an existing site page and the WooCommerce page at desktop and mobile; headings, buttons, inputs, spacing and colors must look like the same site. Fix differences, then run the QA checklist.

## 1c. Known gotchas (found in real tests)

Check these before calling a storefront design done. Each one came up on a real Elementor + Hello theme build.

| Gotcha | Symptom | Fix |
|---|---|---|
| Elementor lazy-load | Computed `background-image` reads `none` on buttons/sections below the fold | Read the real values from the kit CSS (`post-{kitId}.css`, rules starting `.elementor-kit-{id}`) instead of computed styles |
| Overlay (absolute/transparent) header | Header covers the breadcrumb/title; white top-bar text is invisible on light WooCommerce pages | Add a dark band (breadcrumb / products header / `.page-header`) with `padding-top` = header height per breakpoint, styled like the site's page hero |
| Full-bleed band with `100vw` | Horizontal scrollbar, text not aligned to the container | Keep the element in the container and paint outside it with `border-image: linear-gradient(c, c) fill 0 / 0 / 0 100vmax;` (one paint layer, no seam, no overflow) |
| Hello theme `.alignwide` | Block cart/checkout pushed off-screen (`margin: 0 -80px`) | `.site-main .alignwide { margin-inline: 0; max-width: 100%; }` |
| Hello theme `.page-header .entry-title` | Page title indented vs content (max-width 1140px + side margins) | `max-width: none; margin: 0;` |
| Hello `reset.css` | Pink links (`#c36`), striped/gray tables, italic attribute values | Set link color, clear table backgrounds, `font-style: normal` on `.shop_attributes td` |
| WooCommerce specificity | Loop prices stay olive; active tab keeps a white box | Target `ul.products li.product .price` and `.woocommerce-tabs ul.tabs li.active` explicitly |
| Blocks field specificity | Checkout fields stay rounded | Use `.wc-block-components-text-input input:is([type="text"], [type="email"], …)` |
| Kit input styles leak into blocks | Double border inside the Blocks quantity selector | Remove border on `.wc-block-components-quantity-selector__input` |
| Classic add-to-cart row | Quantity box and button different heights / misaligned | `form.cart { display: flex; align-items: stretch; gap: 16px; }`, remove floats |
| AJAX "View cart" | Heavy boxed link under the button on product cards | Style as the site's text/arrow link |
| Result count + sorting | Text and dropdown on different baselines | Same vertical padding/line-height on both |
| Product reviews form | Gray default Submit (`#respond input#submit`), boxed textarea, browser checkbox | Style `#respond input#submit` as the primary button; fields as site fields; `accent-color` on checkboxes; Name/Email in two columns on desktop |
| Global focus outline | Site's thick black `:focus-visible` box on selects/fields looks broken on underline-style fields | Replace with a visible brand focus (e.g. primary underline `box-shadow: 0 1px 0 0 primary`), never remove focus without a replacement |
| Two stacked band elements | Thin light line between breadcrumb band and title band (anti-aliasing seam) | Paint with `border-image: linear-gradient(c, c) fill 0 / 0 / 0 100vmax` and overlap the second element by 2px (`margin-top: -2px; padding-top: 2px`) |
| Site-wide input styles on radios/checkboxes | Kit rule `input:not([type=button])` gives Blocks radios/checkboxes padding + bottom border: payment options and "Add a note" show as short underlines, no circle/box | Reset `.wc-block-components-radio-control__input` and `.wc-block-components-checkbox__input` (20px, padding 0, full border, radius 50% / 2px), checked color = primary, selected payment box border = primary. Check every checkbox/radio in cart, checkout, account, reviews |
| "Added to cart" notice | Orange/blue ring around the whole notice (WooCommerce focuses it with `tabindex=-1`), default gray "View cart" button | `outline: none` on the notice's `:focus` only (not interactive; screen readers still get it); style the notice `.button` as the site's outline button; flex the notice so the button sits right |
| Variation "Clear" link | The row with the Clear link is taller, so its label sits lower than the select | `td.value { position: relative }` and `.reset_variations { position: absolute; bottom: 0 }`; check label vs select centers match |

**How to test (fast and repeatable):** load each WooCommerce page in hidden iframes at 1920, 1440 and 375px and measure with JS: horizontal overflow, header bottom vs first content top, title left edge vs content left edge, button/field heights, colors against the token table. Then take screenshots for the visual check.

## 2. Styling rules

- Scope every rule to the page's body class so nothing leaks:

| Page | Body class |
|---|---|
| Shop | `.woocommerce-shop` |
| Category / tag archive | `.tax-product_cat` / `.tax-product_tag` |
| Product detail | `.single-product` |
| Cart | `.woocommerce-cart` |
| Checkout | `.woocommerce-checkout` |
| Thank-you page | `.woocommerce-order-received` |
| My Account | `.woocommerce-account` |

- Custom classes use the `wl-` prefix. No inline styles; no `!important` unless overriding plugin/builder inline styles (comment why).
- Enqueue design CSS only on WooCommerce pages:

```php
add_action( 'wp_enqueue_scripts', function () {
	if ( is_woocommerce() || is_cart() || is_checkout() || is_account_page() ) {
		wp_enqueue_style( 'prefix-store', PREFIX_URL . 'assets/css/store.css', array(), PREFIX_VERSION );
	}
}, 20 ); // After WooCommerce's own styles.
```

- Classic WooCommerce styles can be partly or fully disabled when the design needs a clean base:

```php
add_filter( 'woocommerce_enqueue_styles', function ( $styles ) {
	unset( $styles['woocommerce-layout'] ); // Keep 'woocommerce-general' and 'woocommerce-smallscreen' unless rebuilding everything.
	return $styles;
} );
```

- **Block cart/checkout class names** (`.wc-block-components-*`) can change between WooCommerce versions. Prefer block settings, Global Styles and `theme.json` first; keep custom CSS for blocks small and re-check after updates.
- Mobile-first. Test at phone, tablet and desktop. Keep tap targets at least 44px and stop layout shift (set image sizes, don't inject content above the fold after load).

## 3. Shop and category pages

**Settings first:** WooCommerce → Settings → Products (shop page, add-to-cart behaviour); Customizer → WooCommerce → Product Catalog (what the shop shows, default sorting, columns and rows in some themes); Customizer → WooCommerce → Product Images (thumbnail crop).

**Classic loop hooks (default priorities):**

| Hook | Default output |
|---|---|
| `woocommerce_before_shop_loop` | result count (20), sorting dropdown (30) |
| `woocommerce_before_shop_loop_item_title` | sale badge (10), thumbnail (10) |
| `woocommerce_shop_loop_item_title` | product title (10) |
| `woocommerce_after_shop_loop_item_title` | rating (5), price (10) |
| `woocommerce_after_shop_loop_item` | close link (5), add-to-cart button (10) |

```php
// Columns and products per page (classic themes).
add_filter( 'loop_shop_columns', fn() => 3 );
add_filter( 'loop_shop_per_page', fn() => 12 );

// Move the price above the title on product cards.
remove_action( 'woocommerce_after_shop_loop_item_title', 'woocommerce_template_loop_price', 10 );
add_action( 'woocommerce_shop_loop_item_title', 'woocommerce_template_loop_price', 5 );

// Custom sale badge (percent off).
add_filter( 'woocommerce_sale_flash', function ( $html, $post, $product ) {
	if ( $product->is_type( 'simple' ) && $product->get_regular_price() ) {
		$pct  = round( 100 - ( (float) $product->get_sale_price() / (float) $product->get_regular_price() * 100 ) );
		$html = '<span class="onsale wl-sale-badge">' . esc_html( sprintf( __( '-%d%%', 'prefix' ), $pct ) ) . '</span>';
	}
	return $html;
}, 10, 3 );

// Button text on product cards.
add_filter( 'woocommerce_product_add_to_cart_text', fn( $text, $product ) => $product->is_type( 'simple' ) ? __( 'Add to bag', 'prefix' ) : $text, 10, 2 );
```

- **Out-of-stock card:** style `.product.outofstock`; optionally hide via WooCommerce → Settings → Products → Inventory → "Hide out of stock items".
- **Filters:** prefer WooCommerce's filter blocks (Product Filters) or the builder's filter widget over custom code; custom filters must keep URLs crawlable and work without JS where possible.
- **Block themes:** edit the **Product Catalog** template in the Site Editor; layout and columns live on the **Product Collection** block settings, not `loop_shop_columns`.
- **Elementor Pro:** Theme Builder → **Products Archive** template with the Archive Products widget; set columns, rows, card styling and conditions there.

## 4. Product detail page

**Classic hooks (default priorities):**

| Hook | Default output |
|---|---|
| `woocommerce_before_single_product_summary` | sale badge (10), image gallery (20) |
| `woocommerce_single_product_summary` | title (5), rating (10), price (10), short description (20), add to cart (30), meta (40), sharing (50) |
| `woocommerce_after_single_product_summary` | tabs (10), upsells (15), related products (20) |

```php
// Move short description below the add-to-cart button.
remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_excerpt', 20 );
add_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_excerpt', 35 );

// Add a trust block under add-to-cart.
add_action( 'woocommerce_single_product_summary', function () {
	echo '<div class="wl-trust">' . esc_html__( 'Free shipping over $50 · 30-day returns', 'prefix' ) . '</div>';
}, 31 );

// Tabs: rename, reorder, remove, add.
add_filter( 'woocommerce_product_tabs', function ( $tabs ) {
	unset( $tabs['reviews'] );
	$tabs['description']['title'] = __( 'Details', 'prefix' );
	$tabs['wl_shipping'] = array(
		'title'    => __( 'Shipping', 'prefix' ),
		'priority' => 30,
		'callback' => fn() => print( wp_kses_post( wpautop( get_option( 'prefix_shipping_text', '' ) ) ) ),
	);
	return $tabs;
} );

// Related products count/columns.
add_filter( 'woocommerce_output_related_products_args', fn( $args ) => array_merge( $args, array( 'posts_per_page' => 4, 'columns' => 4 ) ) );

// Gallery features (classic themes; some themes add these already).
add_action( 'after_setup_theme', function () {
	add_theme_support( 'wc-product-gallery-zoom' );
	add_theme_support( 'wc-product-gallery-lightbox' );
	add_theme_support( 'wc-product-gallery-slider' );
} );
```

- **Variations:** default is dropdowns. For swatches use the site's existing swatch plugin or a well-maintained one; custom swatches must still update the hidden `<select>` so WooCommerce's variation JS (`found_variation`, `reset_data` events on `form.variations_form`) keeps working.
- **Sticky add-to-cart on mobile:** clone the button into a fixed bar with JS, keep one real form, and hide the bar when the main button is visible.
- **Block themes:** **Single Product** template in the Site Editor (Product Image Gallery, Product Price, Add to Cart with Options, Product Details blocks).
- **Elementor Pro:** Theme Builder → **Single Product** template with Product Title / Images / Price / Add to Cart / Data Tabs widgets. Hooks that target the summary may not appear if the template doesn't output those areas; check the template first.

## 5. Cart

**Blocks cart (this is the default on new installs):**

- Layout: edit the Cart page in the block editor. Inner blocks (cart items, totals, coupon form, cross-sells, express payments, proceed button) can be reordered, hidden or configured there.
- Empty cart state: edit the **Empty Cart** inner block in the editor (add a heading, button, product collection).
- Text and price display changes in JS with checkout filters:

```js
const { registerCheckoutFilters } = window.wc.blocksCheckout;
registerCheckoutFilters( 'prefix', {
	proceedToCheckoutButtonLabel: () => 'Go to secure checkout',
	itemName: ( name, extensions, args ) => name, // e.g. append a badge for certain products
} );
```

- Extra content in totals: Slot/Fill (`ExperimentalOrderMeta`) via `registerPlugin`, or server data via the Store API (`rest-webhooks.md`).

**Classic cart (shortcode or Elementor Cart widget):**

- Hooks: `woocommerce_before_cart`, `woocommerce_before_cart_table`, `woocommerce_after_cart_table`, `woocommerce_cart_collaterals` (cross-sells, totals), `woocommerce_proceed_to_checkout`.
- Template: `cart/cart.php` (override only if the table markup must change).
- Bind JS to `updated_cart_totals` because the cart re-renders after updates.

## 6. Checkout

**Blocks checkout:**

- Layout and steps: edit the Checkout page in the block editor. Contact, shipping, billing, shipping method, payment, order notes, terms and the order summary are inner blocks you can configure, reorder or hide.
- New fields: Additional Checkout Fields API (`woocommerce-core.md`). Never use `woocommerce_checkout_fields` here.
- Labels/text: `registerCheckoutFilters` (e.g. `placeOrderButtonLabel`).
- Order summary extras: Slot/Fill (`ExperimentalOrderMeta`, `ExperimentalDiscountsMeta`).
- Trust badges/notes: a Paragraph/Image block inside the checkout in the editor, or Slot/Fill.
- Switch to classic only if a required plugin is incompatible with Blocks; say so in the Breakdown and get approval.

**Classic checkout (shortcode or Elementor Checkout widget):**

- Hooks: `woocommerce_before_checkout_form`, `woocommerce_checkout_before_customer_details`, `woocommerce_checkout_after_customer_details`, `woocommerce_checkout_before_order_review`, `woocommerce_review_order_before_payment`, `woocommerce_review_order_before_submit`, `woocommerce_after_checkout_form`.
- Fields: `woocommerce_checkout_fields` (labels, placeholders, `class` for widths like `form-row-first` / `form-row-last` / `form-row-wide`, `priority` for order, `required`).

```php
add_filter( 'woocommerce_checkout_fields', function ( $fields ) {
	unset( $fields['billing']['billing_company'] );
	$fields['billing']['billing_phone']['priority'] = 25;
	$fields['billing']['billing_email']['class']    = array( 'form-row-wide' );
	return $fields;
} );
```

- Bind JS to `updated_checkout`.

**Thank-you page:** `woocommerce_thankyou` (action, receives `$order_id`) and template `checkout/thankyou.php`; on block themes edit the **Order Confirmation** template.

## 7. My Account

- Menu items: `woocommerce_account_menu_items` (rename, reorder, remove, add).
- New tab: `add_rewrite_endpoint( 'wl-documents', EP_ROOT | EP_PAGES )` on `init`, add it to the menu, render with `woocommerce_account_wl-documents_endpoint`, and **flush permalinks once** (Settings → Permalinks → Save).
- Dashboard content: `woocommerce_account_dashboard`.
- Templates: `myaccount/navigation.php`, `myaccount/dashboard.php`, `myaccount/form-login.php`, `myaccount/orders.php`.
- Login/register layout: WooCommerce → Settings → Accounts & Privacy controls whether registration shows on My Account.
- Elementor Pro: My Account widget styles tabs and content areas.

## 8. Shared elements

- **Mini-cart / header cart:** classic sites update counts with `woocommerce_add_to_cart_fragments`; block themes use the Mini-Cart block; Elementor uses the Menu Cart widget.
- **Notices:** classic `.woocommerce-message`, `.woocommerce-info`, `.woocommerce-error`; blocks `.wc-block-components-notice-banner`. Keep them visible near the action and announced to screen readers.
- **Breadcrumbs:** `woocommerce_breadcrumb_defaults` (separator, wrapper markup), or the theme/builder breadcrumb widget.
- **Buttons:** style `.button`, `.single_add_to_cart_button`, `.checkout-button` and block buttons `.wc-block-components-button` consistently with the site's button styles (Global Styles / Elementor Site Settings first).
- **Prices:** never hard-code currency symbols; use `wc_price()` / settings. Style `del` (regular) and `ins` (sale) inside `.price`.

## 9. Template overrides (last resort)

1. Copy `wp-content/plugins/woocommerce/templates/<path>` to `child-theme/woocommerce/<path>`.
2. Keep the `@version` header from the source file; change only what is needed.
3. Note every override in the ticket.
4. After each WooCommerce update, check **WooCommerce → Status → Templates** for "outdated" and merge changes.

Block templates (Site Editor) and builder templates are not PHP overrides; they are stored in the database and should be exported/noted when moving between staging and live.

## 10. From a design (Figma or screenshot)

1. List each section of the design per page (e.g. product page: gallery, title, price, rating, variations, quantity + button, trust row, tabs, related).
2. Map each section to how it is rendered (setting, hook, block, builder widget, template).
3. Mark gaps: anything the platform can't do without a plugin or custom code, with an estimate.
4. Build in the preference order from section 1, then run the QA checklist below.

## 11. Storefront design QA checklist

Shop / category
- [ ] Card layout, image ratio and spacing match the design at phone, tablet, desktop
- [ ] Sale badge, out-of-stock state, variable ("Select options") and external product buttons look right
- [ ] Sorting, pagination, filters and "no products found" state work and are styled

Product detail
- [ ] Gallery zoom/lightbox/slider, thumbnails and single-image products
- [ ] Variable product: no selection, invalid combination, selected variation price/stock/image update; labels level with selects when "Clear" shows
- [ ] Add to cart: success notice (no focus ring box, styled "View cart" button) and error notice
- [ ] Out of stock, backorder, sale price, quantity limits
- [ ] Tabs, related/upsell products, reviews list and the review form (logged out: name/email fields, submit, validation)

Cart
- [ ] Empty cart state, quantity change, remove item, coupon success and error, cross-sells
- [ ] Shipping calculator/estimates and totals update correctly

Checkout
- [ ] Guest and logged-in, saved address, ship to different address
- [ ] Validation errors visible and announced; field order and widths match the design
- [ ] Payment method selection (radios look like radios, selected box in brand color), terms/notes checkboxes, place-order loading state
- [ ] Thank-you page layout and order details

My Account
- [ ] Login/register, dashboard, orders list and single order, addresses, account details, any custom tab
- [ ] Logged-out access redirects correctly

Everywhere
- [ ] Header and top bar readable (overlay headers need a dark band behind them); nothing hidden under the header
- [ ] Page titles, breadcrumbs and content share the same left edge at every breakpoint
- [ ] Pagination, attributes table, AJAX "View cart" link and quantity + button row are styled
- [ ] Matches the existing site design: headings, buttons, inputs, colors, spacing and container width look like the site's other pages (side-by-side screenshots, desktop and mobile)
- [ ] Uses the site's global tokens/variables, not hard-coded copies, wherever a global exists
- [ ] No console errors; no layout shift; images sized
- [ ] Keyboard navigation and visible focus (brand-styled, not the browser/theme default box); contrast at least 4.5:1
- [ ] CSS scoped to WooCommerce pages; nothing changed on non-store pages
- [ ] Tested in Chrome and one other browser
