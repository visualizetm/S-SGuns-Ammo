# Store photos

Real photographs of the shop go here. These are separate from the logo
files in `public/brand/`.

## How it works

Drop a correctly named file into this folder and it appears on the site
automatically. No code change is needed. Until a file exists, its spot on
the site shows a labeled placeholder frame, never a broken image.

## File rules

- Format: **.jpg** (photographs compress best as JPEG).
- Orientation: **landscape** for the gallery, one portrait for the storefront.
- Size: at least **1600px on the long edge**. Bright, in focus, no heavy filter.
- Names must match **exactly** (all lowercase, hyphens, no spaces).

## Filenames the site looks for

| File name | What it should show | Where it appears |
| --- | --- | --- |
| `storefront.jpg` | The front of the shop / sign (portrait works well) | About page |
| `sales-floor.jpg` | Wide shot of the inside / sales floor | Home, "Inside the Shop" |
| `handgun-case.jpg` | The glass display case of handguns | Home, "Inside the Shop" |
| `long-gun-wall.jpg` | The wall of rifles and shotguns | Home, "Inside the Shop" |
| `ammo-shelves.jpg` | Ammunition on the shelves | Home, "Inside the Shop" |
| `optics-accessories.jpg` | Optics, sights, and accessories | Home, "Inside the Shop" |
| `counter.jpg` | The service counter | Home, "Inside the Shop" |

You do not need all of them. Add the photos you have; any name not present
just stays a labeled placeholder until you add it.

## Want a different set of photos?

The gallery list lives in `src/content/siteFacts.js` under `SHOP_GALLERY`
(and `PHOTOS.storefront`). Edit the captions or add/remove rows there to
change what the gallery shows.
