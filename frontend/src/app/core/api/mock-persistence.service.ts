import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';

const STORAGE_PREFIX = 'noc.mock.';

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/**
 * Simulates a writable backend on top of static JSON fixtures.
 *
 * Since this app has "no real persistence" by design, every asset flagged
 * `mutates: true` in the API catalog is lazily copied from its JSON seed
 * into `localStorage` the first time it is read. All subsequent
 * reads/writes for that asset operate on the localStorage copy, so changes
 * made in a session (new applications, status transitions, account changes…)
 * are visible across the app and survive a page reload, without a server.
 *
 * Reads always return a deep copy, exactly like deserialising an HTTP
 * response would, so callers can never mutate the "server" state by accident.
 *
 * `resetAll()` clears every mock key, restoring the original seed data —
 * this backs the Admin "Reset demo data" utility.
 */
@Injectable({ providedIn: 'root' })
export class MockPersistenceService {
  private readonly http = inject(HttpClient);
  private readonly memoryCache = new Map<string, unknown>();
  private readonly inFlight = new Map<string, Observable<unknown>>();

  private storageKey(asset: string): string {
    return STORAGE_PREFIX + asset;
  }

  private readFromStorage<T>(asset: string): T | undefined {
    if (this.memoryCache.has(asset)) {
      return this.memoryCache.get(asset) as T;
    }
    try {
      const raw = localStorage.getItem(this.storageKey(asset));
      if (raw != null) {
        const parsed = JSON.parse(raw) as T;
        this.memoryCache.set(asset, parsed);
        return parsed;
      }
    } catch {
      // localStorage unavailable (SSR/private mode) — fall through to seed.
    }
    return undefined;
  }

  private writeToStorage<T>(asset: string, data: T): void {
    const stored = clone(data);
    this.memoryCache.set(asset, stored);
    try {
      localStorage.setItem(this.storageKey(asset), JSON.stringify(stored));
    } catch {
      // best-effort only
    }
  }

  /** Fetches the seed once even if several callers ask for it concurrently. */
  private seedFrom(asset: string): Observable<unknown> {
    const pending = this.inFlight.get(asset);
    if (pending) {
      return pending;
    }
    const request$ = this.http.get(asset).pipe(
      tap((seed) => this.writeToStorage(asset, seed)),
      finalize(() => this.inFlight.delete(asset)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inFlight.set(asset, request$);
    return request$;
  }

  /** Read the working copy for an asset, seeding from the JSON file on first use. */
  read<T>(asset: string): Observable<T> {
    const cached = this.readFromStorage<T>(asset);
    if (cached !== undefined) {
      return of(clone(cached));
    }
    return this.seedFrom(asset).pipe(map(() => clone(this.readFromStorage<T>(asset) as T)));
  }

  /** Replace the working copy outright. */
  write<T>(asset: string, data: T): Observable<T> {
    this.writeToStorage(asset, data);
    return of(clone(data));
  }

  /** Read-modify-write helper: applies `mutator` to the current working copy and persists the result. */
  update<T>(asset: string, mutator: (current: T) => T): Observable<T> {
    return this.read<T>(asset).pipe(
      switchMap((current) => {
        const next = mutator(current);
        this.writeToStorage(asset, next);
        return of(clone(next));
      }),
    );
  }

  /** Insert or update one item of a collection, keyed by `keyFn`. */
  upsert<T>(asset: string, item: T, keyFn: (item: T) => string | number): Observable<T[]> {
    return this.update<T[]>(asset, (list) => {
      const key = keyFn(item);
      const idx = list.findIndex((existing) => keyFn(existing) === key);
      return idx >= 0 ? [...list.slice(0, idx), item, ...list.slice(idx + 1)] : [...list, item];
    });
  }

  /** Remove one item of a collection, keyed by `keyFn`. */
  remove<T>(asset: string, key: string | number, keyFn: (item: T) => string | number): Observable<T[]> {
    return this.update<T[]>(asset, (list) => list.filter((existing) => keyFn(existing) !== key));
  }

  /** Clears all mock working copies so the app reverts to its JSON seed data. */
  resetAll(): void {
    this.memoryCache.clear();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}
