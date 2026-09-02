import type { Deck, Slide } from "./slides.js";

export type SlideChange = {
    slideId: string;
    added: boolean;
    removed: boolean;
    changed: boolean;
    moved: boolean;
    beforeIndex?: number;
    afterIndex?: number;
};

export type DeckDiff = {
    changes: SlideChange[];
};

type ComparableSlide = Omit<Slide, "id">;

function comparableSlide(slide: Slide): ComparableSlide {
    const { id: _id, ...content } = slide;
    return content;
}

function stableSerialize(value: unknown): string {
    if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(",")}]`;
    }

    if (value && typeof value === "object") {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([left], [right]) => left.localeCompare(right));
        return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
    }

    return JSON.stringify(value);
}

function sameSlideContent(before: Slide, after: Slide): boolean {
    return stableSerialize(comparableSlide(before)) === stableSerialize(comparableSlide(after));
}

function longestCommonSubsequence(beforeIds: readonly string[], afterIds: readonly string[]): Set<string> {
    const lengths = Array.from({ length: beforeIds.length + 1 }, () =>
        new Array<number>(afterIds.length + 1).fill(0)
    );

    for (let beforeIndex = 1; beforeIndex <= beforeIds.length; beforeIndex += 1) {
        for (let afterIndex = 1; afterIndex <= afterIds.length; afterIndex += 1) {
            lengths[beforeIndex][afterIndex] = beforeIds[beforeIndex - 1] === afterIds[afterIndex - 1]
                ? lengths[beforeIndex - 1][afterIndex - 1] + 1
                : Math.max(lengths[beforeIndex - 1][afterIndex], lengths[beforeIndex][afterIndex - 1]);
        }
    }

    const result = new Set<string>();
    let beforeIndex = beforeIds.length;
    let afterIndex = afterIds.length;

    while (beforeIndex > 0 && afterIndex > 0) {
        if (beforeIds[beforeIndex - 1] === afterIds[afterIndex - 1]) {
            result.add(beforeIds[beforeIndex - 1]);
            beforeIndex -= 1;
            afterIndex -= 1;
        } else if (lengths[beforeIndex - 1][afterIndex] >= lengths[beforeIndex][afterIndex - 1]) {
            beforeIndex -= 1;
        } else {
            afterIndex -= 1;
        }
    }

    return result;
}

export function diffDecks(before: Deck, after: Deck): DeckDiff {
    const beforeById = new Map(before.slides.map((slide, index) => [slide.id, { slide, index }]));
    const afterById = new Map(after.slides.map((slide, index) => [slide.id, { slide, index }]));
    const survivingBeforeIds = before.slides
        .map(slide => slide.id)
        .filter(id => afterById.has(id));
    const survivingAfterIds = after.slides
        .map(slide => slide.id)
        .filter(id => beforeById.has(id));
    const unchangedOrderIds = longestCommonSubsequence(survivingBeforeIds, survivingAfterIds);

    const changes = after.slides.map((afterSlide, afterIndex): SlideChange => {
        const beforeEntry = beforeById.get(afterSlide.id);

        if (!beforeEntry) {
            return {
                slideId: afterSlide.id,
                added: true,
                removed: false,
                changed: false,
                moved: false,
                afterIndex
            };
        }

        return {
            slideId: afterSlide.id,
            added: false,
            removed: false,
            changed: !sameSlideContent(beforeEntry.slide, afterSlide),
            moved: !unchangedOrderIds.has(afterSlide.id),
            beforeIndex: beforeEntry.index,
            afterIndex
        };
    });

    for (const [slideId, beforeEntry] of beforeById) {
        if (!afterById.has(slideId)) {
            changes.push({
                slideId,
                added: false,
                removed: true,
                changed: false,
                moved: false,
                beforeIndex: beforeEntry.index
            });
        }
    }

    return { changes };
}
