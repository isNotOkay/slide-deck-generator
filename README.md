# Slide Deck Generator

An Angular application for presenting a validated, JSON-backed slide deck in the browser.

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

This starts both the Angular development server and the local deck API. The singleton presentation is stored in `data/deck.json` and opens at `/slides/1`. Every slide JSON object must include a unique, stable `id`; the viewer polls the API for external deck updates and presents slide-level review controls when changes arrive.

Create or replace a deck with:

```bash
curl -X PUT http://127.0.0.1:3001/api/deck \
  -H 'Content-Type: application/json' \
  --data @deck.json
```

Other useful commands:

```bash
npm run check    # Type-check the project
npm run build    # Create a production build
npm run preview  # Preview the production build locally
```

## Docker deployment

Build and run the production image:

```bash
docker build -t slide-deck-generator .
docker run --rm -p 3001:3001 \
  -v slide-deck-data:/app/data \
  slide-deck-generator
```

Or use Compose:

```bash
docker compose up --build
```

Open `http://127.0.0.1:3001`. The named Docker volume preserves changes made through the API; the initial
`data/deck.json` is copied into an empty volume on first startup. Set `SLIDE_DECK_PORT` to change the host port.

## Project structure

- `src/slides.ts` defines the typed deck and slide models and validates API data.
- `src/app/slide/` renders every supported slide layout.
- `src/app/presentation/` owns routed presentation state and navigation.
- `src/app/sidebar/` provides thumbnail navigation and drag-to-reorder behavior.
- `server/index.ts` provides the JSON-backed deck API.
- `data/deck.json` is the API-managed presentation file.

Use Download in the slide sidebar to save all slides in the current order as a 16:9 PDF or download the source JSON.
