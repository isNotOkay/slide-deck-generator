// file: server/index.ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { DeckValidationError, parseDeck, type Deck } from "../src/slides.ts";

const port = Number(process.env["PORT"] ?? 3001);
const defaultDeckFile = resolve(
    fileURLToPath(new URL("../data/deck.json", import.meta.url))
);
const defaultStaticDirectory = process.env["STATIC_DIR"]
    ? resolve(process.env["STATIC_DIR"])
    : undefined;
const host = process.env["HOST"] ?? "127.0.0.1";
const maxBodyBytes = 1_000_000;

const contentTypes: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
};

type UnknownRecord = Record<string, unknown>;

type PatchOperation =
    | {
    op: "updateSlide";
    slideId: string;
    changes: UnknownRecord;
}
    | {
    op: "addSlide";
    slide: unknown;
    afterSlideId?: string | null;
}
    | {
    op: "removeSlide";
    slideId: string;
}
    | {
    op: "moveSlide";
    slideId: string;
    afterSlideId?: string | null;
}
    | {
    op: "updateDeck";
    changes: {
        title?: string;
    };
};

class ApiError extends Error {
    readonly statusCode: number;

    constructor(statusCode: number, message: string) {
        super(message);
        this.statusCode = statusCode;
    }
}

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
    value: UnknownRecord,
    key: string,
    path: string
): string {
    const result = value[key];

    if (typeof result !== "string") {
        throw new ApiError(400, `${path}.${key} must be a string`);
    }

    return result;
}

function optionalSlideId(
    value: UnknownRecord,
    key: string,
    path: string
): string | null | undefined {
    const result = value[key];

    if (result === undefined || result === null || typeof result === "string") {
        return result;
    }

    throw new ApiError(400, `${path}.${key} must be a string or null`);
}

function sendJson(
    response: ServerResponse,
    statusCode: number,
    body: unknown
): void {
    response.writeHead(statusCode, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS",
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });

    response.end(JSON.stringify(body));
}

function staticFilePath(
    staticDirectory: string,
    pathname: string
): string {
    const filePath = resolve(staticDirectory, `.${pathname}`);

    if (
        filePath !== staticDirectory &&
        !filePath.startsWith(`${staticDirectory}${sep}`)
    ) {
        throw new ApiError(400, "Invalid static file path");
    }

    return filePath;
}

async function sendStaticFile(
    response: ServerResponse,
    filePath: string,
    cacheControl: string
): Promise<void> {
    const contents = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();

    response.writeHead(200, {
        "Cache-Control": cacheControl,
        "Content-Length": contents.byteLength,
        "Content-Type": contentTypes[extension] ?? "application/octet-stream"
    });

    if (response.req?.method !== "HEAD") {
        response.end(contents);
        return;
    }

    response.end();
}

async function serveStatic(
    request: IncomingMessage,
    response: ServerResponse,
    staticDirectory: string
): Promise<boolean> {
    if (request.method !== "GET" && request.method !== "HEAD") {
        return false;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    let pathname: string;

    try {
        pathname = decodeURIComponent(requestUrl.pathname);
    } catch {
        throw new ApiError(400, "Invalid URL path");
    }

    const requestedFile = staticFilePath(staticDirectory, pathname);

    try {
        const fileStats = await stat(requestedFile);

        if (fileStats.isFile()) {
            await sendStaticFile(
                response,
                requestedFile,
                pathname === "/index.html"
                    ? "no-store"
                    : "public, max-age=31536000, immutable"
            );
            return true;
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
        }
    }

    if (extname(pathname) !== "") {
        return false;
    }

    const indexFile = join(staticDirectory, "index.html");

    try {
        const indexStats = await stat(indexFile);

        if (!indexStats.isFile()) {
            return false;
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        }

        throw error;
    }

    await sendStaticFile(response, indexFile, "no-store");
    return true;
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
        await writeFile(
            temporaryPath,
            `${JSON.stringify(deck, null, 2)}\n`,
            {
                encoding: "utf8",
                flag: "wx"
            }
        );

        await rename(temporaryPath, deckFile);
    } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
    }
}

function parsePatchOperations(value: unknown): PatchOperation[] {
    if (!isRecord(value) || !Array.isArray(value["operations"])) {
        throw new ApiError(400, "Body.operations must be an array");
    }

    if (value["operations"].length === 0) {
        throw new ApiError(400, "Body.operations must not be empty");
    }

    return value["operations"].map((operation, index): PatchOperation => {
        const path = `operations[${index}]`;

        if (!isRecord(operation)) {
            throw new ApiError(400, `${path} must be an object`);
        }

        const op = requiredString(operation, "op", path);

        switch (op) {
            case "updateSlide": {
                const changes = operation["changes"];

                if (!isRecord(changes)) {
                    throw new ApiError(400, `${path}.changes must be an object`);
                }

                return {
                    op,
                    slideId: requiredString(operation, "slideId", path),
                    changes
                };
            }

            case "addSlide":
                if (!isRecord(operation["slide"])) {
                    throw new ApiError(400, `${path}.slide must be an object`);
                }

                return {
                    op,
                    slide: operation["slide"],
                    afterSlideId: optionalSlideId(
                        operation,
                        "afterSlideId",
                        path
                    )
                };

            case "removeSlide":
                return {
                    op,
                    slideId: requiredString(operation, "slideId", path)
                };

            case "moveSlide":
                return {
                    op,
                    slideId: requiredString(operation, "slideId", path),
                    afterSlideId: optionalSlideId(
                        operation,
                        "afterSlideId",
                        path
                    )
                };

            case "updateDeck": {
                const changes = operation["changes"];

                if (!isRecord(changes)) {
                    throw new ApiError(400, `${path}.changes must be an object`);
                }

                if (
                    changes["title"] !== undefined &&
                    typeof changes["title"] !== "string"
                ) {
                    throw new ApiError(
                        400,
                        `${path}.changes.title must be a string`
                    );
                }

                return {
                    op,
                    changes: {
                        title:
                            typeof changes["title"] === "string"
                                ? changes["title"]
                                : undefined
                    }
                };
            }

            default:
                throw new ApiError(400, `${path}.op "${op}" is unsupported`);
        }
    });
}

