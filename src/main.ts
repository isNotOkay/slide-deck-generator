import Reveal from "reveal.js";

import "reveal.js/reveal.css";
import "../theme.css";

import { renderSlides } from "./deck.ts";
import { parseDeck } from "./slides.ts";

const slides = document.querySelector<HTMLDivElement>("#slides")
    ?? (() => {
        throw new Error("Slides container not found");
    })();

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

type DeckSummary = {
    id: string;
    title: string;
};

function parseDeckSummaries(value: unknown): DeckSummary[] {
    if (!Array.isArray(value)) {
        throw new Error("Deck list response must be an array");
    }

    return value.map((summary, index) => {
        if (
            typeof summary !== "object" ||
            summary === null ||
            typeof summary.id !== "string" ||
            typeof summary.title !== "string"
        ) {
            throw new Error(`Deck list item ${index} is invalid`);
        }

        return summary;
    });
}

function showStatus(title: string, message: string, summaries: DeckSummary[] = []): void {
    slides.replaceChildren();

    const section = document.createElement("section");
    section.className = "deck-status";

    const heading = document.createElement("h1");
    heading.textContent = title;
    section.append(heading);

    const description = document.createElement("p");
    description.textContent = message;
    section.append(description);

    if (summaries.length > 0) {
        const list = document.createElement("ul");

        for (const summary of summaries) {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = `?deck=${encodeURIComponent(summary.id)}`;
            link.textContent = `${summary.title} (${summary.id})`;
            item.append(link);
            list.append(item);
        }

        section.append(list);
    }

    slides.append(section);
    document.title = title;
}

async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`);

    if (!response.ok) {
        let message = `Request failed with status ${response.status}`;

        try {
            const body = await response.json() as { error?: unknown };

            if (typeof body.error === "string") {
                message = body.error;
            }
        } catch {
            // Keep the HTTP status message when the error body is unavailable.
        }

        throw new Error(message);
    }

    return response.json() as Promise<T>;
}

async function loadInitialContent(): Promise<void> {
    const deckId = new URLSearchParams(window.location.search).get("deck");

    if (!deckId) {
        const summaries = parseDeckSummaries(
            await fetchJson<unknown>("/decks")
        );

        if (summaries.length === 0) {
            showStatus(
                "No decks available",
                "Create a deck with PUT /api/decks/:id, then open it using ?deck=<id>."
            );
            return;
        }

        showStatus("Choose a deck", "Select a deck to begin.", summaries);
        return;
    }

    const deck = parseDeck(
        await fetchJson<unknown>(`/decks/${encodeURIComponent(deckId)}`)
    );
    slides.innerHTML = renderSlides(deck);
    document.title = deck.title;
}

try {
    await loadInitialContent();
} catch (error) {
    showStatus(
        "Unable to load deck",
        error instanceof Error ? error.message : "The deck could not be loaded."
    );
}

const deck = new Reveal();

await deck.initialize({
    controls: true,
    progress: true,
    hash: true,

    transition: "none",

    width: 1600,
    height: 900,
    margin: 0
});
