import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DeckValidationError, parseDeck, type Deck } from "../src/slides.ts";

const port = Number(process.env.PORT ?? 3001);
const defaultDeckDirectory = resolve(
    fileURLToPath(new URL("../data/decks", import.meta.url))
);
const maxBodyBytes = 1_000_000;

class ApiError extends Error {
    readonly statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

function sendJson(
    response: ServerResponse,
    statusCode: number,
    body: unknown
): void {
    response.writeHead(statusCode, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    response.end(JSON.stringify(body));
}

function deckFile(deckDirectory: string, id: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) {
        throw new ApiError(400, "Deck ID may contain only letters, numbers, hyphens, and underscores");
    }

    return join(deckDirectory, `${id}.json`);
}

async function readRequestBody(request: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;

        if (totalBytes > maxBodyBytes) {
            throw new ApiError(413, "Deck payload is too large");
        }

        chunks.push(buffer);
    }

    try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
        throw new ApiError(400, "Request body must contain valid JSON");
    }
}

async function loadDeck(deckDirectory: string, id: string): Promise<Deck> {
    const filePath = deckFile(deckDirectory, id);

    try {
        const contents = await readFile(filePath, "utf8");
        return parseDeck(JSON.parse(contents));
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        if (error instanceof DeckValidationError) {
            throw new ApiError(500, `Stored deck '${id}' is invalid: ${error.message}`);
        }

        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new ApiError(404, `Deck '${id}' was not found`);
        }

        if (error instanceof SyntaxError) {
            throw new ApiError(500, `Stored deck '${id}' contains invalid JSON`);
        }

        throw error;
    }
}

async function listDecks(deckDirectory: string): Promise<Array<{ id: string; title: string }>> {
    await mkdir(deckDirectory, { recursive: true });
    const entries = await readdir(deckDirectory, { withFileTypes: true });
    const deckEntries = entries.filter(
        entry => entry.isFile() && entry.name.endsWith(".json")
    );

    return Promise.all(
        deckEntries.map(async entry => {
            const id = entry.name.slice(0, -5);
            const deck = await loadDeck(deckDirectory, id);
            return { id, title: deck.title };
        })
    );
}

async function saveDeck(deckDirectory: string, id: string, deck: Deck): Promise<void> {
    await mkdir(deckDirectory, { recursive: true });

    const filePath = deckFile(deckDirectory, id);
    const temporaryPath = join(deckDirectory, `.${id}.${randomUUID()}.tmp`);

    try {
        await writeFile(temporaryPath, `${JSON.stringify(deck, null, 2)}\n`, {
            encoding: "utf8",
            flag: "wx"
        });
        await rename(temporaryPath, filePath);
    } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    deckDirectory: string
): Promise<void> {
    if (request.method === "OPTIONS") {
        response.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET, PUT, OPTIONS"
        });
        response.end();
        return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const segments = requestUrl.pathname.split("/").filter(Boolean);

    if (segments[0] !== "api" || segments[1] !== "decks") {
        sendJson(response, 404, { error: "Not found" });
        return;
    }

    if (segments.length === 2 && request.method === "GET") {
        sendJson(response, 200, await listDecks(deckDirectory));
        return;
    }

    if (segments.length !== 3) {
        sendJson(response, 404, { error: "Not found" });
        return;
    }

    let id: string;

    try {
        id = decodeURIComponent(segments[2]);
    } catch {
        throw new ApiError(400, "Deck ID is not valid URL encoding");
    }

    if (request.method === "GET") {
        sendJson(response, 200, await loadDeck(deckDirectory, id));
        return;
    }

    if (request.method === "PUT") {
        const deck = parseDeck(await readRequestBody(request));
        await saveDeck(deckDirectory, id, deck);
        sendJson(response, 200, deck);
        return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
}

export function createApiServer(deckDirectory = defaultDeckDirectory) {
    return createServer((request, response) => {
        handleRequest(request, response, deckDirectory).catch(error => {
            if (error instanceof ApiError) {
                sendJson(response, error.statusCode, { error: error.message });
                return;
            }

            if (error instanceof DeckValidationError) {
                sendJson(response, 400, { error: error.message });
                return;
            }

            console.error(error);
            sendJson(response, 500, { error: "Internal server error" });
        });
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    createApiServer().listen(port, "127.0.0.1", () => {
        console.log(`Deck API listening on http://127.0.0.1:${port}`);
    });
}
