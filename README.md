# Slide Deck Generator

A small TypeScript and Reveal.js project for displaying browser-based slide decks from validated runtime data.

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

This starts both the Vite frontend and the local deck API. The API stores decks as JSON files in `data/decks/`.

Open a deck with `?deck=<id>`. With no deck ID, the app lists the available decks.

Create or replace a deck with:

```bash
curl -X PUT http://127.0.0.1:3001/api/decks/product-strategy \
  -H 'Content-Type: application/json' \
  --data @deck.json
```

Other useful commands:

```bash
npm run check    # Type-check the project
npm run build    # Create a production build
npm run preview  # Preview the production build locally
```

## Project structure

- `src/slides.ts` defines the typed deck and slide models and validates API data.
- `src/deck.ts` renders slide data as HTML.
- `server/index.ts` provides the JSON-backed deck API.
- `data/decks/` contains API-managed deck files.
- `theme.css` contains the presentation styling.
