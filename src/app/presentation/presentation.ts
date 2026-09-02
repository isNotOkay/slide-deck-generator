import { moveItemInArray } from "@angular/cdk/drag-drop";
import { BreakpointObserver } from "@angular/cdk/layout";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import type { MatDrawerMode } from "@angular/material/sidenav";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { MatCard, MatCardActions, MatCardContent } from "@angular/material/card";
import { MatIcon } from "@angular/material/icon";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatSidenavContainer, MatSidenavContent, MatSidenav } from "@angular/material/sidenav";
import { MatToolbar } from "@angular/material/toolbar";
import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal, viewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Title } from "@angular/platform-browser";
import { Router } from "@angular/router";
import { EMPTY, catchError, firstValueFrom, switchMap, timer } from "rxjs";

import { diffDecks, type DeckDiff, type SlideChange } from "../../deck-diff";
import { DeckValidationError, parseDeck, type Deck } from "../../slides";
import { DeckRepository } from "../deck.repository";
import { PdfExportService } from "../pdf-export.service";
import { Sidebar, type SlideReorder } from "../sidebar/sidebar";
import { Slide } from "../slide/slide";

export type DeckReview = {
  before: Deck;
  diff: DeckDiff;
};

@Component({
  selector: "app-presentation",
  imports: [
    Sidebar,
    Slide,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatButton,
    MatCard,
    MatCardActions,
    MatCardContent,
    MatIconButton,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatProgressSpinner,
    MatSnackBarModule,
    MatSidenav,
    MatSidenavContainer,
    MatSidenavContent,
    MatToolbar
  ],
  templateUrl: "./presentation.html",
  styleUrl: "./presentation.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "(document:keydown)": "handleKeydown($event)",
    "(document:dragenter)": "handleDragEnter($event)",
    "(document:dragover)": "handleDragOver($event)",
    "(document:dragleave)": "handleDragLeave($event)",
    "(document:drop)": "handleDrop($event)"
  }
})
export class Presentation {
  readonly slideNumber = input.required<string>();

  private readonly repository = inject(DeckRepository);
  private readonly pdfExport = inject(PdfExportService);
  private readonly router = inject(Router);
  private readonly documentTitle = inject(Title);
  private readonly snackBar = inject(MatSnackBar);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly drawer = viewChild<MatSidenav>("drawer");
  private readonly exportStage = viewChild<ElementRef<HTMLElement>>("exportStage");
  private readonly jsonFileInput = viewChild<ElementRef<HTMLInputElement>>("jsonFileInput");

  protected readonly deck = signal<Deck | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly opening = signal(false);
  protected readonly exporting = signal(false);
  protected readonly isMobile = signal(false);
  protected readonly drawerOpened = signal(false);
  protected readonly fileDragActive = signal(false);
  protected readonly review = signal<DeckReview | null>(null);
  protected readonly showBefore = signal(false);

  private fileDragDepth = 0;

