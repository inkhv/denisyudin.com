# Hofmann

Vector shape editor at https://denisyudin.com/hofmann/.

A focused derivative of the site's Metaball Next workspace. Select circles in order to construct one continuous path from circular arcs and common tangents. The construction is inspired by Armin Hofmann's *Graphic Design Manual* (1965).

## Controls

- Create, edit and delete multiple shapes. Use the explicit Close button or press Enter on the canvas to close the route. Clicking an existing circle, including the first, only selects it.
- Edit the selected circle's ordinal number to move it within the route; the remaining circles are renumbered automatically. Reverse order changes traversal direction while preserving the existing geometry.
- Continue from here extends an open route from either endpoint. At the first point it reverses the route, making that point the last, so new circles can be appended without an automatic closing edge. On a closed shape it cuts the edge after the selected point and rotates that point to the end. Interior points of an open route cannot be continuation endpoints until reordered; the interface explains this.
- Set 1–24 columns and rows, a circle diameter of 5–99.5% of the grid pitch, frame dimensions of 200–4096 px, and margins.
- Switch between outline, fill, or both; set stroke width, stroke/fill/background colors.
- Select a route circle and change its wrap direction, or Shift-click it. Alt-click removes it. Backspace removes the last circle.
- Undo/redo with Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z. Arrow keys navigate circles; Space selects them.
- Export SVG, copy SVG for Figma, or download PNG at 2× the frame size. Optional guides and transparent background.
- The working document is saved locally in the browser, under an independent Hofmann storage key.

## Implementation

Static HTML/CSS and native ES modules; no build process or dependencies. Serve the repository with `python3 -m http.server 8080` and open `/hofmann/`.

- `geometry.mjs`: grid layout, automatic wrap directions, exact common tangents and SVG circular arcs. Coordinates are recomputed after changing the grid or frame.
- `route.mjs`: reorder nodes, reverse traversal, and prepare endpoint continuation. Reversing or opening a closed route resolves automatic wraps to explicit sides so already drawn tangent segments keep their geometry, including straight runs.
- `app.mjs`: state/history, pointer and keyboard drawing, rendering, local storage, and SVG/PNG export.
- `styles.css`: incumbent dark workspace and controls, responsive single-column mobile layout.

Frame and grid changes retain valid route coordinates. Shrinking the grid removes out-of-bounds nodes and opens affected paths; Undo restores the previous state. Paths may cross if the chosen route or manual wrap directions cross; fills use the even-odd rule.

The published page credits Hofmann and links to the original Metaball Next tool. Implementation is independent of the third-party Hofmann 1.0.0 codebase.
