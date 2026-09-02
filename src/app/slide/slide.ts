import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import type { Slide as SlideModel } from "../../slides";

@Component({
  selector: "app-slide",
  templateUrl: "./slide.html",
  styleUrl: "./slide.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "[attr.data-slide-type]": "slide().type" }
})
export class Slide {
  readonly slide = input.required<SlideModel>();
}
