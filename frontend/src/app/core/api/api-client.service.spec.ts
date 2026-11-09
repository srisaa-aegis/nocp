import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from './api-client.service';
import { ApiEndpoint } from './api-endpoints';

const readOnlyEndpoint: ApiEndpoint = {
  id: 'testReadOnly',
  description: 'test',
  method: 'GET',
  asset: 'assets/data/test/:id.json',
  legacy: 'n/a',
};

const mutableEndpoint: ApiEndpoint = {
  id: 'testMutable',
  description: 'test',
  method: 'GET',
  asset: 'assets/data/test/mutable.json',
  collection: true,
  mutates: true,
  legacy: 'n/a',
};

describe('ApiClient', () => {
  let client: ApiClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    client = TestBed.inject(ApiClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('resolves :param placeholders and performs a plain GET for read-only endpoints', () => {
    let result: { ok: boolean } | undefined;
    client.get<{ ok: boolean }>(readOnlyEndpoint, { id: '42' }).subscribe((r) => (result = r));

    httpMock.expectOne('assets/data/test/42.json').flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('routes mutating endpoints through the mock persistence layer', () => {
    let result: { id: number }[] | undefined;
    client.get<{ id: number }[]>(mutableEndpoint).subscribe((r) => (result = r));

    httpMock.expectOne('assets/data/test/mutable.json').flush([{ id: 1 }]);
    expect(result).toEqual([{ id: 1 }]);

    // Second read should be served from the working copy, no further HTTP call.
    let second: { id: number }[] | undefined;
    client.get<{ id: number }[]>(mutableEndpoint).subscribe((r) => (second = r));
    httpMock.expectNone('assets/data/test/mutable.json');
    expect(second).toEqual([{ id: 1 }]);
  });

  it('upsertInCollection inserts a new item and persists it', () => {
    client.get<{ id: number }[]>(mutableEndpoint).subscribe();
    httpMock.expectOne('assets/data/test/mutable.json').flush([{ id: 1 }]);

    let result: { id: number }[] | undefined;
    client
      .upsertInCollection<{ id: number }>(mutableEndpoint, { id: 2 }, (item) => item.id)
      .subscribe((r) => (result = r));

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('removeFromCollection removes a matching item', () => {
    client.get<{ id: number }[]>(mutableEndpoint).subscribe();
    httpMock.expectOne('assets/data/test/mutable.json').flush([{ id: 1 }, { id: 2 }]);

    let result: { id: number }[] | undefined;
    client
      .removeFromCollection<{ id: number }>(mutableEndpoint, 1, (item) => item.id)
      .subscribe((r) => (result = r));

    expect(result).toEqual([{ id: 2 }]);
  });

  it('getOne finds a single item in a collection by predicate', () => {
    client.get<{ id: number }[]>(mutableEndpoint).subscribe();
    httpMock.expectOne('assets/data/test/mutable.json').flush([{ id: 1 }, { id: 2 }]);

    let result: { id: number } | undefined;
    client.getOne<{ id: number }>(mutableEndpoint, (item) => item.id === 2).subscribe((r) => (result = r));
    expect(result).toEqual({ id: 2 });
  });
});
