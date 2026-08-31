import {
    copyFile,
    mkdir,
    readFile,
    writeFile
} from "node:fs/promises";

import { demoDeck } from "./demo.ts";
import { renderDeck } from "./deck.ts";

await mkdir("dist", {
    recursive: true
});

await writeFile(
    "dist/index.html",
    renderDeck(demoDeck)
);

await copyFile(
    "node_modules/reveal.js/dist/reveal.js",
    "dist/reveal.js"
);

await copyFile(
    "node_modules/reveal.js/dist/reveal.css",
    "dist/reveal.css"
);

const theme = await readFile("theme.css", "utf8");

await writeFile(
    "dist/theme.css",
    theme
);