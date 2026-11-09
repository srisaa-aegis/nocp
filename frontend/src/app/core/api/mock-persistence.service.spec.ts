import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MockPersistenceService } from './mock-persistence.service';

describe('MockPersistenceService', () => {
  let service: MockPersistenceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(MockPersistenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('seeds from the JSON asset on first read', () => {
    let result: { id: number }[] | undefined;
    service.read<{ id: number }[]>('assets/data/demo.json').subscribe((data) => (result = data));

    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1 }]);

    expect(result).toEqual([{ id: 1 }]);
  });

  it('serves subsequent reads from the local working copy without another HTTP call', () => {
    service.read<{ id: number }[]>('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1 }]);

    let second: { id: number }[] | undefined;
    service.read<{ id: number }[]>('assets/data/demo.json').subscribe((data) => (second = data));

    httpMock.expectNone('assets/data/demo.json');
    expect(second).toEqual([{ id: 1 }]);
  });

  it('upserts an item into a collection and persists it to localStorage', () => {
    service.read<{ id: number }[]>('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1 }]);

    let upserted: { id: number }[] | undefined;
    service.upsert<{ id: number }>('assets/data/demo.json', { id: 2 }, (item) => item.id).subscribe((data) => (upserted = data));
    expect(upserted).toEqual([{ id: 1 }, { id: 2 }]);

    const raw = localStorage.getItem('noc.mock.assets/data/demo.json');
    expect(JSON.parse(raw ?? '[]')).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('updates an existing item in place when upserting with a matching key', () => {
    service.read<{ id: number; label: string }[]>('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1, label: 'old' }]);

    let result: { id: number; label: string }[] | undefined;
    service
      .upsert<{ id: number; label: string }>('assets/data/demo.json', { id: 1, label: 'new' }, (item) => item.id)
      .subscribe((data) => (result = data));

    expect(result).toEqual([{ id: 1, label: 'new' }]);
  });

  it('removes an item from a collection', () => {
    service.read<{ id: number }[]>('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1 }, { id: 2 }]);

    let result: { id: number }[] | undefined;
    service.remove<{ id: number }>('assets/data/demo.json', 1, (item) => item.id).subscribe((data) => (result = data));
    expect(result).toEqual([{ id: 2 }]);
  });

  it('resetAll() clears the working copy so the next read re-seeds from the asset', () => {
    service.read<{ id: number }[]>('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1 }]);

    service.resetAll();

    service.read<{ id: number }[]>('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1 }]);
  });
});

describe('MockPersistenceService (concurrency & isolation)', () => {
  let service: MockPersistenceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(MockPersistenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('issues only one seed request when several callers read concurrently', () => {
    const results: unknown[] = [];
    service.read('assets/data/demo.json').subscribe((d) => results.push(d));
    service.read('assets/data/demo.json').subscribe((d) => results.push(d));
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1 }]);
    expect(results).toEqual([[{ id: 1 }], [{ id: 1 }]]);
  });

  it('returns defensive copies so callers cannot mutate the stored state', () => {
    let first: { id: number; name: string }[] = [];
    service.read<{ id: number; name: string }[]>('assets/data/demo.json').subscribe((d) => (first = d));
    httpMock.expectOne('assets/data/demo.json').flush([{ id: 1, name: 'original' }]);
    first[0].name = 'mutated by caller';

    let second: { id: number; name: string }[] = [];
    service.read<{ id: number; name: string }[]>('assets/data/demo.json').subscribe((d) => (second = d));
    expect(second[0].name).toBe('original');
  });

  it('update() applies a read-modify-write transaction and persists it', () => {
    service.read('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush({ count: 1 });

    let result: { count: number } | undefined;
    service.update<{ count: number }>('assets/data/demo.json', (c) => ({ count: c.count + 1 })).subscribe((r) => (result = r));
    expect(result).toEqual({ count: 2 });
    expect(JSON.parse(localStorage.getItem('noc.mock.assets/data/demo.json') ?? '{}')).toEqual({ count: 2 });
  });

  it('update() surfaces errors thrown by the mutator and does not persist', () => {
    service.read('assets/data/demo.json').subscribe();
    httpMock.expectOne('assets/data/demo.json').flush({ count: 1 });

    let error: Error | undefined;
    service
      .update<{ count: number }>('assets/data/demo.json', () => {
        throw new Error('Validation failed');
      })
      .subscribe({ error: (e) => (error = e) });
    expect(error?.message).toBe('Validation failed');
    expect(JSON.parse(localStorage.getItem('noc.mock.assets/data/demo.json') ?? '{}')).toEqual({ count: 1 });
  });
});
