import { moveItemInArray } from "@angular/cdk/drag-drop";
import { MatIconButton } from "@angular/material/button";
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import type { Deck } from "../../slides";
import { DeckRepository } from "../deck.repository";
import { Sidebar, type SlideReorder } from "../sidebar/sidebar";
import { Slide } from "../slide/slide";

@Component({
  selector: "app-presentation",
  imports: [Sidebar, Slide, MatIconButton],
  templateUrl: "./presentation.html",
  styleUrl: "./presentation.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "(document:keydown)": "handleKeydown($event)" }
})
export class Presentation {
  readonly slideNumber = input.required<string>();

  private readonly repository = inject(DeckRepository);
  private readonly router = inject(Router);
  private readonly documentTitle = inject(Title);

  protected readonly deck = signal<Deck | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly announcement = signal("");

  protected readonly slideCount = computed(() => this.deck()?.slides.length ?? 0);
  protected readonly currentIndex = computed(() =>
    this.canonicalNumber(this.slideNumber(), this.slideCount()) - 1
  );
  protected readonly canGoPrevious = computed(() => this.slideCount() > 0 && this.currentIndex() > 0);
  protected readonly canGoNext = computed(() => this.slideCount() > 0 && this.currentIndex() < this.slideCount() - 1);

  constructor() {
    effect(() => {
      const deck = this.deck();
      if (!deck) return;

      this.documentTitle.setTitle(deck.title);
      const canonical = String(this.canonicalNumber(this.slideNumber(), deck.slides.length));
      if (this.slideNumber() !== canonical) {
        void this.navigateTo(Number(canonical) - 1, true);
      }
    });

    this.loadDeck();
  }

  protected loadDeck(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.repository.load().subscribe({
      next: deck => {
        this.deck.set(deck);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      }
    });
  }

  protected navigateTo(index: number, replaceUrl = false): Promise<boolean> {
    const count = this.slideCount();
    const boundedIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
    return this.router.navigate(["/slides", boundedIndex + 1], { replaceUrl });
  }

  protected async reorderSlides(event: SlideReorder): Promise<void> {
    const previousDeck = this.deck();
    if (!previousDeck || this.saving() || event.previousIndex === event.currentIndex) return;

    const previousIndex = this.currentIndex();
    const selectedSlide = previousDeck.slides[previousIndex];
    const reorderedSlides = [...previousDeck.slides];
    moveItemInArray(reorderedSlides, event.previousIndex, event.currentIndex);

    const optimisticDeck = { ...previousDeck, slides: reorderedSlides };
    const selectedIndex = selectedSlide ? reorderedSlides.indexOf(selectedSlide) : 0;
    this.deck.set(optimisticDeck);
    this.saving.set(true);
    this.saveError.set(null);
    this.announcement.set("Saving slide order.");

    try {
      await this.navigateTo(selectedIndex, true);
      await firstValueFrom(this.repository.save(optimisticDeck));
      this.announcement.set("Slide order saved.");
    } catch (error) {
      this.deck.set(previousDeck);
      await this.navigateTo(previousIndex, true);
      const message = error instanceof Error ? error.message : "The slide order could not be saved.";
      this.saveError.set(message);
      this.announcement.set(`Slide order was restored. ${message}`);
    } finally {
      this.saving.set(false);
    }
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (
      event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      this.isEditable(event.target)
    ) {
      return;
    }

    if (event.key === "ArrowLeft" && this.canGoPrevious()) {
      event.preventDefault();
      void this.navigateTo(this.currentIndex() - 1);
    } else if (event.key === "ArrowRight" && this.canGoNext()) {
      event.preventDefault();
      void this.navigateTo(this.currentIndex() + 1);
    }
  }

  private canonicalNumber(value: string, count: number): number {
    const parsed = /^\d+$/.test(value) ? Number(value) : 1;
    if (!Number.isSafeInteger(parsed)) return 1;
    if (count === 0) return 1;
    return Math.min(Math.max(parsed, 1), count);
  }

  private isEditable(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }
}
