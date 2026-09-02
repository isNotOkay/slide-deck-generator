# Agent guidance

## Project overview

This is an Angular standalone application that displays one JSON-backed slide deck in the browser.

- Define deck and slide data using the types in `src/slides.ts`.
- Keep presentation rendering in the standalone components under `src/app/`.
- Use the API-managed `data/deck.json` file for deck content and component SCSS for presentation styling.
- Preserve HTML escaping when rendering user-provided slide content.

## Development

Use the existing npm scripts:

```bash
npm run dev
npm run check
npm run build
```

Run `npm run check` and `npm run build` after relevant changes. Keep documentation concise and avoid changing unrelated files.
