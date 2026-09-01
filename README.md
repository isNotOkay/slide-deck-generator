# Slide Deck Generator

A small TypeScript and Reveal.js project for generating browser-based slide decks from typed slide data. The repository includes a demo deck showing the supported slide types.

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Other useful commands:

```bash
npm run check    # Type-check the project
npm run build    # Create a production build
npm run preview  # Preview the production build locally
```

## Project structure

- `src/slides.ts` defines the typed deck and slide models.
- `src/deck.ts` renders slide data as HTML.
- `src/demo.ts` contains the example deck.
- `theme.css` contains the presentation styling.
