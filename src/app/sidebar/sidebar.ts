import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from "@angular/cdk/drag-drop";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatButton } from "@angular/material/button";
import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChildren } from "@angular/core";

import type { Slide as SlideModel } from "../../slides";
import { Slide } from "../slide/slide";

export type SlideReorder = Pick<CdkDragDrop<readonly SlideModel[]>, "previousIndex" | "currentIndex">;

@Component({
  selector: "app-sidebar",
  imports: [CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder, CdkScrollable, MatButton, Slide],
  templateUrl: "./sidebar.html",
  styleUrl: "./sidebar.scss",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Sidebar {
  readonly slides = input.required<readonly SlideModel[]>();
  readonly activeIndex = input.required<number>();

  readonly slideSelected = output<number>();
  readonly slidesReordered = output<SlideReorder>();

  private readonly thumbnailButtons = viewChildren<ElementRef<HTMLButtonElement>>("thumbnail");

  constructor() {
    effect(() => {
      const index = this.activeIndex();
      const buttons = this.thumbnailButtons();
      queueMicrotask(() => buttons[index]?.nativeElement.scrollIntoView({ block: "nearest" }));
    });
  }

  protected dropped(event: CdkDragDrop<readonly SlideModel[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      this.slidesReordered.emit(event);
    }
  }

  protected slideTitle(slide: SlideModel): string {
    return slide.type === "statement" ? slide.statement : slide.title;
  }
}
