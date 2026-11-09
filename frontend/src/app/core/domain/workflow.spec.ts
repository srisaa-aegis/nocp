import { fixture } from '../../../testing/fixture-backend';
import { Application, DeptRole, FormDef, RenewalRule, SlaConfig, UserAccount, WorkflowDefinition } from '../models';
import {
  WorkflowContext,
  activeStageIndex,
  activeTasks,
  allowedOutcomes,
  archiveRun,
  changeFireStation,
  currentTasks,
  decide,
  decisionInput,
  decisionPreviewApp,
  declarationLevel,
  definitionProblems,
  findDefinition,
  isTaskOverdue,
  monitoredApplications,
  myTasks,
  officersFor,
  pendingWith,
  reassignTask,
  requestDocuments,
  saveTask,
  sendBack,
  sendSms,
  simulate,
  skipTask,
  slaProblems,
  startRun,
  submitTask,
  taskSlaDays,
  updateLicensingAuthority,
  uploadDeptDocument,
  workflowSetProblems,
} from './workflow';

const defs = fixture<WorkflowDefinition[]>('assets/data/config/workflows.json');
const forms = fixture<FormDef[]>('assets/data/config/forms.json');
const sla = fixture<SlaConfig>('assets/data/config/sla.json');
const roles = fixture<DeptRole[]>('assets/data/lookups/dept-roles.json');
const users = fixture<UserAccount[]>('assets/data/auth/users.json');
const renewal = fixture<RenewalRule[]>('assets/data/config/renewal-rules.json');
const apps = fixture<Application[]>('assets/data/applications/applications.json');
const ctx: WorkflowContext = { users, roles };
const byId = (id: number) => structuredClone(apps.find((a) => a.appl_id === id)!);
const d = (s: string) => new Date(s);

/** Draft 104 (Provisional, Head Office, fire station 26 Gudivada — Krishna) submitted on 1 Nov 2026. */
function submittedP(): Application {
  const a = byId(104);
  a.workflow = undefined;
  return startRun(a, findDefinition(defs, 'P', 'MSB')!, ctx, d('2026-11-01'));
}

const task = (a: Application, key: string) => currentTasks(a.workflow!).find((t) => t.task_key === key)!;
const signed = { remark: 'Nil', signed_document: { file_name: 'signed.pdf' } };

