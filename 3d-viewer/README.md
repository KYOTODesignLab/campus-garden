# COPC Point Cloud Viewer

Local web viewer for large COPC `.laz` / `.las` point clouds using Giro3D and Three.js.

## Run locally

```bash
npm install
npm run dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`.

## Add data

The viewer always reads `public/data/manifest.json`, which lists any number of
named, user-selectable datasets:

```json
{
  "datasets": [
    { "id": "2023-05", "label": "May 2023",  "url": "2023-05.copc.laz" },
    { "id": "2024-06", "label": "June 2024", "url": "2024-06.copc.laz" },
    { "id": "2025-01", "label": "Jan 2025",  "url": "https://example.com/2025-01.copc.laz" }
  ]
}
```

- `datasets` can contain as many entries as you like; they show up in the
  left/right dropdowns, which drive both view modes (see below). `id` must be
  unique, `label` is the text shown in the dropdown.
- Each `url` can be a filename relative to `public/data/` (for local files
  placed there) or a full `https://` URL (for files hosted elsewhere, e.g. a
  Cloudflare R2 bucket, as in this deployment).
- Older manifests are still accepted automatically:
  - `before` / `after` fields (no `datasets` array) become a two-entry list.
  - A `ground` field (from an older version of this viewer, which had a fixed
    third pane for a Difference/M3C2 view) is folded into `datasets` as a
    regular, selectable entry — there's no more special fixed pane; ground/M3C2
    data is just another dataset you pick from the dropdowns like any other.

A dataset is only downloaded once it's actually picked in a dropdown —
nothing is fetched up front just because it's listed in the manifest. The
**Superimpose** view (see below) reuses whatever is currently selected in the
left/right dropdowns, but loads it into its own scene, so switching into it
the first time (or after changing a selection) triggers a fresh load.

## Hosting COPC data on Cloudflare R2 (or any external host)

Because the viewer streams point-cloud tiles with HTTP range requests, the
bucket/CDN serving the `.copc.laz` files **must** send correct CORS headers
for the GitHub Pages origin, including range-request support:

```
Access-Control-Allow-Origin: https://<your-username>.github.io
Access-Control-Allow-Methods: GET, HEAD
Access-Control-Allow-Headers: Range
Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges
```

If CORS or `Accept-Ranges`/`Content-Range` exposure is missing, the browser
console will show failed/opaque requests and the viewer will appear stuck on
"Loading …" without a clear error.

## UI

- Switch between **Split View** (side-by-side, draggable divider) and **Superimpose** (both selected datasets overlaid in one shared 3D scene, correct depth occlusion between them) with the buttons top-left.
- Pick a dataset in each of the two dropdowns above the viewer (used by both modes). Leaving one empty in Split View shows the other full-screen and hides the divider; leaving both empty shows a hint instead of a cloud. Drag the divider to adjust the split when both are set.
- Color attributes: **RGB**, **Solid Color** (flat color per side — left/right colors configurable in Options, default red/blue; handy for telling the two overlaid clouds apart in Superimpose), and **M3C2 Distance** (if the selected data has an M3C2 scalar field). More attributes are available in the full "Color by attribute" dropdown in Options.
- Options are hidden by default. Use the **Options** button to open advanced controls (attribute coloring, EDL, point size/budget, filters, clipping planes, stats).
- Click on the point cloud to re-center the orbit target on the clicked point.
- Hold `W`/`A`/`S`/`D` or the arrow keys to fly through the scene; move the mouse while holding a key to steer.
