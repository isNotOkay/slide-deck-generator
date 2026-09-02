import assert from "node:assert/strict";
import test from "node:test";

import { diffDecks } from "../src/deck-diff.ts";
import { DeckValidationError, parseDeck, type Deck } from "../src/slides.ts";

function deck(...slides: Deck["slides"]): Deck {
    return { title: "Test deck", slides };
}

function title(id: string, value = id) {
    return { id, type: "title" as const, title: value };
}

test("diffDecks detects unchanged decks", () => {
    const result = diffDecks(deck(title("a")), deck(title("a")));
    assert.deepEqual(result.changes, [{
        slideId: "a",
        added: false,
        removed: false,
        changed: false,
        moved: false,
        beforeIndex: 0,
        afterIndex: 0
    }]);
});

test("diffDecks detects an add without false moves", () => {
    const result = diffDecks(
        deck(title("a"), title("b")),
        deck(title("a"), title("new"), title("b"))
    );
    assert.equal(result.changes.find(change => change.slideId === "new")?.added, true);
    assert.equal(result.changes.find(change => change.slideId === "a")?.moved, false);
    assert.equal(result.changes.find(change => change.slideId === "b")?.moved, false);
});

test("diffDecks detects a removal without false moves", () => {
    const result = diffDecks(
        deck(title("a"), title("removed"), title("b")),
        deck(title("a"), title("b"))
    );
    assert.equal(result.changes.find(change => change.slideId === "removed")?.removed, true);
    assert.equal(result.changes.find(change => change.slideId === "b")?.moved, false);
});

test("diffDecks detects actual reordering", () => {
    const result = diffDecks(
        deck(title("a"), title("b"), title("c")),
        deck(title("b"), title("c"), title("a"))
    );
    assert.equal(result.changes.find(change => change.slideId === "a")?.moved, true);
    assert.equal(result.changes.find(change => change.slideId === "b")?.moved, false);
    assert.equal(result.changes.find(change => change.slideId === "c")?.moved, false);
});

test("diffDecks detects content changes independently of IDs", () => {
    const result = diffDecks(deck(title("a", "Before")), deck(title("a", "After")));
    assert.equal(result.changes[0].changed, true);
    assert.equal(result.changes[0].moved, false);
});

test("diffDecks detects a slide that moved and changed", () => {
    const result = diffDecks(
        deck(title("a"), title("b")),
        deck(title("b", "Updated"), title("a"))
    );
    const change = result.changes.find(entry => entry.slideId === "b");
    assert.equal(change?.changed, true);
    assert.equal(change?.moved, true);
});

test("diffDecks treats replacement IDs as a removal and an add", () => {
    const result = diffDecks(deck(title("before")), deck(title("after")));
    assert.equal(result.changes.find(change => change.slideId === "before")?.removed, true);
    assert.equal(result.changes.find(change => change.slideId === "after")?.added, true);
});

test("parseDeck requires slide IDs", () => {
    assert.throws(
        () => parseDeck({ title: "Test", slides: [{ type: "title", title: "Missing ID" }] }),
        (error: unknown) => error instanceof DeckValidationError && error.message.includes(".id must be a string")
    );
});

test("parseDeck rejects duplicate slide IDs", () => {
    assert.throws(
        () => parseDeck({
            title: "Test",
            slides: [title("duplicate"), title("duplicate", "Second")]
        }),
        (error: unknown) => error instanceof DeckValidationError && error.message.includes("duplicate slide id")
    );
});
