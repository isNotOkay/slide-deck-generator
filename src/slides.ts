export type TitleSlide = {
    type: "title";
    title: string;
    subtitle?: string;
};

export type SectionSlide = {
    type: "section";
    title: string;
    subtitle?: string;
};

export type StatementSlide = {
    type: "statement";
    statement: string;
    supportingText?: string;
};

export type ContentSlide = {
    type: "content";
    title: string;
    body?: string;
    bullets?: string[];
};

export type SplitSlide = {
    type: "split";
    title: string;

    leftTitle?: string;
    leftItems: string[];

    rightTitle?: string;
    rightItems: string[];
};

export type Metric = {
    value: string;
    label: string;
    context?: string;
};

export type MetricsSlide = {
    type: "metrics";
    title: string;
    metrics: Metric[];
};

export type VisualSlide = {
    type: "visual";
    title: string;
    image: string;
    caption?: string;
};

export type TableSlide = {
    type: "table";
    title: string;
    headers: string[];
    rows: string[][];
};

export type Slide =
    | TitleSlide
    | SectionSlide
    | StatementSlide
    | ContentSlide
    | SplitSlide
    | MetricsSlide
    | VisualSlide
    | TableSlide;

export type Deck = {
    title: string;
    slides: Slide[];
};