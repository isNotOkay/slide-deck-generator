import { OverlayContainer } from "@angular/cdk/overlay";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterOutlet } from "@angular/router";

@Component({
  selector: "app-root",
  imports: [RouterOutlet],
  template: "<router-outlet />",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "app-theme" }
})
export class App {
  private readonly overlayContainer = inject(OverlayContainer);

  constructor() {
    this.overlayContainer.getContainerElement().classList.add("app-theme");
  }
}
