import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { fixture, provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { Application, DelegationRule, PartyRole, UserAccount } from '../../core/models';
import { applicationListFilter, ApplicationsService } from './applications.service';

const roles = fixture<PartyRole[]>('assets/data/lookups/party-roles.json');
const delegation = fixture<DelegationRule[]>('assets/data/config/delegation-rules.json');
const citizen1 = fixture<UserAccount[]>('assets/data/auth/users.json')[0];

describe('ApplicationsService (citizen lifecycle over the unified store)', () => {
  let service: ApplicationsService;

  beforeEach(() => {
    resetBrowserState();
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
    service = TestBed.inject(ApplicationsService);
  });

  afterEach(() => resetBrowserState());

  const get = (id: number) => firstValueFrom(service.get(id));

  it('lists only the citizen’s own applications, newest first', async () => {
    const mine = await firstValueFrom(service.listMine('citizen1'));
    expect(mine.every((a) => a.owner === 'citizen1')).toBe(true);
    expect(mine.map((a) => a.appl_id)).toEqual([...mine.map((a) => a.appl_id)].sort((a, b) => b - a));
    expect(mine.some((a) => a.appl_id === 109)).toBe(false); // citizen2's application
  });

  it('refuses to return another citizen’s application', async () => {
    await expect(firstValueFrom(service.get(109, 'citizen1'))).rejects.toThrow('not found');
  });

  it('creates a draft with the next id', async () => {
    const draft = await firstValueFrom(service.createDraft('P', citizen1, roles));
    expect(draft.appl_id).toBe(115);
    expect((await get(115)).status_id).toBe(1);
  });

  it('stores a new application on its first save only when the site name and address are given', async () => {
    const draft = await get(104);
    const fresh = { ...draft, appl_id: 0, site_name: '', site_addr: '' };
    await expect(firstValueFrom(service.createFromDraft(fresh))).rejects.toThrow('Site Name and Site Address');
    const created = await firstValueFrom(service.createFromDraft({ ...fresh, site_name: 'New Site', site_addr: 'Somewhere' }));
    expect(created.appl_id).toBe(115);
    expect(created.status_id).toBe(1);
    const blank = await get(104);
    blank.site_addr = ' ';
    await expect(firstValueFrom(service.save(blank))).rejects.toThrow('Site Name and Site Address');
  });

  it('records the citizen rating of a completed application (stars + description)', async () => {
    await expect(firstValueFrom(service.saveFeedback(111, 'citizen1', 0, 'x'))).rejects.toThrow('rating');
    await expect(firstValueFrom(service.saveFeedback(111, 'citizen1', 4, '  '))).rejects.toThrow('description');
    await expect(firstValueFrom(service.saveFeedback(105, 'citizen1', 4, 'ok'))).rejects.toThrow('completed');
    const rated = await firstValueFrom(service.saveFeedback(111, 'citizen1', 5, ' Very smooth ', new Date(2026, 10, 7)));
    expect(rated.feedback).toEqual({ rating: 5, remarks: 'Very smooth', rated_on: '07-Nov-2026' });
    expect((await get(111)).feedback?.rating).toBe(5);
  });

  it('carries a Provisional forward and links parent and child', async () => {
    // 101 already has a child, so free it first by deleting draft-like child link in a fresh scenario:
    await expect(firstValueFrom(service.createOccupancyFromProvisional(101, 'citizen1'))).rejects.toThrow('only be made');
    await expect(firstValueFrom(service.createRenewalFromOccupancy(111, 'citizen1'))).rejects.toThrow('only be made'); // renewed by 114
    const renewal = await firstValueFrom(service.createRenewalFromOccupancy(114, 'citizen1'));
    expect(renewal.parent_id).toBe(114);
    expect(renewal.ref_no).toBe('2019060023');
    expect((await get(114)).child_id).toBe(renewal.appl_id);
  });

  it('saves drafts but refuses to edit submitted applications', async () => {
    const draft = await get(104);
    draft.site_name = 'Renamed Site';
    await firstValueFrom(service.save(draft));
    expect((await get(104)).site_name).toBe('Renamed Site');

    const submitted = await get(102);
    await expect(firstValueFrom(service.save(submitted))).rejects.toThrow('Only draft');
  });

  it('submits: assigns a number and level, starts the workflow with the officers of the fire station, logs it', async () => {
    const draft = await get(104);
    draft.payment.status = 'paid';
    draft.declaration_accepted = true;
    const now = new Date(2026, 10, 7);
    const submitted = await firstValueFrom(service.submit(draft, delegation, now));
    expect(submitted.status_id).toBe(2);
    expect(submitted.appl_number).toBe('2026110001');
    expect(submitted.applied_date).toBe('07-Nov-2026');
    expect(submitted.delegation_level).toBe('MSB'); // 16 m business block (≥ 15 m)
    // P · MSB: Section ∥ Inspection (DFO, chairman) ∥ committee member (SFO) of fire station 26 (Krishna)
    expect(submitted.workflow?.definition_id).toBe('P-MSB');
    expect(submitted.workflow?.version).toBe(1);
    const active = submitted.workflow!.tasks.filter((t) => t.state === 'active');
    expect(active.map((t) => t.assignee)).toEqual(['section.hq', 'dfo.officer', 'sfo.krishna']);
    expect(active.every((t) => t.start_date === '07-Nov-2026')).toBe(true);
    expect(submitted.workflow?.approver).toBe('dg.officer');
    expect(submitted.reviewer).toBe('Section Officer (HQ), DFO - Krishna, SFO - Machilipatnam / Gudivada / Avanigadda');
    expect(submitted.stage_label).toBe('Submitted');
    expect(submitted.processLog.at(-1)?.action).toBe('Submitted');
  });

  it('will not submit an unpaid application', async () => {
    const draft = await get(104);
    draft.declaration_accepted = true;
    await expect(firstValueFrom(service.submit(draft, delegation))).rejects.toThrow('fee');
  });

  it('revises a returned application into a new draft revision, keeping its number and history', async () => {
    const before = await get(105);
    const revised = await firstValueFrom(service.revise(105, 'citizen1'));
    expect(revised.status_id).toBe(1);
    expect(revised.revision).toBe(before.revision + 1);
    expect(revised.appl_number).toBe(before.appl_number);
    expect(revised.processLog.length).toBe(before.processLog.length + 1);
    await expect(firstValueFrom(service.revise(101, 'citizen1'))).rejects.toThrow('returned or rejected');
  });

  it('resubmission of a revision keeps the application number and starts a new workflow run', async () => {
    const before105Revision = (await get(105)).revision;
    const revised = await firstValueFrom(service.revise(105, 'citizen1'));
    revised.declaration_accepted = true;
    const resubmitted = await firstValueFrom(service.submit(revised, delegation));
    expect(resubmitted.appl_number).toBe('2018020044');
    expect(resubmitted.processLog.at(-1)?.action).toBe('Resubmitted');
    // the returned run is archived; the new revision starts a new run of the current workflow
    expect(resubmitted.workflow_history?.map((r) => r.revision)).toEqual([before105Revision]);
    expect(resubmitted.workflow?.revision).toBe(revised.revision);
    expect(resubmitted.workflow?.tasks.find((t) => t.state === 'active')?.assignee).toBe('sfo.krishna');
  });

  it('deletes a carried-forward draft and frees the parent for a new carry-forward', async () => {
    const renewal = await firstValueFrom(service.createRenewalFromOccupancy(114, 'citizen1'));
    const remaining = await firstValueFrom(service.deleteDraft(renewal.appl_id, 'citizen1'));
    expect(remaining.some((a) => a.appl_id === renewal.appl_id)).toBe(false);
    expect((await get(114)).child_id).toBe(0);
  });

  it('refuses to delete non-drafts', async () => {
    await expect(firstValueFrom(service.deleteDraft(101, 'citizen1'))).rejects.toThrow('draft');
  });

  it('uploads a department-requested document and logs it', async () => {
    const updated: Application = await firstValueFrom(
      service.uploadRequestedDocument(102, 'citizen1', 1, { name: 'completion.pdf', size: 1234 }, 'Attached'),
    );
    expect(updated.deptfiles[0].status).toBe('U');
    expect(updated.deptfiles[0].citizen_comment).toBe('Attached');
    expect(updated.documents.at(-1)?.code).toBe('Requested:CompletionCertificate');
    expect(updated.processLog.at(-1)?.action).toBe('Requested document uploaded');
  });

  it('summarize counts documents requests as needing attention', async () => {
    const mine = await firstValueFrom(service.listMine('citizen1'));
    const s = service.summarize(mine);
    expect(s.total).toBe(mine.length);
    expect(s.needsAttention).toBeGreaterThanOrEqual(3); // 103 rejected, 105 returned (+request), 102 request
  });
});

describe('applicationListFilter', () => {
  it('filters by type, status and text', async () => {
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
    const list = await firstValueFrom(TestBed.inject(ApplicationsService).listMine('citizen1'));
    expect(applicationListFilter(list, { type: 'D' }).map((a) => a.appl_id)).toEqual([107]);
    expect(applicationListFilter(list, { statusId: 9 }).map((a) => a.appl_id)).toEqual([103]);
    expect(applicationListFilter(list, { text: 'lotus' }).map((a) => a.appl_id)).toEqual([106]);
    resetBrowserState();
  });
});
