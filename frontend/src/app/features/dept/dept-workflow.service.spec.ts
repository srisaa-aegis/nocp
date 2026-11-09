import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { activeTasks } from '../../core/domain/workflow';
import { DeptWorkflowService } from './dept-workflow.service';

describe('DeptWorkflowService (department transactions over the application store)', () => {
  let service: DeptWorkflowService;
  const now = new Date(2026, 10, 7);

  beforeEach(() => {
    resetBrowserState();
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
    service = TestBed.inject(DeptWorkflowService);
  });

  afterEach(() => resetBrowserState());

  it('never exposes citizens’ drafts to the department', async () => {
    const apps = await firstValueFrom(service.applications());
    expect(apps.length).toBe(11);
    expect(apps.some((a) => a.status_id === 1)).toBe(false);
    await expect(firstValueFrom(service.application(104))).rejects.toThrow('not found');
  });

  it('derives the queues of an officer from the workflow runs', async () => {
    const q = await firstValueFrom(service.queues('dfs.officer'));
    expect(q.me?.deptRoleId).toBe('2');
    expect(q.tasks.map((t) => `${t.app.appl_id}:${t.task.name}:${t.action_label}`)).toEqual(['106:Final Decision:Issue/Reject', '110:DFS Note:Review']);
    expect(q.monitored.map((a) => a.appl_id).sort()).toEqual([101, 102, 103, 106, 109, 110]);
  });

  it('saves and submits a task; only the assignee may act; the next stage opens for the issuing authority', async () => {
    const app = await firstValueFrom(service.application(110));
    const task = activeTasks(app.workflow!)[0];
    await expect(firstValueFrom(service.submitTask(110, task.task_id, 'dg.officer', { remark: 'x' }, now))).rejects.toThrow('Only the officer');
    const draft = await firstValueFrom(service.saveTask(110, task.task_id, 'dfs.officer', { remark: 'draft' }));
    expect(draft.workflow!.tasks.find((t) => t.task_id === task.task_id)!.draft).toBe(true);
    const after = await firstValueFrom(service.submitTask(110, task.task_id, 'dfs.officer', { remark: 'Recommended for approval.', recommendation: 'Y' }, now));
    expect(after.status_id).toBe(6);
    expect(activeTasks(after.workflow!).map((t) => t.assignee)).toEqual(['dg.officer']);
    expect(after.reviewer).toBe('Director General (HQ)');
    expect((await firstValueFrom(service.queues('dg.officer'))).tasks.map((t) => t.app.appl_id)).toEqual([110]);
  });

  it('sends back to the previous stage, bypasses and reassigns (issuing authority)', async () => {
    const app = await firstValueFrom(service.application(110));
    const dfs = activeTasks(app.workflow!)[0];
    const back = await firstValueFrom(service.sendBack(110, dfs.task_id, 'dfs.officer', 'Please verify the refuge areas.', now));
    expect(back.status_id).toBe(4);
    expect(activeTasks(back.workflow!).map((t) => t.assignee)).toEqual(['dfscd.officer']);

    const dfscd = activeTasks(back.workflow!)[0];
    await expect(firstValueFrom(service.skipTask(110, dfscd.task_id, 'dfs.officer', now))).rejects.toThrow('Only the issuing authority');
    const skipped = await firstValueFrom(service.skipTask(110, dfscd.task_id, 'dg.officer', now));
    expect(skipped.status_id).toBe(5);
    expect(activeTasks(skipped.workflow!)[0].assignee).toBe('dfs.officer');
  });

  it('the final decision needs the signed copy; after the processing SLA only approve / reject', async () => {
    const app = await firstValueFrom(service.application(106));
    const t = activeTasks(app.workflow!)[0];
    await expect(firstValueFrom(service.decide(106, t.task_id, 'dfs.officer', 'return', { remark: 'Fix.', signed_document: { file_name: 's.pdf' } }, now))).rejects.toThrow('processing SLA');
    await expect(firstValueFrom(service.decide(106, t.task_id, 'dfs.officer', 'approve', { remark: 'OK' }, now))).rejects.toThrow('signed');
    const done = await firstValueFrom(service.decide(106, t.task_id, 'dfs.officer', 'approve', { remark: 'Renewal approved.', signed_document: { file_name: 'signed.pdf' }, valid_from: '07-Nov-2026', valid_to: '06-Nov-2029' }, now));
    expect(done.status_id).toBe(7);
    expect(done.valid_to).toBe('06-Nov-2029');
    expect(done.workflow!.completed_on).toBe('07-Nov-2026');
  });

  it('requests documents, uploads department documents and sends SMS', async () => {
    const requested = await firstValueFrom(service.requestDocuments(110, 'dfs.officer', 'Revised NBC compliance report', now));
    expect(requested.deptfiles.at(-1)).toMatchObject({ file_desc: 'Revised NBC compliance report', status: 'R' });
    const uploaded = await firstValueFrom(service.uploadDocument(110, 'dfs.officer', 'photo.pdf', 'Site photos', now));
    expect(uploaded.dept_documents).toEqual([expect.objectContaining({ file_name: 'photo.pdf' })]);
    const smsed = await firstValueFrom(service.sendSms(110, 'dfs.officer', 'Please visit the site tomorrow.', now));
    expect(smsed.sms).toEqual([expect.objectContaining({ message: 'Please visit the site tomorrow.' })]);
  });

  it('changes the fire station (Submitted only) and updates the licensing authority (final stage only)', async () => {
    const app102 = await firstValueFrom(service.application(102));
    const active = activeTasks(app102.workflow!)[0];
    await expect(firstValueFrom(service.changeFireStation(102, active.assignee!, 6, 'Krishna', '26', now))).rejects.toThrow('Submitted');

    await expect(firstValueFrom(service.updateLicensingAuthority(110, 'dfs.officer', 'New Authority', 'New Address', now))).rejects.toThrow('final decision');
    const updated = await firstValueFrom(service.updateLicensingAuthority(106, 'dfs.officer', 'New Authority', 'New Address', now));
    expect(updated.lic_auth).toBe('New Authority');
  });

  it('resolves the parent application for the certificate preview (and null when there is none)', async () => {
    const app = await firstValueFrom(service.application(105));
    expect(app.parent_id).toBe(0);
    expect(await firstValueFrom(service.parentOf(app))).toBeNull();
    const renewal = await firstValueFrom(service.application(114));
    const parent = await firstValueFrom(service.parentOf(renewal));
    expect(parent?.appl_id).toBe(renewal.parent_id);
  });
});
