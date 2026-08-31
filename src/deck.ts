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
        .replaceAll(">", "&gt;");
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

export function renderDeck(deck: Deck): string {
    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(deck.title)}</title>

  <link rel="stylesheet" href="./reveal.css">
  <link rel="stylesheet" href="./theme.css">
</head>
<body>
  <div class="reveal">
    <div class="slides">
      ${deck.slides.map(renderSlide).join("\n")}
    </div>
  </div>

  <script src="./reveal.js"></script>
  <script>
    Reveal.initialize({
      transition: "none",
      width: 1600,
      height: 900
    });
  </script>
</body>
</html>
`;
}