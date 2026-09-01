import Reveal from "reveal.js";

import "reveal.js/reveal.css";
import "../theme.css";

import { renderSlides } from "./deck.ts";
import { parseDeck, type Deck, type Slide } from "./slides.ts";

const slides = document.querySelector<HTMLDivElement>("#slides")
    ?? (() => {
        throw new Error("Slides container not found");
    })();

const navigatorToggle = document.querySelector<HTMLButtonElement>(
    "#slide-navigator-toggle"
) ?? (() => {
    throw new Error("Slide navigator toggle not found");
})();

const slideNavigator = document.querySelector<HTMLElement>("#slide-navigator")
    ?? (() => {
        throw new Error("Slide navigator not found");
    })();

const navigatorList = document.querySelector<HTMLOListElement>(
    "#slide-navigator-list"
) ?? (() => {
    throw new Error("Slide navigator list not found");
})();

const navigatorCount = document.querySelector<HTMLSpanElement>(
    "#slide-navigator-count"
) ?? (() => {
    throw new Error("Slide navigator count not found");
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

function getSlideTitle(slide: Slide): string {
    switch (slide.type) {
        case "title":
        case "section":
        case "content":
        case "split":
        case "metrics":
        case "visual":
        case "table":
            return slide.title;

        case "statement":
            return slide.statement;
    }
}

function updateActiveThumbnail(index: number, scrollIntoView = false): void {
    const buttons = navigatorList.querySelectorAll<HTMLButtonElement>(
        ".slide-thumbnail-button"
    );

    buttons.forEach((button, buttonIndex) => {
        const isActive = buttonIndex === index;
        button.classList.toggle("is-active", isActive);

        if (isActive) {
            button.setAttribute("aria-current", "true");

            if (scrollIntoView) {
                button.scrollIntoView({
                    block: "nearest"
                });
            }
        } else {
            button.removeAttribute("aria-current");
        }
    });
}

function updateThumbnailScale(frame: HTMLElement): void {
    frame.style.setProperty(
        "--thumbnail-scale",
        String(frame.clientWidth / 1600)
    );
}

function buildSlideNavigator(deck: Deck): void {
    const renderedSlides = Array.from(
        slides.querySelectorAll<HTMLElement>(":scope > section")
    );

    navigatorList.replaceChildren();
    navigatorCount.textContent = `${deck.slides.length} ${deck.slides.length === 1 ? "slide" : "slides"}`;

    const thumbnailFrames: HTMLElement[] = [];

    renderedSlides.forEach((renderedSlide, index) => {
        const listItem = document.createElement("li");
        const button = document.createElement("button");
        const frame = document.createElement("span");
        const clone = renderedSlide.cloneNode(true) as HTMLElement;
        const title = getSlideTitle(deck.slides[index]);

        button.type = "button";
        button.className = "slide-thumbnail-button";
        button.setAttribute(
            "aria-label",
            `Go to slide ${index + 1}: ${title}`
        );

        frame.className = "slide-thumbnail-frame";
        clone.classList.add("slide-thumbnail-slide");
        clone.setAttribute("aria-hidden", "true");
        frame.append(clone);

        const caption = document.createElement("span");
        const number = document.createElement("span");
        const captionTitle = document.createElement("span");

        caption.className = "slide-thumbnail-caption";
        number.className = "slide-thumbnail-number";
        number.textContent = String(index + 1);
        captionTitle.className = "slide-thumbnail-title";
        captionTitle.append(document.createTextNode(title));
        caption.append(number, captionTitle);

        button.append(frame, caption);
        listItem.append(button);
        navigatorList.append(listItem);
        thumbnailFrames.push(frame);

        button.addEventListener("click", () => {
            presentation.slide(index);
        });
    });

    if (typeof ResizeObserver !== "undefined") {
        const resizeObserver = new ResizeObserver(() => {
            thumbnailFrames.forEach(updateThumbnailScale);
        });

        thumbnailFrames.forEach(frame => {
            resizeObserver.observe(frame);
            updateThumbnailScale(frame);
        });
    } else {
        thumbnailFrames.forEach(updateThumbnailScale);
    }

    updateActiveThumbnail(0);
}

function setNavigatorOpen(isOpen: boolean): void {
    slideNavigator.classList.toggle("is-open", isOpen);
    slideNavigator.setAttribute("aria-hidden", String(!isOpen));
    navigatorToggle.setAttribute("aria-expanded", String(isOpen));
    navigatorToggle.setAttribute(
        "aria-label",
        isOpen ? "Close slide navigator" : "Open slide navigator"
    );

    if (isOpen) {
        updateActiveThumbnail(presentation.getIndices().h, true);
    }
}

function setNavigatorVisible(isVisible: boolean): void {
    navigatorToggle.hidden = !isVisible;
    slideNavigator.hidden = !isVisible;

    if (!isVisible) {
        setNavigatorOpen(false);
    }
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
    buildSlideNavigator(deck);
    setNavigatorVisible(true);
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

const presentation = new Reveal();

navigatorToggle.addEventListener("click", () => {
    setNavigatorOpen(!slideNavigator.classList.contains("is-open"));
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && slideNavigator.classList.contains("is-open")) {
        event.preventDefault();
        event.stopPropagation();
        setNavigatorOpen(false);
        navigatorToggle.focus();
    }
});

await presentation.initialize({
    controls: true,
    progress: true,
    hash: true,

    transition: "none",

    width: 1600,
    height: 900,
    margin: 0
});

presentation.on("slidechanged", event => {
    const slideChangedEvent = event as Event & { indexh: number };
    updateActiveThumbnail(slideChangedEvent.indexh);
});

updateActiveThumbnail(presentation.getIndices().h);