describe('workflow configuration', () => {
  it('ships one valid workflow per application type × level (12)', () => {
    expect(defs).toHaveLength(12);
    expect(workflowSetProblems(defs, roles, forms)).toEqual([]);
    expect(slaProblems(sla, defs)).toEqual([]);
  });

  it('follows the confirmed sequences', () => {
    const seq = (id: string) => defs.find((x) => x.id === id)!.stages.map((s) => s.tasks.map((t) => roles.find((r) => r.id === t.role_id)!.code).join('+'));
    expect(seq('P-MSB')).toEqual(['SEC+DFO+SFO', 'RFO', 'ADFS', 'DFSCD', 'DFS', 'DG']);
    expect(seq('O-MSB')).toEqual(['SEC+DFO+SFO', 'RFO', 'ADFS', 'DFSCD', 'DFS', 'DG']);
    expect(seq('R-MSB')).toEqual(['SEC+DFO+SFO', 'RFO', 'ADFS', 'DFSCD', 'DFS']); // renewals decided by the DFS
    expect(seq('P-RFO')).toEqual(['SFO', 'DFO', 'RFO']); // inspection report → DFO note → RFO
    expect(seq('R-DFO')).toEqual(['SFO', 'DFO']);
    expect(seq('D-MSB')).toEqual(['DFO+SFO', 'DFS']);
  });

  it('rejects invalid definitions', () => {
    const base = structuredClone(defs.find((x) => x.id === 'P-RFO')!);
    const noFinal = structuredClone(base);
    noFinal.stages.pop();
    expect(definitionProblems(noFinal, roles, forms).join(' ')).toContain('last stage must have exactly one task using the Final Decision form');
    const badRole = structuredClone(base);
    badRole.stages[0].tasks[0].role_id = '99';
    expect(definitionProblems(badRole, roles, forms)).toContain('Stage 1 (Inspection), task 1 (Inspection Report): select the role that performs the task.');
    const backwards = structuredClone(base);
    backwards.stages[1].citizen_status = 3;
    backwards.stages[0].citizen_status = 4;
    expect(definitionProblems(backwards, roles, forms).join(' ')).toContain('cannot go back');
    const decisionEarly = structuredClone(base);
    decisionEarly.stages[0].tasks[0].form = 'final_decision';
    expect(definitionProblems(decisionEarly, roles, forms).join(' ')).toContain('can only be used in the last stage');
    const noReturn = structuredClone(base);
    noReturn.stages[2].tasks[0].decision!.outcomes = ['approve', 'reject'];
    expect(definitionProblems(noReturn, roles, forms)).toContain('The final decision must allow "return".');
    const inspectless = structuredClone(defs.find((x) => x.id === 'D-DFO')!);
    inspectless.stages[1].tasks[0].decision!.inspect_stage = 'nowhere';
    expect(definitionProblems(inspectless, roles, forms)).toContain('The "inspect" outcome needs the inspection stage it activates.');
    const gap = defs.filter((x) => x.id !== 'O-RFO');
    expect(workflowSetProblems(gap, roles, forms)).toContain('O · RFO: no workflow defined.');
  });

  it('validates the SLA configuration', () => {
    const bad = structuredClone(sla);
    bad.workflows['P-MSB'].inspection_days = 90;
    bad.workflows['P-MSB'].processing_days = 60;
    bad.workflows['P-DFO'].step_days['decision'] = 0;
    bad.escalation.notify_officer = false;
    bad.escalation.notify_approver = false;
    expect(slaProblems(bad, defs)).toEqual([
      'P-MSB: the inspection SLA cannot exceed the processing SLA.',
      'P-DFO: SLA of step "decision" must be 1-365 days.',
      'Escalations must notify the officer, the issuing authority or both.',
    ]);
  });
});

describe('officers associated with the fire station', () => {
  it('picks the active officer of each designation associated with the station', () => {
    expect(officersFor('9', '62', users).map((u) => u.username)).toEqual(['sfo.officer']);
    expect(officersFor('6', '26', users).map((u) => u.username)).toEqual(['dfo.officer']);
    expect(officersFor('7', '111', users).map((u) => u.username)).toEqual(['rfo.southern']);
    expect(officersFor('6', '111', users).map((u) => u.username)).toEqual(['dfo.guntur']); // the retired DFO is inactive
    expect(officersFor('1', '193', users).map((u) => u.username)).toEqual(['dg.officer']); // HQ: all stations
  });

  it('simulates a workflow for a station and warns about missing officers', () => {
    const sim = simulate(defs.find((x) => x.id === 'P-MSB')!, '44', ctx); // Tekkali — no SFO seeded
    expect(sim.find((s) => s.task === 'Inspection Report (Committee Chairman)')?.officers).toEqual(['DFO - Srikakulam']);
    expect(sim.find((s) => s.task === 'Committee Member Concurrence')?.warning).toContain('No active SFO');
  });
});