  protected readonly slideCount = computed(() => this.deck()?.slides.length ?? 0);
  protected readonly currentIndex = computed(() =>
    this.canonicalNumber(this.slideNumber(), this.slideCount()) - 1
  );
  protected readonly canGoPrevious = computed(() => this.slideCount() > 0 && this.currentIndex() > 0);
  protected readonly canGoNext = computed(() => this.slideCount() > 0 && this.currentIndex() < this.slideCount() - 1);
  protected readonly drawerMode = computed<MatDrawerMode>(() => this.isMobile() ? "over" : "side");
  protected readonly drawerIsOpen = computed(() => !this.isMobile() || this.drawerOpened());
  protected readonly reviewableChanges = computed(() =>
    this.review()?.diff.changes.filter(change =>
      !change.removed && change.afterIndex !== undefined &&
      (change.added || change.changed || change.moved)
    ) ?? []
  );
  protected readonly reviewableIndices = computed(() =>
    this.reviewableChanges()
      .map(change => change.afterIndex)
      .filter((index): index is number => index !== undefined)
      .sort((left, right) => left - right)
  );
  protected readonly reviewAddedCount = computed(() =>
    this.review()?.diff.changes.filter(change => change.added).length ?? 0
  );
  protected readonly reviewRemovedCount = computed(() =>
    this.review()?.diff.changes.filter(change => change.removed).length ?? 0
  );
  protected readonly reviewChangedCount = computed(() =>
    this.review()?.diff.changes.filter(change => change.changed).length ?? 0
  );
  protected readonly reviewMovedCount = computed(() =>
    this.review()?.diff.changes.filter(change => change.moved).length ?? 0
  );
  protected readonly reviewPreviousIndex = computed(() =>
    [...this.reviewableIndices()].reverse().find(index => index < this.currentIndex())
  );
  protected readonly reviewNextIndex = computed(() =>
    this.reviewableIndices().find(index => index > this.currentIndex())
  );
  protected readonly canReviewPrevious = computed(() => this.reviewPreviousIndex() !== undefined);
  protected readonly canReviewNext = computed(() => this.reviewNextIndex() !== undefined);
  protected readonly currentSlide = computed(() => this.deck()?.slides[this.currentIndex()]);
  protected readonly currentReviewChange = computed(() => {
    const currentSlide = this.currentSlide();
    const activeReview = this.review();
    if (!currentSlide || !activeReview) return null;

    const change = activeReview.diff.changes.find(entry => entry.slideId === currentSlide.id);
    return change && (change.added || change.changed || change.moved) ? change : null;
  });
  protected readonly currentComparison = computed(() => {
    const change = this.currentReviewChange();
    if (!change || !change.changed || change.beforeIndex === undefined) return null;

    const beforeSlide = this.review()?.before.slides.find(slide => slide.id === change.slideId);
    return beforeSlide ? { beforeSlide, change } : null;
  });
  protected readonly stageSlide = computed(() => {
    const currentSlide = this.currentSlide();
    const comparison = this.currentComparison();
    return this.showBefore() && comparison ? comparison.beforeSlide : currentSlide;
  });

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

    this.breakpointObserver.observe("(max-width: 720px)").pipe(takeUntilDestroyed()).subscribe(({ matches }) => {
      this.isMobile.set(matches);
      this.drawerOpened.set(!matches);
    });

