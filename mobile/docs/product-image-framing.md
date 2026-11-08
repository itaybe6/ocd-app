# Home product image framing

HomeShoppingFeed fits the visible product into its square photo area using `productImageFrames.json`. Original Shopify files and URLs are unchanged. The metadata records a conservative nonwhite-content rectangle, padded by 3% of the source dimensions. Photos with content along the border retain their original framing. Rendering keeps the source aspect ratio, leaves 2% padding and limits enlargement to 1.8x.

Metadata keys include the full source URL and version. New or replaced images safely use `contain` until metadata is refreshed. This avoids applying an obsolete crop to a different package photograph.

To refresh after catalog image updates, run `node scripts/refresh-product-framing.cjs` from `mobile` on Windows with PowerShell 7 and existing Shopify storefront configuration. This reads the catalog and small CDN thumbnails, then measures their pixels using `measure-product-framing.ps1`. No Shopify writes occur. Thumbnails stay under `node_modules/.cache/product-framing`; only the generated geometry JSON is included in the app.

Verify with `node --test scripts/test-product-image-framing.cjs scripts/test-home-shopping-feed.cjs` and inspect the home screen on a device, particularly light-colored packages and product sets.
