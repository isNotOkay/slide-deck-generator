import type {
    ContentSlide,
    Deck,
    Slide,
    TitleSlide
} from "./slides.ts";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderTitleSlide(slide: TitleSlide): string {
    return `
        <section class="slide-title">
            <h1>${escapeHtml(slide.title)}</h1>

            ${
        slide.subtitle
            ? `<p>${escapeHtml(slide.subtitle)}</p>`
            : ""
    }
        </section>
    `;
}

function renderContentSlide(slide: ContentSlide): string {
    return `
        <section class="slide-content">
            <h2>${escapeHtml(slide.title)}</h2>

            <ul>
                ${slide.bullets
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join("")}
            </ul>
        </section>
    `;
}

function renderSlide(slide: Slide): string {
    switch (slide.type) {
        case "title":
            return renderTitleSlide(slide);

        case "content":
            return renderContentSlide(slide);
    }
}

export function renderSlides(deck: Deck): string {
    return deck.slides
        .map(renderSlide)
        .join("\n");
}