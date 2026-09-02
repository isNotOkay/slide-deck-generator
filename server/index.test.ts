import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
        slides: [{ id: "first-slide", type: "title", title: "First slide" }]
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

test("API server serves the SPA shell, assets, and health check", async t => {
    const directory = await mkdtemp(join(tmpdir(), "slide-deck-generator-"));
    const deckFile = join(directory, "deck.json");
    const staticDirectory = join(directory, "browser");
    await writeFile(
        deckFile,
        JSON.stringify({ title: "Runtime deck", slides: [] }),
        "utf8"
    );
    await mkdir(join(staticDirectory, "assets"), { recursive: true });
    await writeFile(
        join(staticDirectory, "index.html"),
        "<!doctype html><app-root></app-root>",
        "utf8"
    );
    await writeFile(join(staticDirectory, "assets", "app.js"), "console.log(1);", "utf8");

    const server = createApiServer(deckFile, staticDirectory);

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

    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const shell = await fetch(`${baseUrl}/slides/1`);
    assert.equal(shell.status, 200);
    assert.match(await shell.text(), /app-root/);

    const asset = await fetch(`${baseUrl}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(await asset.text(), "console.log(1);");

    const missingAsset = await fetch(`${baseUrl}/assets/missing.js`);
    assert.equal(missingAsset.status, 404);

    const apiDeck = await fetch(`${baseUrl}/api/deck`);
    assert.equal(apiDeck.status, 200);
    assert.deepEqual(await apiDeck.json(), { title: "Runtime deck", slides: [] });
});