describe('workflow run', () => {
  it('starts at submission with every task and its officer; stage 1 runs in parallel', () => {
    const a = submittedP();
    const run = a.workflow!;
    expect(run.definition_id).toBe('P-MSB');
    expect(run.tasks).toHaveLength(8);
    expect(activeTasks(run).map((t) => `${t.task_key}:${t.assignee}`)).toEqual(['section:section.hq', 'inspection:dfo.officer', 'committee:sfo.krishna']);
    expect(run.approver).toBe('dg.officer');
    expect(a.status_id).toBe(2);
    expect(a.stage_label).toBe('Submitted');
    expect(pendingWith(run, roles)).toBe('Section Officer (HQ), DFO - Krishna, SFO - Machilipatnam / Gudivada / Avanigadda');
  });

  it('only the assigned officer can save or submit; the stage completes when all its tasks are done', () => {
    let a = submittedP();
    expect(() => submitTask(a, task(a, 'section').task_id, 'dfo.officer', { remark: 'x' }, ctx, d('2026-11-02'))).toThrow('Only the officer');
    a = saveTask(a, task(a, 'section').task_id, 'section.hq', { remark: 'draft' });
    expect(task(a, 'section').draft).toBe(true);
    a = submitTask(a, task(a, 'section').task_id, 'section.hq', { remark: 'Documents verified' }, ctx, d('2026-11-02'));
    a = submitTask(a, task(a, 'inspection').task_id, 'dfo.officer', { remark: 'All OK', recommendation: 'Y' }, ctx, d('2026-11-10'));
    expect(a.status_id).toBe(2); // committee member still pending
    a = submitTask(a, task(a, 'committee').task_id, 'sfo.krishna', { remark: 'Agree' }, ctx, d('2026-11-11'));
    expect(a.status_id).toBe(3);
    expect(a.stage_label).toBe('Inspected');
    expect(activeTasks(a.workflow!).map((t) => t.assignee)).toEqual(['rfo.officer']);
    expect(task(a, 'inspection').recommendation).toBe('Y');
    expect(a.processLog.at(-1)).toEqual(expect.objectContaining({ action: 'Committee Member Concurrence submitted', role: 'SFO', status_id: 3 }));
  });

  function toAdfs(): Application {
    let a = submittedP();
    for (const [k, u] of [['section', 'section.hq'], ['inspection', 'dfo.officer'], ['committee', 'sfo.krishna'], ['rfo', 'rfo.officer']]) {
      a = submitTask(a, task(a, k).task_id, u, { remark: `${k} ok` }, ctx, d('2026-11-12'));
    }
    return a;
  }

  it('sends the file back to the previous stage only, which re-opens with its data', () => {
    let a = toAdfs();
    expect(a.stage_label).toBe('Reviewed by RFO');
    expect(() => sendBack(a, task(a, 'adfs').task_id, 'adfs.officer', ' ', ctx, d('2026-11-13'))).toThrow('comments');
    a = sendBack(a, task(a, 'adfs').task_id, 'adfs.officer', 'Clarify the approach road width', ctx, d('2026-11-13'));
    const rfo = task(a, 'rfo');
    expect(rfo.state).toBe('active');
    expect(rfo.data).toEqual({ remark: 'rfo ok' });
    expect(task(a, 'adfs').state).toBe('sent_back');
    expect(a.status_id).toBe(3);
    expect(a.stage_label).toBe('Inspected');
    expect(a.workflow!.tasks.filter((t) => t.task_key === 'rfo')).toHaveLength(2); // history row kept
    a = submitTask(a, rfo.task_id, 'rfo.officer', { remark: 'Road is 12 m' }, ctx, d('2026-11-14'));
    expect(task(a, 'adfs').state).toBe('active');
    // the inspection stage cannot send back (first stage / not permitted)
    const fresh = submittedP();
    expect(() => sendBack(fresh, task(fresh, 'inspection').task_id, 'dfo.officer', 'x', ctx, d('2026-11-02'))).toThrow('cannot send the file back');
  });

  it('lets the issuing authority bypass and change officers as configured', () => {
    let a = toAdfs();
    expect(() => skipTask(a, task(a, 'adfs').task_id, 'dfs.officer', ctx, d('2026-11-13'))).toThrow('Only the issuing authority');
    a = skipTask(a, task(a, 'adfs').task_id, 'dg.officer', ctx, d('2026-11-13'));
    expect(task(a, 'adfs').state).toBe('skipped');
    expect(a.status_id).toBe(4);
    expect(activeTasks(a.workflow!)[0].task_key).toBe('dfscd');
    expect(() => skipTask(a, task(a, 'decision').task_id, 'dg.officer', ctx, d('2026-11-13'))).toThrow();
    // bypass a future officer in advance: the stage completes as soon as it is reached
    a = skipTask(a, task(a, 'dfs').task_id, 'dg.officer', ctx, d('2026-11-13'));
    a = submitTask(a, task(a, 'dfscd').task_id, 'dfscd.officer', { remark: 'ok' }, ctx, d('2026-11-14'));
    expect(a.status_id).toBe(6);
    expect(activeTasks(a.workflow!)[0].task_key).toBe('decision');

    const b = submittedP();
    const moved = reassignTask(b, task(b, 'inspection').task_id, 'dg.officer', 'dfo.visakhapatnam', ctx, d('2026-11-02'));
    expect(task(moved, 'inspection').assignee).toBe('dfo.visakhapatnam');
    expect(() => reassignTask(b, task(b, 'section').task_id, 'dg.officer', 'section.hq', ctx, d('2026-11-02'))).toThrow('cannot be changed');
    expect(() => reassignTask(b, task(b, 'inspection').task_id, 'dg.officer', 'sfo.officer', ctx, d('2026-11-02'))).toThrow('needs a DFO');
    const admin = reassignTask(b, task(b, 'decision').task_id, 'admin', 'dfs.officer', { ...ctx, users: users.map((u) => (u.username === 'dfs.officer' ? { ...u, deptRoleId: '1' } : u)) }, d('2026-11-02'), true);
    expect(admin.workflow!.approver).toBe('dfs.officer');
  });

  function atDecision(): Application {
    let a = toAdfs();
    for (const [k, u] of [['adfs', 'adfs.officer'], ['dfscd', 'dfscd.officer'], ['dfs', 'dfs.officer']]) {
      a = submitTask(a, task(a, k).task_id, u, { remark: 'ok' }, ctx, d('2026-11-20'));
    }
    return a;
  }

  it('issues the NOC: signed copy and remarks are mandatory; the citizen status becomes Approved', () => {
    const a = atDecision();
    expect(a.status_id).toBe(6);
    const t = task(a, 'decision');
    expect(() => decide(a, t.task_id, 'dg.officer', 'approve', { remark: 'Nil' }, ctx, sla, renewal, d('2026-11-21'))).toThrow('signed NOC');
    expect(() => decide(a, t.task_id, 'dg.officer', 'approve', { remark: ' ', signed_document: { file_name: 's.pdf' } }, ctx, sla, renewal, d('2026-11-21'))).toThrow('remarks');
    const done = decide(a, t.task_id, 'dg.officer', 'approve', signed, ctx, sla, renewal, d('2026-11-21'));
    expect(done.status_id).toBe(7);
    expect(done.final_date).toBe('21-Nov-2026');
    expect(done.workflow!.completed_on).toBe('21-Nov-2026');
    expect(done.valid_to).toBeUndefined(); // Provisional NOCs carry no validity
    expect(done.processLog.at(-1)).toEqual(expect.objectContaining({ action: 'Issued', role: 'DG', remarks: 'Nil', status_id: 7 }));
    expect(activeStageIndex(done.workflow!)).toBe(-1);
  });

  it('forbids "Returned with Remarks" once the processing SLA is crossed (only approve / reject)', () => {
    const a = atDecision();
    const t = task(a, 'decision');
    const withinSla = d('2026-11-25');
    expect(allowedOutcomes(a, sla, withinSla)).toEqual(['approve', 'return', 'reject']);
    const late = d('2027-02-01'); // > 60 days after 1 Nov 2026
    expect(allowedOutcomes(a, sla, late)).toEqual(['approve', 'reject']);
    expect(() => decide(a, t.task_id, 'dg.officer', 'return', signed, ctx, sla, renewal, late)).toThrow('processing SLA of 60 days');
    expect(decide(a, t.task_id, 'dg.officer', 'return', signed, ctx, sla, renewal, withinSla).status_id).toBe(8);
    expect(decide(a, t.task_id, 'dg.officer', 'reject', signed, ctx, sla, renewal, late).status_id).toBe(9);
  });

  it('Declarations: the issuing authority decides at once, or orders an inspection first', () => {
    const decl = byId(107);
    decl.workflow = undefined;
    decl.firestation = '111';
    let a = startRun(decl, findDefinition(defs, 'D', 'DFO')!, ctx, d('2026-11-01'));
    expect(activeTasks(a.workflow!).map((t) => `${t.task_key}:${t.assignee}`)).toEqual(['decision:dfo.guntur']);
    a = decide(a, task(a, 'decision').task_id, 'dfo.guntur', 'inspect', { remark: 'Verify the pumps' }, ctx, sla, renewal, d('2026-11-02'));
    expect(activeTasks(a.workflow!).map((t) => t.task_key)).toEqual(['inspection']);
    expect(task(a, 'decision').state).toBe('waiting');
    a = submitTask(a, task(a, 'inspection').task_id, 'sfo.guntur', { remark: 'Pumps working' }, ctx, d('2026-11-05'));
    expect(activeTasks(a.workflow!).map((t) => t.task_key)).toEqual(['decision']);
    a = decide(a, task(a, 'decision').task_id, 'dfo.guntur', 'approve', signed, ctx, sla, renewal, d('2026-11-06'));
    expect(a.status_id).toBe(7);
    expect(a.valid_from).toBe('06-Nov-2026');
  });

  it('renewals take the validity entered by the issuing authority', () => {
    const ren = byId(114);
    ren.workflow = undefined;
    let a = startRun(ren, findDefinition(defs, 'R', 'DFO')!, ctx, d('2026-11-01'));
    a = submitTask(a, task(a, 'inspection').task_id, 'sfo.krishna', { remark: 'ok' }, ctx, d('2026-11-03'));
    a = decide(a, task(a, 'decision').task_id, 'dfo.officer', 'approve', { ...signed, valid_from: '01-Dec-2026', valid_to: '30-Nov-2029' }, ctx, sla, renewal, d('2026-11-04'));
    expect([a.valid_from, a.valid_to]).toEqual(['01-Dec-2026', '30-Nov-2029']);
  });

  it('archives the run when the citizen revises', () => {
    const a = archiveRun(atDecision());
    expect(a.workflow).toBeUndefined();
    expect(a.workflow_history).toHaveLength(1);
  });

  it('computes task SLAs (inspection vs step) and overdue tasks', () => {
    const a = submittedP();
    const run = a.workflow!;
    expect(taskSlaDays(run, task(a, 'inspection'), sla, forms)).toBe(15);
    expect(taskSlaDays(run, task(a, 'section'), sla, forms)).toBe(5);
    expect(isTaskOverdue(run, task(a, 'section'), sla, forms, d('2026-11-05'))).toBe(false);
    expect(isTaskOverdue(run, task(a, 'section'), sla, forms, d('2026-11-07'))).toBe(true);
  });
});

