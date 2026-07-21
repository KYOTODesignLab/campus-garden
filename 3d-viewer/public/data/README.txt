Place COPC files here, or point to them by URL (e.g. Cloudflare R2), and list
them in manifest.json.

manifest.json format:

{
  "datasets": [
    { "id": "2023-05", "label": "May 2023",  "url": "2023-05.copc.laz" },
    { "id": "2024-06", "label": "June 2024", "url": "2024-06.copc.laz" },
    { "id": "2025-01", "label": "Jan 2025",  "url": "https://example.com/2025-01.copc.laz" }
  ],
  "ground": "ground.copc.laz"
}

- "datasets" is an arbitrary-length list of point clouds selectable via the
  left/right dropdowns in Compare mode. "id" must be unique; "label" is what
  the user sees in the dropdown. "url" can be a filename relative to this
  folder, or a full https:// URL.
- "ground" is a single, fixed point cloud (typically ground-only, carrying an
  M3C2 scalar field) used by the Difference view. It is not user-selectable
  and is only loaded when Difference mode is opened.

Legacy manifest.json files with "before"/"after"/"ground" fields (no
"datasets" array) are still accepted and are converted into a two-entry
dataset list automatically.
