# Store photos

Real photographs of the shop go here. These are separate from the logo
files in `public/brand/`.

## How it works

Drop a correctly named file into this folder and it appears on the site
automatically. No code change is needed. Until a file exists, its spot on
the site shows a labeled placeholder frame, never a broken image.

## Naming: shop-01.jpg through shop-44.jpg

Name all 44 photos in a single numbered series, zero-padded so they sort
in order:

```
shop-01.jpg  shop-02.jpg  shop-03.jpg  ...  shop-44.jpg
```

- Format: **.jpg**. Landscape where possible, at least **1600px** on the
  long edge. Bright, in focus, no heavy filter.
- Names must match **exactly**: all lowercase, a hyphen, two digits.

## Order matters (which photo goes where)

The site uses the first several photos in specific spots, so put your best
shots first:

| File | Should show | Where it appears |
| --- | --- | --- |
| `shop-01.jpg` | Best **exterior / storefront** shot | About page |
| `shop-02.jpg` .. `shop-09.jpg` | Your **8 strongest interior** shots (the floor, the cases, the walls, ammo, optics, the counter) | Home page, "Inside the Shop" gallery |
| `shop-10.jpg` .. `shop-44.jpg` | Everything else | Stored here, ready to feature later |

You do not need all 44 for the site to look complete: photos 01 through 09
fill the visible spots. The rest are kept on hand so we can swap or add to
the gallery anytime without renaming anything.

## Want different photos featured?

The featured list lives in `src/content/siteFacts.js` (`PHOTOS.storefront`
and `SHOP_GALLERY`). Change the numbers there to feature different shots,
or ask and I will adjust it.
