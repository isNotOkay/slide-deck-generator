import { Injectable } from "@angular/core";

import type { Deck } from "../slides";

const PAGE_WIDTH = 1600;
const PAGE_HEIGHT = 900;

@Injectable({ providedIn: "root" })
export class PdfExportService {
  async download(deck: Deck, slides: readonly HTMLElement[]): Promise<void> {
    if (slides.length === 0) return;

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf")
    ]);
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "pt",
      format: [PAGE_WIDTH, PAGE_HEIGHT],
      compress: true
    });

    for (const [index, slide] of slides.entries()) {
      await this.waitForImages(slide);
      const canvas = await html2canvas(slide, {
        backgroundColor: "#ffffff",
        height: PAGE_HEIGHT,
        logging: false,
        scale: 2,
        useCORS: true,
        width: PAGE_WIDTH
      });

      if (index > 0) {
        pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT], "landscape");
      }

      pdf.addImage(canvas, "PNG", 0, 0, PAGE_WIDTH, PAGE_HEIGHT, undefined, "FAST");
    }

    pdf.save(`${this.fileName(deck.title)}.pdf`);
  }

  private async waitForImages(slide: HTMLElement): Promise<void> {
    const images = [...slide.querySelectorAll<HTMLImageElement>("img")];

    await Promise.all(images.map(async image => {
      if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener(
            "error",
            () => reject(new Error("One or more slide images could not be loaded.")),
            { once: true }
          );
        });
      }

      if (image.naturalWidth === 0) {
        throw new Error("One or more slide images could not be loaded.");
      }

      await image.decode();
    }));
  }

  private fileName(title: string): string {
    const safeTitle = title
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/g, "");

    return safeTitle || "presentation";
  }
}
