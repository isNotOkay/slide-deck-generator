export type TitleSlide = {
    id: string;
    type: "title";
    title: string;
    subtitle?: string;
};

export type SectionSlide = {
    id: string;
    type: "section";
    title: string;
    subtitle?: string;
};

export type StatementSlide = {
    id: string;
    type: "statement";
    statement: string;
    supportingText?: string;
};

export type ContentSlide = {
    id: string;
    type: "content";
    title: string;
    body?: string;
    bullets?: string[];
};

export type SplitSlide = {
    id: string;
    type: "split";
    title: string;

    leftTitle?: string;
    leftItems: string[];

    rightTitle?: string;
    rightItems: string[];
};

export type Metric = {
    value: string;
    label: string;
    context?: string;
};

export type MetricsSlide = {
    id: string;
    type: "metrics";
    title: string;
    metrics: Metric[];
};

export type VisualSlide = {
    id: string;
    type: "visual";
    title: string;
    image: string;
    caption?: string;
};

export type TableSlide = {
    id: string;
    type: "table";
    title: string;
    headers: string[];
    rows: string[][];
};

export type Slide =
    | TitleSlide
    | SectionSlide
    | StatementSlide
    | ContentSlide
    | SplitSlide
    | MetricsSlide
    | VisualSlide
    | TableSlide;

export type Deck = {
    title: string;
    slides: Slide[];
};

export class DeckValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DeckValidationError";
    }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: UnknownRecord, key: string, path: string): string {
    const result = value[key];

    if (typeof result !== "string") {
        throw new DeckValidationError(`${path}.${key} must be a string`);
    }

    return result;
}

function optionalString(value: UnknownRecord, key: string, path: string): string | undefined {
    const result = value[key];

    if (result === undefined) {
        return undefined;
    }

    if (typeof result !== "string") {
        throw new DeckValidationError(`${path}.${key} must be a string when provided`);
    }

    return result;
}

function stringArray(value: unknown, path: string): string[] {
    if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
        throw new DeckValidationError(`${path} must be an array of strings`);
    }

    return value;
}

function parseMetric(value: unknown, index: number): Metric {
    const path = `slides[].metrics[${index}]`;

    if (!isRecord(value)) {
        throw new DeckValidationError(`${path} must be an object`);
    }

    return {
        value: requiredString(value, "value", path),
        label: requiredString(value, "label", path),
        context: optionalString(value, "context", path)
    };
}

export function parseSlide(value: unknown, index: number): Slide {
    const path = `slides[${index}]`;

    if (!isRecord(value) || typeof value["type"] !== "string") {
        throw new DeckValidationError(`${path}.type must be a string`);
    }

    const id = requiredString(value, "id", path);

    switch (value["type"]) {
        case "title":
            return {
                id,
                type: "title",
                title: requiredString(value, "title", path),
                subtitle: optionalString(value, "subtitle", path)
            };

        case "section":
            return {
                id,
                type: "section",
                title: requiredString(value, "title", path),
                subtitle: optionalString(value, "subtitle", path)
            };

        case "statement":
            return {
                id,
                type: "statement",
                statement: requiredString(value, "statement", path),
                supportingText: optionalString(value, "supportingText", path)
            };

        case "content":
            return {
                id,
                type: "content",
                title: requiredString(value, "title", path),
                body: optionalString(value, "body", path),
                bullets: value["bullets"] === undefined
                    ? undefined
                    : stringArray(value["bullets"], `${path}.bullets`)
            };

        case "split":
            return {
                id,
                type: "split",
                title: requiredString(value, "title", path),
                leftTitle: optionalString(value, "leftTitle", path),
                leftItems: stringArray(value["leftItems"], `${path}.leftItems`),
                rightTitle: optionalString(value, "rightTitle", path),
                rightItems: stringArray(value["rightItems"], `${path}.rightItems`)
            };

        case "metrics":
            if (!Array.isArray(value["metrics"])) {
                throw new DeckValidationError(`${path}.metrics must be an array`);
            }

            return {
                id,
                type: "metrics",
                title: requiredString(value, "title", path),
                metrics: value["metrics"].map(parseMetric)
            };

        case "visual":
            return {
                id,
                type: "visual",
                title: requiredString(value, "title", path),
                image: requiredString(value, "image", path),
                caption: optionalString(value, "caption", path)
            };

        case "table":
            if (!Array.isArray(value["rows"])) {
                throw new DeckValidationError(`${path}.rows must be an array`);
            }

            return {
                id,
                type: "table",
                title: requiredString(value, "title", path),
                headers: stringArray(value["headers"], `${path}.headers`),
                rows: value["rows"].map((row, rowIndex) =>
                    stringArray(row, `${path}.rows[${rowIndex}]`)
                )
            };

        default:
            throw new DeckValidationError(`${path}.type is unsupported`);
    }
}

export function parseDeck(value: unknown): Deck {
    if (!isRecord(value)) {
        throw new DeckValidationError("Deck must be an object");
    }

    if (!Array.isArray(value["slides"])) {
        throw new DeckValidationError("Deck.slides must be an array");
    }

    const slides = value["slides"].map(parseSlide);
    const ids = new Set<string>();

    for (const slide of slides) {
        if (ids.has(slide.id)) {
            throw new DeckValidationError(`Deck.slides contains duplicate slide id "${slide.id}"`);
        }

        ids.add(slide.id);
    }

    return {
        title: requiredString(value, "title", "Deck"),
        slides
    };
}
