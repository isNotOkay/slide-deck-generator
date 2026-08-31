import Reveal from "reveal.js";

import "reveal.js/reveal.css";
import "../theme.css";

import { demoDeck } from "./demo.ts";
import { renderSlides } from "./deck.ts";

const slides = document.querySelector<HTMLDivElement>("#slides");

if (!slides) {
    throw new Error("Slides container not found");
}

slides.innerHTML = renderSlides(demoDeck);

document.title = demoDeck.title;

const deck = new Reveal();

await deck.initialize({
    controls: true,
    progress: true,
    hash: true,

    transition: "none",

    width: 1600,
    height: 900,
    margin: 0
});