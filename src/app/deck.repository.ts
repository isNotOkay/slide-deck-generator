import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { catchError, map, Observable, throwError } from "rxjs";

import { parseDeck, type Deck } from "../slides";

@Injectable({ providedIn: "root" })
export class DeckRepository {
  private readonly http = inject(HttpClient);

  load(): Observable<Deck> {
    return this.http.get<unknown>("/api/deck").pipe(
      map(value => parseDeck(value)),
      catchError(error => throwError(() => this.describeError(error)))
    );
  }

  save(deck: Deck): Observable<Deck> {
    return this.http.put<unknown>("/api/deck", deck).pipe(
      map(value => parseDeck(value)),
      catchError(error => throwError(() => this.describeError(error)))
    );
  }

  private describeError(error: unknown): Error {
    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error as { error?: unknown } | null;
      if (apiMessage && typeof apiMessage.error === "string") {
        return new Error(apiMessage.error);
      }

      if (error.status === 0) {
        return new Error("The presentation API is unavailable.");
      }

      return new Error(`The presentation request failed (${error.status}).`);
    }

    return new Error("The presentation request failed.");
  }
}
