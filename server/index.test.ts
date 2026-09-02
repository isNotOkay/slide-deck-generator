import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApiServer } from "./index.ts";

test("deck API loads, replaces, and validates the singleton deck", async t => {
    const directory = await mkdtemp(join(tmpdir(), "slide-deck-generator-"));
    const deckFile = join(directory, "deck.json");
    const initialDeck = { title: "Untitled presentation", slides: [] };
    await writeFile(deckFile, JSON.stringify(initialDeck), "utf8");
    const server = createApiServer(deckFile);

    t.after(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        await rm(directory, { recursive: true, force: true });
    });

    await new Promise<void>((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => resolve());
        server.once("error", reject);
    });

    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const deck = {
        title: "Runtime deck",
        slides: [{ type: "title", title: "First slide" }]
    };

    const loadedInitial = await fetch(`${baseUrl}/api/deck`);
    assert.equal(loadedInitial.status, 200);
    assert.deepEqual(await loadedInitial.json(), initialDeck);

    const replaced = await fetch(`${baseUrl}/api/deck`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deck)
    });
    assert.equal(replaced.status, 200);
    assert.deepEqual(await replaced.json(), deck);

    const loaded = await fetch(`${baseUrl}/api/deck`);
    assert.equal(loaded.status, 200);
    assert.deepEqual(await loaded.json(), deck);
    assert.equal(
        JSON.parse(await readFile(deckFile, "utf8")).title,
        "Runtime deck"
    );

    const invalid = await fetch(`${baseUrl}/api/deck`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Missing slides" })
    });
    assert.equal(invalid.status, 400);

    const legacyEndpoint = await fetch(`${baseUrl}/api/decks`);
    assert.equal(legacyEndpoint.status, 404);

    const unsupportedMethod = await fetch(`${baseUrl}/api/deck`, { method: "POST" });
    assert.equal(unsupportedMethod.status, 405);
});
