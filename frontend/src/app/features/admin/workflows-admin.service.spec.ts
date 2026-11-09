import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState, seedSession } from '../../../testing/session';
import { LookupService } from '../../core/lookups/lookup.service';
import { DelegationRule, WorkflowDefinition } from '../../core/models';
import { ApplicationsService } from '../citizen/applications.service';
import { WorkflowsAdminService } from './workflows-admin.service';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('WorkflowsAdminService', () => {
  let service: WorkflowsAdminService;
  const now = new Date(2026, 10, 7);

  beforeEach(() => {
    resetBrowserState();
    seedSession('admin', 'admin');
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
    service = TestBed.inject(WorkflowsAdminService);
  });

  afterEach(() => resetBrowserState());

  it('loads the 12 workflows, their defaults and how many applications run on each version', async () => {
    const d = await firstValueFrom(service.load());
    expect(d.workflows.length).toBe(12);
    expect(d.defaults.length).toBe(12);
    expect(d.usage['P-MSB'][1]).toEqual({ total: 3, inProcess: 1 });
    expect(d.usage['O-MSB'][1]).toEqual({ total: 2, inProcess: 2 });
  });

  it('saves a workflow as a new version; files in process keep their snapshot, new submissions use the new version', async () => {
    const d = await firstValueFrom(service.load());
    const def = clone(d.workflows.find((w) => w.id === 'P-MSB')!);
    def.stages[1].name = 'Regional Review (RFO)';
    const saved = await firstValueFrom(service.save(def, 'admin', now));
    expect(saved.version).toBe(2);
    expect(saved.updated_by).toBe('admin');
    expect(saved.updated_on).toBe('07-Nov-2026');
    const cfg = await firstValueFrom(TestBed.inject(LookupService).workflowConfig());
    expect(cfg.workflows.find((w) => w.id === 'P-MSB')!.version).toBe(2);

    const apps = TestBed.inject(ApplicationsService);
    expect((await firstValueFrom(apps.get(109))).workflow!.version).toBe(1);
    expect((await firstValueFrom(apps.get(109))).workflow!.stages[1].name).toBe('Regional Review');

    seedSession('citizen1', 'citizen');
    const draft = await firstValueFrom(apps.get(104));
    draft.payment.status = 'paid';
    draft.declaration_accepted = true;
    const rules = await firstValueFrom(TestBed.inject(LookupService).config());
    const submitted = await firstValueFrom(apps.submit(draft, rules.delegationRules as DelegationRule[], now));
    expect(submitted.workflow!.version).toBe(2);
    expect(submitted.workflow!.stages[1].name).toBe('Regional Review (RFO)');
  });

  it('refuses an invalid workflow and a change of type / level', async () => {
    const d = await firstValueFrom(service.load());
    const def = clone(d.workflows.find((w) => w.id === 'P-DFO')!) as WorkflowDefinition;
    def.stages[0].tasks[0].role_id = '';
    await expect(firstValueFrom(service.save(def, 'admin', now))).rejects.toThrow('select the role');
    const moved = { ...clone(d.workflows.find((w) => w.id === 'P-DFO')!), level: 'RFO' as const };
    await expect(firstValueFrom(service.save(moved, 'admin', now))).rejects.toThrow('cannot be changed');
  });

  it('validates and saves the SLA configuration', async () => {
    const d = await firstValueFrom(service.load());
    const bad = clone(d.sla);
    bad.workflows['P-MSB'].inspection_days = 90;
    await expect(firstValueFrom(service.saveSla(bad))).rejects.toThrow('cannot exceed the processing SLA');
    const ok = clone(d.sla);
    ok.workflows['P-MSB'].processing_days = 45;
    ok.escalation.notify_approver = false;
    await firstValueFrom(service.saveSla(ok));
    const cfg = await firstValueFrom(TestBed.inject(LookupService).workflowConfig());
    expect(cfg.sla.workflows['P-MSB'].processing_days).toBe(45);
    expect(cfg.sla.escalation.notify_approver).toBe(false);
  });
});
