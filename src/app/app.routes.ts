import type { Routes } from "@angular/router";

import { Presentation } from "./presentation/presentation";

export const routes: Routes = [
  { path: "", pathMatch: "full", redirectTo: "slides/1" },
  { path: "slides/:slideNumber", component: Presentation },
  { path: "**", redirectTo: "slides/1" }
];
