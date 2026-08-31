import type { Deck } from "./slides.ts";

export const demoDeck: Deck = {
    title: "Demo Deck",
    slides: [
        {
            type: "title",
            title: "Slide Deck Generator",
            subtitle: "A structured presentation system"
        },
        {
            type: "content",
            title: "Why this exists",
            bullets: [
                "Fixed slide layouts",
                "Structured content",
                "Predictable output",
                "Easy for LLMs to generate"
            ]
        }
    ]
};