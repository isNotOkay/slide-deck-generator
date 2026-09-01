# Agent guidance

## Project overview

This is a Vite + TypeScript application that uses Reveal.js to display slide decks in the browser.

- Define deck and slide data using the types in `src/slides.ts`.
- Keep rendering behavior in `src/deck.ts`.
- Use `src/demo.ts` for demo content and `theme.css` for presentation styling.
- Preserve HTML escaping when rendering user-provided slide content.

## Development

Use the existing npm scripts:

```bash
npm run dev
npm run check
npm run build
```

Run `npm run check` and `npm run build` after relevant changes. Keep documentation concise and avoid changing unrelated files.
