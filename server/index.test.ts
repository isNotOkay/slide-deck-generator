import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApiServer } from "./index.ts";

test("deck API lists, creates, loads, and validates decks", async t => {
    const directory = await mkdtemp(join(tmpdir(), "slide-deck-generator-"));
    const server = createApiServer(directory);

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

    const emptyList = await fetch(`${baseUrl}/api/decks`);
    assert.equal(emptyList.status, 200);
    assert.deepEqual(await emptyList.json(), []);

    const created = await fetch(`${baseUrl}/api/decks/runtime-test`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deck)
    });
    assert.equal(created.status, 200);
    assert.deepEqual(await created.json(), deck);

    const loaded = await fetch(`${baseUrl}/api/decks/runtime-test`);
    assert.equal(loaded.status, 200);
    assert.deepEqual(await loaded.json(), deck);
    assert.equal(
        JSON.parse(await readFile(join(directory, "runtime-test.json"), "utf8")).title,
        "Runtime deck"
    );

    const invalid = await fetch(`${baseUrl}/api/decks/runtime-test`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Missing slides" })
    });
    assert.equal(invalid.status, 400);
});
