/**
 * Test-only mock HTTP backend that serves the REAL JSON fixtures from
 * public/assets/data/** (imported at build time), so integration-style
 * component tests exercise the actual seed data and catch fixture/model drift.
 *
 *   TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
 */
import { HttpErrorResponse, HttpInterceptorFn, HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders } from '@angular/core';
import { of, throwError } from 'rxjs';
import { FIXTURES } from './fixture-index';

export { FIXTURES };

export function fixture<T>(asset: string): T {
  const data = FIXTURES[asset];
  if (data === undefined) {
    throw new Error(`No fixture for ${asset}`);
  }
  return JSON.parse(JSON.stringify(data)) as T;
}

/** Records every URL requested through the fixture backend (for assertions). */
export const requestedUrls: string[] = [];

export function fixtureInterceptor(overrides: Record<string, unknown> = {}): HttpInterceptorFn {
  return (req) => {
    requestedUrls.push(req.url);
    const body = req.url in overrides ? overrides[req.url] : FIXTURES[req.url];
    if (body === undefined) {
      return throwError(() => new HttpErrorResponse({ status: 404, statusText: 'Not Found', url: req.url }));
    }
    return of(new HttpResponse({ status: 200, url: req.url, body: JSON.parse(JSON.stringify(body)) }));
  };
}

export function provideFixtureBackend(overrides: Record<string, unknown> = {}): EnvironmentProviders {
  return provideHttpClient(withInterceptors([fixtureInterceptor(overrides)]));
}
