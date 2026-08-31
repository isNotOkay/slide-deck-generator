export type TitleSlide = {
    type: "title";
    title: string;
    subtitle?: string;
};

export type ContentSlide = {
    type: "content";
    title: string;
    bullets: string[];
};

export type Slide =
    | TitleSlide
    | ContentSlide;

export type Deck = {
    title: string;
    slides: Slide[];
};