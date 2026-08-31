import type { Deck } from "./slides.ts";
import demoVisual from "../demo-visual.svg";

export const demoDeck: Deck = {
    title: "Slide Type Demo",

    slides: [
        {
            type: "title",
            title: "2027 Product Strategy",
            subtitle: "Building the foundation for scalable growth"
        },

        {
            type: "section",
            title: "01 — Current State",
            subtitle: "Understanding where we are today"
        },

        {
            type: "statement",
            statement:
                "Our biggest growth constraint is no longer acquisition. It is activation.",
            supportingText:
                "The largest opportunity lies in the first 30 minutes of the customer experience."
        },

        {
            type: "content",
            title: "Why activation matters",
            bullets: [
                "Acquisition continues to perform above target",
                "Signup completion has remained stable",
                "Activation significantly underperforms the rest of the funnel",
                "Improving activation has the largest downstream impact"
            ]
        },

        {
            type: "split",
            title: "Two areas require attention",

            leftTitle: "Onboarding",
            leftItems: [
                "Too many setup steps",
                "Value demonstrated too late",
                "Limited contextual guidance"
            ],

            rightTitle: "Activation",
            rightItems: [
                "Unclear success criteria",
                "Low feature discovery",
                "Insufficient personalization"
            ]
        },

        {
            type: "metrics",
            title: "Activation remains the largest opportunity",

            metrics: [
                {
                    value: "71%",
                    label: "Signup completion",
                    context: "+3 pts YoY"
                },
                {
                    value: "43%",
                    label: "Activation",
                    context: "-2 pts YoY"
                },
                {
                    value: "82%",
                    label: "30-day retention",
                    context: "+5 pts YoY"
                }
            ]
        },

        {
            type: "visual",
            title: "Activation is the main point of friction",
            image: demoVisual,
            caption:
                "Conversion drops significantly between signup and first value."
        },

        {
            type: "table",
            title: "Priorities for the next two quarters",

            headers: [
                "Priority",
                "Impact",
                "Effort",
                "Timing"
            ],

            rows: [
                [
                    "Simplify onboarding",
                    "High",
                    "Medium",
                    "Q1"
                ],
                [
                    "Improve feature discovery",
                    "High",
                    "Low",
                    "Q1"
                ],
                [
                    "Personalize activation",
                    "High",
                    "High",
                    "Q2"
                ],
                [
                    "Improve lifecycle messaging",
                    "Medium",
                    "Medium",
                    "Q2"
                ]
            ]
        },

        {
            type: "content",
            title: "Exercise — Improve this prompt",
            body: `You are an AI assistant helping a product manager prepare for a customer interview.

Read the customer feedback provided below and identify the three most important problems mentioned by the customer.

For each problem:

1. Summarize the problem in one sentence.
2. Explain why it matters to the customer.
3. Quote the relevant evidence from the feedback.
4. Suggest one follow-up question the product manager should ask.

Do not propose solutions yet. Focus only on understanding the customer's problems and their underlying context.

Return your answer in a concise, structured format suitable for discussion with a product team.`
        }
    ]
};