function findSlideIndex(
    slides: readonly unknown[],
    slideId: string
): number {
    return slides.findIndex(
        slide => isRecord(slide) && slide["id"] === slideId
    );
}

function requireSlideIndex(
    slides: readonly unknown[],
    slideId: string
): number {
    const index = findSlideIndex(slides, slideId);

    if (index === -1) {
        throw new ApiError(404, `Slide "${slideId}" was not found`);
    }

    return index;
}

function insertionIndex(
    slides: readonly unknown[],
    afterSlideId: string | null | undefined
): number {
    if (afterSlideId === undefined) {
        return slides.length;
    }

    if (afterSlideId === null) {
        return 0;
    }

    return requireSlideIndex(slides, afterSlideId) + 1;
}

function applyPatch(deck: Deck, operations: readonly PatchOperation[]): Deck {
    const workingDeck: {
        title: string;
        slides: unknown[];
    } = {
        title: deck.title,
        slides: deck.slides.map(slide => ({ ...slide }))
    };

    for (const operation of operations) {
        switch (operation.op) {
            case "updateSlide": {
                const index = requireSlideIndex(
                    workingDeck.slides,
                    operation.slideId
                );

                if (
                    operation.changes["id"] !== undefined &&
                    operation.changes["id"] !== operation.slideId
                ) {
                    throw new ApiError(
                        400,
                        "updateSlide cannot change a slide id"
                    );
                }

                workingDeck.slides[index] = {
                    ...(workingDeck.slides[index] as UnknownRecord),
                    ...operation.changes,
                    id: operation.slideId
                };

                break;
            }

            case "addSlide": {
                const index = insertionIndex(
                    workingDeck.slides,
                    operation.afterSlideId
                );

                workingDeck.slides.splice(index, 0, operation.slide);
                break;
            }

            case "removeSlide": {
                const index = requireSlideIndex(
                    workingDeck.slides,
                    operation.slideId
                );

                workingDeck.slides.splice(index, 1);
                break;
            }

            case "moveSlide": {
                if (operation.afterSlideId === operation.slideId) {
                    throw new ApiError(
                        400,
                        "A slide cannot be moved after itself"
                    );
                }

                const sourceIndex = requireSlideIndex(
                    workingDeck.slides,
                    operation.slideId
                );

                const [slide] = workingDeck.slides.splice(sourceIndex, 1);
                const targetIndex = insertionIndex(
                    workingDeck.slides,
                    operation.afterSlideId
                );

                workingDeck.slides.splice(targetIndex, 0, slide);
                break;
            }

            case "updateDeck":
                if (operation.changes.title !== undefined) {
                    workingDeck.title = operation.changes.title;
                }

                break;
        }
    }

    return parseDeck(workingDeck);
}

async function handleRequest(
    request: IncomingMessage,
    response: ServerResponse,
    deckFile: string,
    staticDirectory?: string
): Promise<void> {
    if (request.method === "OPTIONS") {
        response.writeHead(204, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET, PUT, PATCH, OPTIONS"
        });

        response.end();
        return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    if (requestUrl.pathname === "/healthz" && request.method === "GET") {
        sendJson(response, 200, { status: "ok" });
        return;
    }

    if (requestUrl.pathname === "/api/deck") {
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

        if (request.method === "PATCH") {
            const currentDeck = await loadDeck(deckFile);
            const operations = parsePatchOperations(
                await readRequestBody(request)
            );

            const updatedDeck = applyPatch(currentDeck, operations);

            await saveDeck(deckFile, updatedDeck);
            sendJson(response, 200, updatedDeck);
            return;
        }

        sendJson(response, 405, { error: "Method not allowed" });
        return;
    }

    const slideMatch = requestUrl.pathname.match(
        /^\/api\/deck\/slides\/([^/]+)$/
    );

    if (slideMatch) {
        if (request.method !== "GET") {
            sendJson(response, 405, { error: "Method not allowed" });
            return;
        }

        const slideId = decodeURIComponent(slideMatch[1]);
        const deck = await loadDeck(deckFile);
        const slide = deck.slides.find(slide => slide.id === slideId);

        if (!slide) {
            throw new ApiError(404, `Slide "${slideId}" was not found`);
        }

        sendJson(response, 200, slide);
        return;
    }

    if (
        staticDirectory &&
        await serveStatic(request, response, staticDirectory)
    ) {
        return;
    }

    sendJson(response, 404, { error: "Not found" });
}

export function createApiServer(
    deckFile = defaultDeckFile,
    staticDirectory = defaultStaticDirectory
) {
    return createServer((request, response) => {
        handleRequest(request, response, deckFile, staticDirectory).catch(error => {
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
    createApiServer().listen(port, host, () => {
        console.log(`Slide Deck listening on http://${host}:${port}`);
    });
}