describe('queues (the new hqlist)', () => {
  it('lists my open tasks and the applications I follow', () => {
    const a = submittedP();
    const list = [a, ...apps.filter((x) => x.appl_id !== 104)];
    expect(myTasks(list, 'section.hq').map((t) => `${t.app.appl_id}:${t.action_label}`)).toContain('104:Submit Note');
    const dfo = users.find((u) => u.username === 'dfo.officer')!;
    expect(monitoredApplications(list, dfo).map((x) => x.appl_id)).toContain(104);
    const sfoVsp = users.find((u) => u.username === 'sfo.officer')!;
    expect(monitoredApplications(list, sfoVsp).map((x) => x.appl_id)).not.toContain(104); // other station
    const viewer = users.find((u) => u.username === 'monitor.hq')!;
    expect(monitoredApplications(list, viewer).length).toBe(list.filter((x) => x.status_id >= 2 && x.workflow).length);
  });

  it('takes the level of a Declaration from the Occupancy NOC being renewed', () => {
    expect(declarationLevel({ parent_id: 0, ref_no: '2019060023', noc_level: undefined }, apps)).toBe('RFO');
    expect(declarationLevel({ parent_id: 0, ref_no: 'PAPER/1', noc_level: 'MSB' }, apps)).toBe('MSB');
    expect(declarationLevel({ parent_id: 0, ref_no: '', noc_level: undefined }, apps)).toBe('DFO');
  });
});

