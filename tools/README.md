# Tools directory

`/tools/` lists all nine interactive tool pages currently published on the site, including the three Metaball versions and both Color VFX versions. Articles, courses, case studies, and image comparison galleries are outside this catalog.

- `catalog.mjs` is the shared source of names, URLs, descriptions, categories, and formats.
- `build.mjs` generates the complete static `index.html`. Run `node tools/build.mjs` from the repository root after catalog, preview, or shared Hofmann geometry changes, then commit both source and generated HTML. No server build is needed.
- Previews are illustrative SVG studies of each tool's visual technique. Hofmann imports its grid and contour geometry from `../hofmann/geometry.mjs`. They are not screenshots or saved projects.
- `menu.mjs` defines the shared `<dy-tool-menu>` element and loads `menu.css` inside its shadow root so editor CSS and event selectors do not affect navigation. The menu uses the manual Popover API to appear in the browser's top layer, escaping transformed or clipped editor containers; its position and maximum height follow the viewport. `compact` shows only the menu icon; `theme="dark"` matches dark editors. The light DOM link remains usable when JavaScript is unavailable.
- The menu is installed in all nine tool pages and the existing portfolio header wherever it is present. It supports keyboard focus, Escape, outside clicks, and highlights the current tool.
- `app.mjs` adds optional category filtering. Every tool link remains present without JavaScript.

To add a tool: add a catalog entry, add its geometric preview to `build.mjs`, regenerate, and insert the menu element plus `/tools/menu.mjs` into the new editor's navigation. Do not include private or unrelated working files in deployment.
