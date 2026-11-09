import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiEndpoint } from './api-endpoints';
import { MockPersistenceService } from './mock-persistence.service';

/**
 * The ONLY service in the app that touches `HttpClient`. Feature services
 * call `get`/`mutate` with an `ApiEndpoint` from the central catalog
 * (`api-endpoints.ts`) — never with a literal URL.
 *
 * - Plain reads (`mutates` falsy) always resolve the static JSON fixture.
 * - Reads for endpoints flagged `mutates: true` are served from the mock
 *   persistence layer (localStorage-backed, seeded from the same fixture)
 *   so that writes made earlier in the session are reflected.
 * - Writes always go through `MockPersistenceService`, since there is no
 *   real backend to persist to.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly store = inject(MockPersistenceService);

  /** Resolve `:param` placeholders in an endpoint's asset path. */
  private resolveAsset(endpoint: ApiEndpoint, params?: Record<string, string | number>): string {
    let asset = endpoint.asset;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        asset = asset.replace(`:${key}`, String(value));
      }
    }
    return asset;
  }

  /** GET a collection or single resource. */
  get<T>(endpoint: ApiEndpoint, params?: Record<string, string | number>): Observable<T> {
    const asset = this.resolveAsset(endpoint, params);
    if (endpoint.mutates) {
      return this.store.read<T>(asset);
    }
    return this.http.get<T>(asset);
  }

  /** Read a single item out of a collection asset by a key predicate — used
   *  for fixtures that don't have a per-id file (e.g. the mock-backed
   *  applications list). */
  getOne<T>(
    endpoint: ApiEndpoint,
    predicate: (item: T) => boolean,
    params?: Record<string, string | number>,
  ): Observable<T | undefined> {
    return this.get<T[]>(endpoint, params).pipe(map((list) => list.find(predicate)));
  }

  /** Replace the full collection/resource (used by simple mock mutations). */
  save<T>(endpoint: ApiEndpoint, data: T, params?: Record<string, string | number>): Observable<T> {
    const asset = this.resolveAsset(endpoint, params);
    return this.store.write<T>(asset, data);
  }

  /**
   * Atomic read-modify-write against a mutable resource — the mock
   * equivalent of a server-side transaction (e.g. "submit" touches the
   * application AND stamps a number; "carry forward" updates parent + child).
   */
  update<T>(endpoint: ApiEndpoint, mutator: (current: T) => T, params?: Record<string, string | number>): Observable<T> {
    const asset = this.resolveAsset(endpoint, params);
    return this.store.update<T>(asset, mutator);
  }

  /** Upsert one item into a collection asset, keyed by `keyFn`. */
  upsertInCollection<T>(
    endpoint: ApiEndpoint,
    item: T,
    keyFn: (item: T) => string | number,
    params?: Record<string, string | number>,
  ): Observable<T[]> {
    const asset = this.resolveAsset(endpoint, params);
    return this.store.upsert<T>(asset, item, keyFn);
  }

  /** Remove one item from a collection asset, keyed by `keyFn`. */
  removeFromCollection<T>(
    endpoint: ApiEndpoint,
    key: string | number,
    keyFn: (item: T) => string | number,
    params?: Record<string, string | number>,
  ): Observable<T[]> {
    const asset = this.resolveAsset(endpoint, params);
    return this.store.remove<T>(asset, key, keyFn);
  }
}