describe('other department actions on a file in process (Phase 3b)', () => {
  it('requests a document from the applicant, uploads a department document and sends an SMS', () => {
    let a = submittedP();
    expect(() => requestDocuments(a, 'rfo.officer', 'Revised plan', ctx, d('2026-11-02'))).toThrow('open task');
    a = requestDocuments(a, 'section.hq', 'Revised undertaking', ctx, d('2026-11-02'));
    expect(a.deptfiles).toHaveLength(1);
    expect(a.deptfiles[0]).toMatchObject({ file_desc: 'Revised undertaking', status: 'R', requested_by: 'Section Officer (HQ)' });
    expect(a.processLog.at(-1)).toEqual(expect.objectContaining({ action: 'Document requested', role: 'SEC' }));

    a = uploadDeptDocument(a, 'dfo.officer', 'inspection.pdf', 'Inspection photographs', ctx, d('2026-11-03'));
    expect(a.dept_documents).toEqual([expect.objectContaining({ file_name: 'inspection.pdf', uploaded_by: 'DFO - Krishna' })]);

    a = sendSms(a, 'dfo.officer', 'Inspection scheduled for tomorrow.', ctx, d('2026-11-03'));
    expect(a.sms).toEqual([expect.objectContaining({ message: 'Inspection scheduled for tomorrow.', sent_by: 'DFO - Krishna' })]);
    expect(() => sendSms(a, 'dfo.officer', '  ', ctx, d('2026-11-03'))).toThrow('Enter the message');
  });

  it('changes the fire station only while Submitted, re-resolving every pending officer', () => {
    let a = submittedP();
    a = changeFireStation(a, 'section.hq', 3, 'Visakhapatnam', '62', ctx, d('2026-11-02'));
    expect(a.dist_name).toBe('Visakhapatnam');
    expect(activeTasks(a.workflow!).map((t) => t.assignee)).toEqual(['section.hq', 'dfo.visakhapatnam', 'sfo.officer']);
    expect(a.workflow!.approver).toBe('dg.officer');
    a = submitTask(a, task(a, 'section').task_id, 'section.hq', { remark: 'ok' }, ctx, d('2026-11-03'));
    expect(() => changeFireStation(a, 'dfo.visakhapatnam', 6, 'Krishna', '26', ctx, d('2026-11-04'))).toThrow('only be changed while the file is Submitted');
  });

  it('updates the licensing authority only once the file reached the final decision', () => {
    let a = submittedP();
    expect(() => updateLicensingAuthority(a, 'section.hq', 'New Authority', 'New Address', ctx, d('2026-11-02'))).toThrow('final decision');
    a = atDecisionHelper();
    a = updateLicensingAuthority(a, 'dg.officer', 'Commissioner, GVMC', 'GVMC Office', ctx, d('2026-11-21'));
    expect(a.lic_auth).toBe('Commissioner, GVMC');
    expect(a.processLog.at(-1)?.action).toBe('Licensing authority updated');
  });

  function atDecisionHelper(): Application {
    let a = submittedP();
    for (const [k, u] of [['section', 'section.hq'], ['inspection', 'dfo.officer'], ['committee', 'sfo.krishna'], ['rfo', 'rfo.officer'], ['adfs', 'adfs.officer'], ['dfscd', 'dfscd.officer'], ['dfs', 'dfs.officer']]) {
      a = submitTask(a, task(a, k).task_id, u, { remark: 'ok' }, ctx, d('2026-11-20'));
    }
    return a;
  }

  it('previews the NOC / letter before the decision is actually submitted, without touching the real run', () => {
    const a = atDecisionHelper();
    const t = task(a, 'decision');
    const preview = decisionPreviewApp(a, 'approve', { remark: 'Nil', addcc: 'Town Planning Officer' }, ctx, renewal, d('2026-11-21'));
    expect(preview.status_id).toBe(7);
    expect(preview.final_date).toBe('21-Nov-2026');
    expect(decisionInput(preview)?.addcc).toBe('Town Planning Officer');
    // the real run is untouched: the task is still active and the application still Pending Final Approval
    expect(a.status_id).toBe(6);
    expect(task(a, 'decision').state).toBe('active');
    // submitting for real still behaves exactly as before
    const done = decide(a, t.task_id, 'dg.officer', 'approve', signed, ctx, sla, renewal, d('2026-11-21'));
    expect(done.status_id).toBe(7);
  });
});
