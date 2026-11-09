import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { AdminService } from './admin.service';

describe('AdminService', () => {
  let service: AdminService;
  const now = new Date(2026, 10, 7);

  beforeEach(() => {
    resetBrowserState();
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
    service = TestBed.inject(AdminService);
  });

  afterEach(() => resetBrowserState());

  it('searches across all applications including drafts', async () => {
    const all = await firstValueFrom(service.search({}, now));
    expect(all.length).toBe(14);
    expect(all.some((r) => r.status_id === 1)).toBe(true);
  });

  it('filters by text (incl. owner username), type, status, drafts-only and idle days', async () => {
    expect((await firstValueFrom(service.search({ text: 'citizen3' }, now))).map((r) => r.appl_id).sort()).toEqual([110, 113]);
    expect((await firstValueFrom(service.search({ type: 'D' }, now))).map((r) => r.appl_id)).toEqual([107]);
    expect((await firstValueFrom(service.search({ statusId: 9 }, now))).map((r) => r.appl_id)).toEqual([103]);
    const stale = await firstValueFrom(service.search({ draftsOnly: true, staleDays: 180 }, now));
    expect(stale.map((r) => r.appl_id).sort()).toEqual([104, 112, 113]);
    expect(stale[0].days_idle).toBeGreaterThanOrEqual(stale[1].days_idle!); // most idle first
  });

  it('deletes applications and unlinks the parent of a deleted child', async () => {
    const removed = await firstValueFrom(service.deleteApplications([102, 112]));
    expect(removed).toBe(2);
    const all = await firstValueFrom(service.search({}, now));
    expect(all.some((r) => r.appl_id === 102 || r.appl_id === 112)).toBe(false);
    expect(all.find((r) => r.appl_id === 101)?.child_id).toBe(0);
  });

  it('escalates the tasks past their step / inspection SLA and the files past the processing SLA', async () => {
    const preview = await firstValueFrom(service.escalationPreview(now));
    // 110 (applied Oct 2026, DFS note since 04-Nov-2026) is within every SLA on 07-Nov-2026
    expect([...new Set(preview.overdue.map((n) => n.appl_id))].sort()).toEqual([102, 106, 108, 109]);
    const insp = preview.overdue.find((n) => n.appl_id === 102 && n.kind === 'inspection')!;
    expect(insp.officers.sort()).toEqual(['dfo.visakhapatnam']);
    expect(insp.recipients.sort()).toEqual(['dfo.visakhapatnam', 'dg.officer']);
    expect(preview.overdue.some((n) => n.appl_id === 106 && n.kind === 'processing')).toBe(true);

    const entry = await firstValueFrom(service.sendEscalations(now));
    expect(entry.applications).toBe(4);
    expect(entry.notices.length).toBe(preview.due.length);
    expect(entry.recipients).toBeGreaterThan(0);
    // reminded again only after the reminder interval (7 days)
    expect((await firstValueFrom(service.escalationPreview(now))).due.length).toBe(0);
    const later = await firstValueFrom(service.escalationPreview(new Date(2026, 10, 15)));
    expect(later.due.length).toBe(entry.notices.length + 1); // + the DFS note of 110, now past its 5 days
  });

  it('lists and moves the pending tasks of an officer (admin reassignment)', async () => {
    expect((await firstValueFrom(service.openTasksOf('dfo.visakhapatnam'))).map((t) => `${t.appl_id}:${t.task.name}`)).toEqual(['102:Inspection Report (Committee Chairman)']);
    await expect(firstValueFrom(service.reassignOpenTasks('dfo.visakhapatnam', 'rfo.officer', now))).rejects.toThrow('DFO');
    const moved = await firstValueFrom(service.reassignOpenTasks('dfo.visakhapatnam', 'dfo.officer', now));
    expect(moved).toBe(1);
    expect((await firstValueFrom(service.openTasksOf('dfo.officer'))).some((t) => t.appl_id === 102)).toBe(true);
  });

  it('resetDemoData restores the seed data', async () => {
    await firstValueFrom(service.deleteApplications([101]));
    service.resetDemoData();
    expect((await firstValueFrom(service.search({}, now))).some((r) => r.appl_id === 101)).toBe(true);
  });
});
