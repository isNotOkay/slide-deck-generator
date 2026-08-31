import type {
    ContentSlide,
    Deck,
    MetricsSlide,
    SectionSlide,
    Slide,
    SplitSlide,
    StatementSlide,
    TableSlide,
    TitleSlide,
    VisualSlide
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
        <section class="slide slide-title">
            <h1>${escapeHtml(slide.title)}</h1>

            ${
        slide.subtitle
            ? `<p>${escapeHtml(slide.subtitle)}</p>`
            : ""
    }
        </section>
    `;
}

function renderSectionSlide(slide: SectionSlide): string {
    return `
        <section class="slide slide-section">
            <h1>${escapeHtml(slide.title)}</h1>

            ${
        slide.subtitle
            ? `<p>${escapeHtml(slide.subtitle)}</p>`
            : ""
    }
        </section>
    `;
}

function renderStatementSlide(slide: StatementSlide): string {
    return `
        <section class="slide slide-statement">
            <h1>${escapeHtml(slide.statement)}</h1>

            ${
        slide.supportingText
            ? `<p>${escapeHtml(slide.supportingText)}</p>`
            : ""
    }
        </section>
    `;
}

function renderContentSlide(slide: ContentSlide): string {
    return `
        <section class="slide slide-content">
            <h2>${escapeHtml(slide.title)}</h2>

            ${
        slide.body
            ? `
                        <div class="content-body">
                            ${escapeHtml(slide.body)}
                        </div>
                    `
            : ""
    }

            ${
        slide.bullets
            ? `
                        <ul>
                            ${slide.bullets
                .map(item => `<li>${escapeHtml(item)}</li>`)
                .join("")}
                        </ul>
                    `
            : ""
    }
        </section>
    `;
}

function renderSplitSlide(slide: SplitSlide): string {
    return `
        <section class="slide slide-split">
            <h2>${escapeHtml(slide.title)}</h2>

            <div class="split-grid">
                <div class="split-column">
                    ${
        slide.leftTitle
            ? `<h3>${escapeHtml(slide.leftTitle)}</h3>`
            : ""
    }

                    <ul>
                        ${slide.leftItems
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join("")}
                    </ul>
                </div>

                <div class="split-column">
                    ${
        slide.rightTitle
            ? `<h3>${escapeHtml(slide.rightTitle)}</h3>`
            : ""
    }

                    <ul>
                        ${slide.rightItems
        .map(item => `<li>${escapeHtml(item)}</li>`)
        .join("")}
                    </ul>
                </div>
            </div>
        </section>
    `;
}

function renderMetricsSlide(slide: MetricsSlide): string {
    return `
        <section class="slide slide-metrics">
            <h2>${escapeHtml(slide.title)}</h2>

            <div class="metrics-grid">
                ${slide.metrics
        .map(metric => `
                        <div class="metric">
                            <div class="metric-value">
                                ${escapeHtml(metric.value)}
                            </div>

                            <div class="metric-label">
                                ${escapeHtml(metric.label)}
                            </div>

                            ${
            metric.context
                ? `
                                        <div class="metric-context">
                                            ${escapeHtml(metric.context)}
                                        </div>
                                    `
                : ""
        }
                        </div>
                    `)
        .join("")}
            </div>
        </section>
    `;
}

function renderVisualSlide(slide: VisualSlide): string {
    return `
        <section class="slide slide-visual">
            <h2>${escapeHtml(slide.title)}</h2>

            <div class="visual-container">
                <img
                    src="${escapeHtml(slide.image)}"
                    alt=""
                >
            </div>

            ${
        slide.caption
            ? `<p class="caption">${escapeHtml(slide.caption)}</p>`
            : ""
    }
        </section>
    `;
}

function renderTableSlide(slide: TableSlide): string {
    return `
        <section class="slide slide-table">
            <h2>${escapeHtml(slide.title)}</h2>

            <table>
                <thead>
                    <tr>
                        ${slide.headers
        .map(header => `<th>${escapeHtml(header)}</th>`)
        .join("")}
                    </tr>
                </thead>

                <tbody>
                    ${slide.rows
        .map(row => `
                            <tr>
                                ${row
            .map(cell => `<td>${escapeHtml(cell)}</td>`)
            .join("")}
                            </tr>
                        `)
        .join("")}
                </tbody>
            </table>
        </section>
    `;
}

function assertNever(value: never): never {
    throw new Error(
        `Unsupported slide type: ${JSON.stringify(value)}`
    );
}

function renderSlide(slide: Slide): string {
    switch (slide.type) {
        case "title":
            return renderTitleSlide(slide);

        case "section":
            return renderSectionSlide(slide);

        case "statement":
            return renderStatementSlide(slide);

        case "content":
            return renderContentSlide(slide);

        case "split":
            return renderSplitSlide(slide);

        case "metrics":
            return renderMetricsSlide(slide);

        case "visual":
            return renderVisualSlide(slide);

        case "table":
            return renderTableSlide(slide);

        default:
            return assertNever(slide);
    }
}

export function renderSlides(deck: Deck): string {
    return deck.slides
        .map(renderSlide)
        .join("\n");
}