    this.loadDeck();
    this.startPolling();
  }

  protected loadDeck(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.repository.load().subscribe({
      next: deck => {
        this.deck.set(deck);
        this.review.set(null);
        this.showBefore.set(false);
        this.loading.set(false);
        this.snackBar.dismiss();
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
        this.showError(`Unable to load presentation. ${error.message}`);
      }
    });
  }

  protected setDrawerOpen(open: boolean): void {
    if (this.isMobile()) {
      this.drawerOpened.set(open);
    }
  }

  protected toggleDrawer(): void {
    void this.drawer()?.toggle();
  }

  protected selectSlide(index: number): void {
    void this.navigateTo(index);
    if (this.isMobile()) {
      void this.drawer()?.close();
    }
  }

  protected navigateTo(index: number, replaceUrl = false): Promise<boolean> {
    this.showBefore.set(false);
    const count = this.slideCount();
    const boundedIndex = count === 0 ? 0 : Math.min(Math.max(index, 0), count - 1);
    return this.router.navigate(["/slides", boundedIndex + 1], { replaceUrl });
  }

  protected async reorderSlides(event: SlideReorder): Promise<void> {
    const previousDeck = this.deck();
    if (!previousDeck || this.exporting() || event.previousIndex === event.currentIndex) return;

    this.review.set(null);
    this.showBefore.set(false);
    const previousIndex = this.currentIndex();
    const selectedSlideId = previousDeck.slides[previousIndex]?.id;
    const reorderedSlides = [...previousDeck.slides];
    moveItemInArray(reorderedSlides, event.previousIndex, event.currentIndex);

    const optimisticDeck = { ...previousDeck, slides: reorderedSlides };
    const selectedIndex = selectedSlideId
      ? reorderedSlides.findIndex(slide => slide.id === selectedSlideId)
      : 0;
    this.deck.set(optimisticDeck);
    this.saving.set(true);

    try {
      await this.navigateTo(selectedIndex, true);
      const savedDeck = await firstValueFrom(this.repository.save(optimisticDeck));
      this.deck.set(savedDeck);
    } catch (error) {
      this.deck.set(previousDeck);
      await this.navigateTo(previousIndex, true);
      const message = error instanceof Error ? error.message : "The slide order could not be saved.";
      this.showError(`Slide order was restored. ${message}`);
    } finally {
      this.saving.set(false);
    }
  }

  protected async exportDeck(): Promise<void> {
    const deck = this.deck();
    const stage = this.exportStage()?.nativeElement;
    if (!deck || deck.slides.length === 0 || !stage || this.exporting()) return;

    const slides = [...stage.querySelectorAll<HTMLElement>(".export-slide")];
    if (slides.length !== deck.slides.length) return;

    this.exporting.set(true);

    try {
      await this.pdfExport.download(deck, slides);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The PDF could not be created.";
      this.showError(`PDF export failed. ${message}`);
    } finally {
      this.exporting.set(false);
    }
  }

  protected downloadDeckJson(): void {
    const deck = this.deck();
    if (!deck) return;

    const blob = new Blob([`${JSON.stringify(deck, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${this.fileName(deck.title)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected openJsonFilePicker(): void {
    if (!this.opening()) {
      this.jsonFileInput()?.nativeElement.click();
    }
  }

  protected onJsonFileSelected(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const files = input.files ? Array.from(input.files) : null;
    input.value = "";
    void this.handleJsonFile(files);
  }

  protected handleDragEnter(event: DragEvent): void {
    if (!this.isExternalFileDrag(event)) return;

    event.preventDefault();
    this.fileDragDepth += 1;
    this.fileDragActive.set(true);
  }

  protected handleDragOver(event: DragEvent): void {
    if (!this.isExternalFileDrag(event)) return;

    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    this.fileDragActive.set(true);
  }

  protected handleDragLeave(event: DragEvent): void {
    if (!this.isExternalFileDrag(event) && !this.fileDragActive()) return;

    this.fileDragDepth = Math.max(0, this.fileDragDepth - 1);
    if (this.fileDragDepth === 0) {
      this.fileDragActive.set(false);
    }
  }

  protected handleDrop(event: DragEvent): void {
    if (!this.isExternalFileDrag(event) && !this.fileDragActive()) return;

    event.preventDefault();
    this.resetFileDragState();
    const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : null;
    void this.handleJsonFile(files);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (
      event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      this.isEditable(event.target)
    ) {
      return;
    }

    if (["ArrowLeft", "ArrowUp"].includes(event.key) && this.canGoPrevious()) {
      event.preventDefault();
      void this.navigateTo(this.currentIndex() - 1);
    } else if (["ArrowRight", "ArrowDown"].includes(event.key) && this.canGoNext()) {
      event.preventDefault();
      void this.navigateTo(this.currentIndex() + 1);
    }
  }

  protected reviewPrevious(): void {
    this.navigateToReviewSlide(-1);
  }

  protected reviewNext(): void {
    this.navigateToReviewSlide(1);
  }

  protected showBeforeSlide(): void {
    if (this.currentComparison()) {
      this.showBefore.set(true);
    }
  }

  protected showAfterSlide(): void {
    this.showBefore.set(false);
  }

  protected setComparisonMode(mode: string | undefined): void {
    if (mode === "before") {
      this.showBeforeSlide();
    } else if (mode === "after") {
      this.showAfterSlide();
    }
  }

  protected comparisonLabel(change: SlideChange): string {
    if (change.added) return "Added";

    if (change.moved && change.beforeIndex !== undefined) {
      return change.changed
        ? `Modified · moved from slide ${change.beforeIndex + 1}`
        : `Moved from slide ${change.beforeIndex + 1}`;
    }

    return change.changed ? "Modified" : "Moved";
  }

  protected finishReview(): void {
    this.review.set(null);
    this.showBefore.set(false);
  }

  protected async undoReview(): Promise<void> {
    const activeReview = this.review();
    const currentSlideId = this.currentSlide()?.id;
    if (!activeReview || this.saving()) return;

    this.saving.set(true);

    try {
      const restoredDeck = await firstValueFrom(this.repository.save(activeReview.before));
      this.deck.set(restoredDeck);
      this.review.set(null);
      this.showBefore.set(false);
      const restoredIndex = currentSlideId
        ? restoredDeck.slides.findIndex(slide => slide.id === currentSlideId)
        : -1;
      await this.navigateTo(restoredIndex >= 0 ? restoredIndex : Math.min(this.currentIndex(), restoredDeck.slides.length - 1), true);
      this.showConfirmation("AI changes undone.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The previous deck could not be restored.";
      this.showError(`Unable to undo AI changes. ${message}`);
    } finally {
      this.saving.set(false);
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

  private async handleJsonFile(files: readonly File[] | null): Promise<void> {
    if (this.opening()) return;

    if (!files || files.length !== 1) {
      this.showError("Open exactly one JSON presentation file.");
      return;
    }

    this.opening.set(true);
    this.review.set(null);
    this.showBefore.set(false);

    try {
      const parsedJson: unknown = JSON.parse(await files[0].text());
      const importedDeck = parseDeck(parsedJson);
      const savedDeck = await firstValueFrom(this.repository.save(importedDeck));

      this.deck.set(savedDeck);
      this.loadError.set(null);
      await this.navigateTo(0, true);
      this.snackBar.dismiss();
    } catch (error) {
      this.showError(`Unable to open presentation. ${this.describeOpenError(error)}`);
    } finally {
      this.opening.set(false);
    }
  }

  private startPolling(): void {
    timer(1500, 1500).pipe(
      switchMap(() => this.repository.load().pipe(catchError(() => EMPTY))),
      takeUntilDestroyed()
    ).subscribe(deck => {
      if (this.loading() || this.saving() || this.opening()) return;
      void this.applyUpdatedDeck(deck);
    });
  }

  private async applyUpdatedDeck(value: unknown): Promise<void> {
    const currentDeck = this.deck();
    if (!currentDeck) return;

    let updatedDeck: Deck;
    try {
      updatedDeck = parseDeck(value);
    } catch (error) {
      this.showError(`Unable to apply presentation update. ${this.describeOpenError(error)}`);
      return;
    }

    if (this.sameDeck(currentDeck, updatedDeck)) return;

    const diff = diffDecks(currentDeck, updatedDeck);
    const added = diff.changes.filter(change => change.added);
    const removed = diff.changes.filter(change => change.removed);
    const changed = diff.changes.filter(change => change.changed);
    const moved = diff.changes.filter(change => change.moved);
    const isTrivialAddition = added.length === 1 && removed.length === 0 && changed.length === 0 && moved.length === 0;

    this.deck.set(updatedDeck);
    this.loadError.set(null);

    if (isTrivialAddition) {
      this.review.set(null);
      this.showBefore.set(false);
      const addedIndex = added[0].afterIndex;
      if (addedIndex !== undefined) {
        await this.navigateTo(addedIndex, true);
      }
      this.showConfirmation(`Added slide ${(addedIndex ?? 0) + 1}`);
      return;
    }

    if (diff.changes.some(change => change.changed || change.moved || change.added || change.removed)) {
      this.review.set({ before: currentDeck, diff });
      this.showBefore.set(false);
      const firstReviewIndex = diff.changes.find(change =>
        change.afterIndex !== undefined && (change.added || change.changed || change.moved)
      )?.afterIndex;
      if (firstReviewIndex !== undefined) {
        await this.navigateTo(firstReviewIndex, true);
      }
    } else {
      this.review.set(null);
      this.showBefore.set(false);
    }
  }

  private navigateToReviewSlide(direction: -1 | 1): void {
    if (this.reviewableIndices().length === 0) return;

    const nextIndex = direction > 0
      ? this.reviewNextIndex()
      : this.reviewPreviousIndex();

    if (nextIndex !== undefined) {
      void this.navigateTo(nextIndex);
    }
  }

  private sameDeck(left: Deck, right: Deck): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private isExternalFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    return types ? Array.from(types).includes("Files") : false;
  }

  private resetFileDragState(): void {
    this.fileDragDepth = 0;
    this.fileDragActive.set(false);
  }

  private describeOpenError(error: unknown): string {
    if (error instanceof SyntaxError) {
      return "The file contains invalid JSON.";
    }

    if (error instanceof DeckValidationError) {
      return `The deck structure is invalid. ${error.message}`;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "The file could not be opened.";
  }

  private fileName(title: string): string {
    const safeTitle = title
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");

    return safeTitle || "presentation";
  }

  private showError(message: string): void {
    this.snackBar.open(message, "Dismiss", {
      duration: 7000,
      horizontalPosition: "end",
      politeness: "assertive",
      verticalPosition: "bottom"
    });
  }

  private showConfirmation(message: string): void {
    this.snackBar.open(message, "Dismiss", {
      duration: 3500,
      horizontalPosition: "end",
      verticalPosition: "bottom"
    });
  }
}
