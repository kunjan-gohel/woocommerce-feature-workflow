// Responsive sweep for WooCommerce storefront pages.
// Usage: node responsive-sweep.js https://staging.example.com [simpleProductId]
// Needs Playwright (npm i playwright). Writes full-page PNGs + prints a JSON report:
// horizontal overflow per page/width and tap targets under 32px inside .site-main.
const { chromium } = require( 'playwright' );

const base = ( process.argv[ 2 ] || '' ).replace( /\/$/, '' );
const productId = process.argv[ 3 ] || '';
if ( ! base ) {
	console.error( 'Usage: node responsive-sweep.js <site-url> [simple-product-id]' );
	process.exit( 1 );
}

// Edit these paths to match the store (find real slugs in Products / Store API).
const pages = [
	[ 'shop', '/shop/' ],
	[ 'category', '/product-category/uncategorized/' ],
	[ 'product', '/product/sample-product/' ],
	[ 'myaccount', '/my-account/' ],
	[ 'cart-empty', '/cart/' ],
	[ 'cart', '/cart/' ], // filled with productId before loading
	[ 'checkout', '/checkout/' ],
];
const widths = [ 375, 768, 1024, 1440 ];

( async () => {
	const browser = await chromium.launch();
	const report = [];
	for ( const w of widths ) {
		const ctx = await browser.newContext( { viewport: { width: w, height: 900 } } );
		const page = await ctx.newPage();
		for ( const [ name, path ] of pages ) {
			if ( name === 'cart' && productId ) {
				await page.goto( `${ base }/?add-to-cart=${ productId }` );
			}
			await page.goto( base + path, { waitUntil: 'networkidle', timeout: 60000 } ).catch( () => {} );
			await page.waitForTimeout( 1500 ); // Blocks cart/checkout render after load.
			// Scroll once so lazy-loaded images/backgrounds render.
			await page.evaluate( async () => {
				for ( let y = 0; y < document.body.scrollHeight; y += 600 ) {
					scrollTo( 0, y );
					await new Promise( ( r ) => setTimeout( r, 80 ) );
				}
				scrollTo( 0, 0 );
			} );
			const result = await page.evaluate( ( vw ) => {
				const overflow = document.documentElement.scrollWidth > vw ? document.documentElement.scrollWidth : 0;
				const small = [ ...document.querySelectorAll( '.site-main a.button, .site-main button, .site-main select, .site-main input:not([type=hidden]):not([type=radio]):not([type=checkbox])' ) ]
					.filter( ( el ) => {
						const r = el.getBoundingClientRect();
						return r.width > 0 && r.height > 0 && r.height < 32 && getComputedStyle( el ).visibility !== 'hidden';
					} )
					.slice( 0, 6 )
					.map( ( el ) => `${ ( typeof el.className === 'string' && el.className.split( ' ' )[ 0 ] ) || el.tagName }:${ Math.round( el.getBoundingClientRect().height ) }px` );
				return { overflow, small };
			}, w );
			report.push( { width: w, page: name, ...result } );
			await page.screenshot( { path: `${ name }-${ w }.png`, fullPage: true } );
		}
		await ctx.close();
	}
	console.log( JSON.stringify( report, null, 2 ) );
	await browser.close();
} )();
