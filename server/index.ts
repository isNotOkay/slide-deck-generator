import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DeckValidationError, parseDeck, type Deck } from "../src/slides.ts";

const port = Number(process.env["PORT"] ?? 3001);
const defaultDeckFile = resolve(
    fileURLToPath(new URL("../data/deck.json", import.meta.url))
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

async function loadDeck(deckFile: string): Promise<Deck> {
    try {
        const contents = await readFile(deckFile, "utf8");
        return parseDeck(JSON.parse(contents));
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        if (error instanceof DeckValidationError) {
            throw new ApiError(500, `Stored deck is invalid: ${error.message}`);
        }

        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new ApiError(404, "Deck was not found");
        }

        if (error instanceof SyntaxError) {
            throw new ApiError(500, "Stored deck contains invalid JSON");
        }

        throw error;
    }
}

async function saveDeck(deckFile: string, deck: Deck): Promise<void> {
    const deckDirectory = dirname(deckFile);
    await mkdir(deckDirectory, { recursive: true });

    const temporaryPath = join(deckDirectory, `.deck.${randomUUID()}.tmp`);

    try {
        await writeFile(temporaryPath, `${JSON.stringify(deck, null, 2)}\n`, {
            encoding: "utf8",
            flag: "wx"
        });
        await rename(temporaryPath, deckFile);
    } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    deckFile: string
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
    if (requestUrl.pathname !== "/api/deck") {
        sendJson(response, 404, { error: "Not found" });
        return;
    }

    if (request.method === "GET") {
        sendJson(response, 200, await loadDeck(deckFile));
        return;
    }

    if (request.method === "PUT") {
        const deck = parseDeck(await readRequestBody(request));
        await saveDeck(deckFile, deck);
        sendJson(response, 200, deck);
        return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
}

export function createApiServer(deckFile = defaultDeckFile) {
    return createServer((request, response) => {
        handleRequest(request, response, deckFile).catch(error => {
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
