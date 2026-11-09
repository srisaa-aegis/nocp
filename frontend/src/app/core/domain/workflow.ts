/**
 * Department workflow engine (Phase 3) — pure functions over the application aggregate.
 *
 * The administrator configures ONE workflow per application type × approval level
 * (config/workflows.json): ordered stages whose tasks run in parallel, the last stage being the
 * final decision of the issuing authority. On submission the definition is snapshotted into the
 * application (`WorkflowRun`), so later edits of the configuration never disturb files in process.
 *
 * Officers: the officers of a run are the officers of each designation associated with the fire
 * station under which the property comes (users.json `stations` / `all_stations`).
 *
 * Legacy mapping (modules/dept): process_steps.aspx → run.tasks; process_move.aspx → saveTask /
 * submitTask / decide; sendback.aspx → sendBack (previous stage only); reassign.aspx → reassignTask
 * ("C"); bypass → skipTask ("X"); RoleStatuses.txt → myTasks / monitoring (derived).
 */
import {
  Application,
  DelegationLevel,
  DeptRole,
  FormDef,
  RenewalRule,
  RequestedDocument,
  SlaConfig,
  UserAccount,
  WorkflowDefinition,
  WorkflowOutcome,
  WorkflowRun,
  WorkflowStageDef,
  WorkflowTask,
  WorkflowTaskDef,
} from '../models';
import { certificateValidity, nextId, renewalPeriodYears } from './application-rules';
import { processStep } from './application-factory';
import { daysSince, formatLegacyDate, parseLegacyDate } from './dates';

export interface WorkflowContext {
  users: UserAccount[];
  roles: DeptRole[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const TYPES = ['P', 'O', 'R', 'D'] as const;
const LEVELS: DelegationLevel[] = ['MSB', 'RFO', 'DFO'];

function fail(message: string): never {
  throw new Error(message);
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export function workflowId(applType: string, level: DelegationLevel): string {
  return `${applType === 'RO' ? 'R' : applType}-${level}`;
}

export function findDefinition(defs: WorkflowDefinition[], applType: string, level: DelegationLevel): WorkflowDefinition | undefined {
  return defs.find((d) => d.id === workflowId(applType, level));
}

export function taskDefOf(stages: WorkflowStageDef[], stageKey: string, taskKey: string): WorkflowTaskDef | undefined {
  return stages.find((s) => s.key === stageKey)?.tasks.find((t) => t.key === taskKey);
}

function finalStageIndex(stages: WorkflowStageDef[]): number {
  return stages.length - 1;
}

/** Checks one definition (admin save). Returns the problems (empty = valid). */
export function definitionProblems(def: WorkflowDefinition, roles: DeptRole[], forms: FormDef[]): string[] {
  const out: string[] = [];
  const formIds = new Set(forms.map((f) => f.id));
  const decisionForms = new Set(forms.filter((f) => f.decision).map((f) => f.id));
  const roleIds = new Set(roles.map((r) => r.id));
  if (!def.name?.trim()) out.push('Enter a name for the workflow.');
  if (!def.stages.length) {
    out.push('Add at least one stage.');
    return out;
  }
  const stageKeys = new Set<string>();
  const last = def.stages[def.stages.length - 1];
  def.stages.forEach((s, si) => {
    const sn = `Stage ${si + 1}${s.name ? ` (${s.name})` : ''}`;
    if (!s.key?.trim()) out.push(`${sn}: a key is required.`);
    else if (stageKeys.has(s.key)) out.push(`${sn}: the key "${s.key}" is used twice.`);
    stageKeys.add(s.key);
    if (!s.name?.trim()) out.push(`${sn}: enter a name.`);
    if (!s.stage_label?.trim()) out.push(`${sn}: enter the queue label.`);
    if (!s.tasks.length) out.push(`${sn}: add at least one task.`);
    if (s !== last && !(s.citizen_status >= 2 && s.citizen_status <= 6)) out.push(`${sn}: the status after the stage must be between 2 and 6.`);
    const taskKeys = new Set<string>();
    s.tasks.forEach((t, ti) => {
      const tn = `${sn}, task ${ti + 1}${t.name ? ` (${t.name})` : ''}`;
      if (!t.key?.trim()) out.push(`${tn}: a key is required.`);
      else if (taskKeys.has(t.key)) out.push(`${tn}: the key "${t.key}" is used twice in the stage.`);
      taskKeys.add(t.key);
      if (!t.name?.trim()) out.push(`${tn}: enter a name.`);
      if (!roleIds.has(t.role_id)) out.push(`${tn}: select the role that performs the task.`);
      if (!formIds.has(t.form)) out.push(`${tn}: select a form.`);
      if (!t.action_label?.trim()) out.push(`${tn}: enter the dashboard action label.`);
      if (s !== last && decisionForms.has(t.form)) out.push(`${tn}: the final decision form can only be used in the last stage.`);
    });
    if (s !== last && s.tasks.length && s.tasks.every((t) => t.optional)) out.push(`${sn}: at least one task must be mandatory.`);
  });
  // final stage
  if (last.tasks.length !== 1 || !decisionForms.has(last.tasks[0]?.form)) {
    out.push('The last stage must have exactly one task using the Final Decision form.');
  } else {
    const d = last.tasks[0].decision;
    const outcomes = new Set(d?.outcomes ?? []);
    for (const o of ['approve', 'return', 'reject'] as WorkflowOutcome[]) {
      if (!outcomes.has(o)) out.push(`The final decision must allow "${o}".`);
    }
    if (outcomes.has('inspect')) {
      const target = def.stages.find((s) => s.key === d?.inspect_stage);
      if (!target || target === last) out.push('The "inspect" outcome needs the inspection stage it activates.');
      else if (!target.tasks.every((t) => t.on_demand)) out.push(`The tasks of stage "${target.name}" must be "only when ordered" to be used by the "inspect" outcome.`);
    }
  }
  const regular = def.stages.slice(0, -1).filter((s) => !s.tasks.every((t) => t.on_demand));
  if (!def.stages.slice(0, -1).length && def.stages.length === 1) {
    // a decision-only workflow is allowed
  }
  for (let i = 1; i < regular.length; i++) {
    if (regular[i].citizen_status < regular[i - 1].citizen_status) out.push(`Stage "${regular[i].name}": the status cannot go back (${regular[i - 1].citizen_status} → ${regular[i].citizen_status}).`);
  }
  if (regular.length && regular[regular.length - 1].citizen_status !== 6) {
    out.push(`The stage before the final decision ("${regular[regular.length - 1].name}") must set status 6 — Pending Final Approval.`);
  }
  return out;
}

/** Checks the full set: one workflow per application type × level. */
export function workflowSetProblems(defs: WorkflowDefinition[], roles: DeptRole[], forms: FormDef[]): string[] {
  const out: string[] = [];
  for (const t of TYPES) {
    for (const l of LEVELS) {
      const n = defs.filter((d) => d.appl_type === t && d.level === l).length;
      if (n !== 1) out.push(`${t} · ${l}: ${n === 0 ? 'no workflow defined' : `${n} workflows defined (exactly one allowed)`}.`);
    }
  }
  for (const d of defs) out.push(...definitionProblems(d, roles, forms).map((p) => `${d.id}: ${p}`));
  return out;
}

export function slaProblems(sla: SlaConfig, defs: WorkflowDefinition[]): string[] {
  const out: string[] = [];
  const ok = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 365;
  for (const d of defs) {
    const s = sla.workflows[d.id];
    if (!s) {
      out.push(`${d.id}: SLA not defined.`);
      continue;
    }
    if (!ok(s.processing_days)) out.push(`${d.id}: processing SLA must be 1-365 days.`);
    if (!ok(s.inspection_days)) out.push(`${d.id}: inspection SLA must be 1-365 days.`);
    if (ok(s.processing_days) && ok(s.inspection_days) && s.inspection_days > s.processing_days) out.push(`${d.id}: the inspection SLA cannot exceed the processing SLA.`);
    for (const [k, v] of Object.entries(s.step_days ?? {})) {
      if (!ok(v)) out.push(`${d.id}: SLA of step "${k}" must be 1-365 days.`);
    }
  }
  if (!(Number.isInteger(sla.escalation.remind_every_days) && sla.escalation.remind_every_days >= 1)) out.push('Escalation reminder interval must be at least 1 day.');
  if (!sla.escalation.notify_officer && !sla.escalation.notify_approver) out.push('Escalations must notify the officer, the issuing authority or both.');
  return out;
}

// ---------------------------------------------------------------------------
// Officers
// ---------------------------------------------------------------------------

export function isAssociated(user: UserAccount, firestation: string): boolean {
  return !!user.all_stations || (user.stations ?? []).includes(String(firestation));
}

/** Active officers of a role associated with the fire station of the property (lowest id first). */
export function officersFor(roleId: string, firestation: string, users: UserAccount[]): UserAccount[] {
  return users
    .filter((u) => u.portal === 'dept' && u.active && u.deptRoleId === roleId && isAssociated(u, firestation))
    .sort((a, b) => a.id - b.id);
}

export function roleCode(roleId: string, roles: DeptRole[]): string {
  return roles.find((r) => r.id === roleId)?.code ?? roleId;
}

export interface SimulatedTask {
  stage: string;
  task: string;
  role: string;
  officers: string[];
  warning?: string;
}

/** "Who would do what" for a fire station — the admin simulator. */
export function simulate(def: WorkflowDefinition, firestation: string, ctx: WorkflowContext): SimulatedTask[] {
  return def.stages.flatMap((s) =>
    s.tasks.map((t) => {
      const officers = officersFor(t.role_id, firestation, ctx.users);
      const role = roleCode(t.role_id, ctx.roles);
      return {
        stage: s.name,
        task: t.name,
        role,
        officers: officers.map((o) => o.displayName),
        warning: !t.role_id
          ? 'Select the role that performs the task.'
          : officers.length === 0
            ? `No active ${role} is associated with this fire station — the task would be unassigned.`
            : officers.length > 1
              ? `${officers.length} ${role} officers are associated — the first (${officers[0].displayName}) is used.`
              : undefined,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Run inspection helpers
// ---------------------------------------------------------------------------

/** The latest row of every task (send back / re-inspection add new rows). */
export function currentTasks(run: WorkflowRun): WorkflowTask[] {
  const latest = new Map<string, WorkflowTask>();
  for (const t of run.tasks) {
    const k = `${t.stage_key}/${t.task_key}`;
    const prev = latest.get(k);
    if (!prev || t.task_id > prev.task_id) latest.set(k, t);
  }
  return [...latest.values()].sort((a, b) => a.task_id - b.task_id);
}

export function stageTasks(run: WorkflowRun, stageKey: string): WorkflowTask[] {
  return currentTasks(run).filter((t) => t.stage_key === stageKey);
}

export function activeTasks(run: WorkflowRun): WorkflowTask[] {
  return currentTasks(run).filter((t) => t.state === 'active');
}

/** Index of the stage in progress (-1 when the run is complete). */
export function activeStageIndex(run: WorkflowRun): number {
  const active = new Set(activeTasks(run).map((t) => t.stage_key));
  return run.stages.findIndex((s) => active.has(s.key));
}

export function isFinalTask(run: WorkflowRun, task: WorkflowTask): boolean {
  return run.stages[finalStageIndex(run.stages)]?.key === task.stage_key;
}

/** "Pending with" text (legacy reviewer column). */
export function pendingWith(run: WorkflowRun | undefined, roles: DeptRole[]): string {
  if (!run || run.completed_on) return '';
  return activeTasks(run)
    .map((t) => (t.assignee ? t.assignee_name : `Unassigned (${roleCode(t.role_id, roles)})`))
    .filter((v, i, all) => all.indexOf(v) === i)
    .join(', ');
}

function nextTaskId(run: WorkflowRun): number {
  return run.tasks.reduce((m, t) => Math.max(m, t.task_id), 0) + 1;
}

function nowText(now: Date): string {
  return formatLegacyDate(now);
}

function copyRow(run: WorkflowRun, t: WorkflowTask, state: WorkflowTask['state'], now?: Date): WorkflowTask {
  return {
    ...clone(t),
    task_id: nextTaskId(run),
    state,
    start_date: state === 'active' && now ? nowText(now) : undefined,
    end_date: undefined,
    draft: true,
    decision: undefined,
    sent_back_to: undefined,
  };
}

function log(app: Application, action: string, remarks: string, task: WorkflowTask | null, ctx: WorkflowContext, now: Date, name?: string, role?: string): void {
  const r = role ?? (task ? roleCode(task.role_id, ctx.roles) : 'System');
  app.processLog = [...app.processLog, processStep(app, action, remarks, { name: name ?? task?.assignee_name ?? 'System', role: r }, now)];
}

function actorName(ctx: WorkflowContext, by: string): string {
  return ctx.users.find((u) => u.username === by)?.displayName ?? by;
}

function actorRole(ctx: WorkflowContext, by: string): string {
  const u = ctx.users.find((x) => x.username === by);
  return u?.deptRoleId ? roleCode(u.deptRoleId, ctx.roles) : 'System';
}

function refreshPending(app: Application, ctx: WorkflowContext): void {
  app.reviewer = pendingWith(app.workflow, ctx.roles);
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

/** Starts the workflow of a submitted application (legacy: process steps created at submission). */
export function startRun(app: Application, def: WorkflowDefinition, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const stages = clone(def.stages);
  const tasks: WorkflowTask[] = [];
  const firstStage = stages.findIndex((s) => !s.tasks.every((t) => t.on_demand));
  let id = 1;
  stages.forEach((s, si) => {
    for (const t of s.tasks) {
      const officer = officersFor(t.role_id, a.firestation, ctx.users)[0];
      const active = si === firstStage && !t.on_demand;
      tasks.push({
        task_id: id++,
        stage_key: s.key,
        task_key: t.key,
        name: t.name,
        role_id: t.role_id,
        assignee: officer?.username ?? null,
        assignee_name: officer?.displayName ?? '',
        state: t.on_demand ? 'not_required' : active ? 'active' : 'waiting',
        start_date: active ? nowText(now) : undefined,
        form: t.form,
        data: {},
        draft: false,
        remarks: '',
      });
    }
  });
  const finalKey = stages[finalStageIndex(stages)].key;
  const run: WorkflowRun = {
    definition_id: def.id,
    version: def.version,
    revision: a.revision,
    started_on: nowText(now),
    stages,
    tasks,
    approver: tasks.find((t) => t.stage_key === finalKey)?.assignee ?? null,
  };
  a.workflow = run;
  a.status_id = 2;
  a.stage_label = 'Submitted';
  refreshPending(a, ctx);
  return a;
}

function taskOrFail(run: WorkflowRun, taskId: number): WorkflowTask {
  return run.tasks.find((t) => t.task_id === taskId) ?? fail('Task not found.');
}

function runOrFail(app: Application): WorkflowRun {
  if (!app.workflow || app.workflow.completed_on) fail('This application has no workflow in progress.');
  return app.workflow;
}

function ensureCurrent(run: WorkflowRun, task: WorkflowTask): void {
  if (!currentTasks(run).some((t) => t.task_id === task.task_id)) fail('This task has been superseded.');
}

function ensureOwner(task: WorkflowTask, by: string): void {
  if (task.state !== 'active') fail('This task is not open.');
  if (task.assignee !== by) fail('Only the officer the task is assigned to can act on it.');
}

/** Saves the form of a task as a draft (legacy Save, process_move.aspx?s=false). */
export function saveTask(app: Application, taskId: number, by: string, data: Record<string, unknown>): Application {
  const a = clone(app);
  const run = runOrFail(a);
  const task = taskOrFail(run, taskId);
  ensureCurrent(run, task);
  ensureOwner(task, by);
  task.data = clone(data);
  task.draft = true;
  return a;
}

function activateStage(run: WorkflowRun, stageIndex: number, now: Date): void {
  const stage = run.stages[stageIndex];
  for (const t of stageTasks(run, stage.key)) {
    if (t.state === 'waiting' || t.state === 'not_required') {
      t.state = 'active';
      t.start_date = nowText(now);
    } else if (t.state === 'sent_back' || t.state === 'done') {
      run.tasks.push(copyRow(run, t, 'active', now));
    }
  }
}

function stageComplete(run: WorkflowRun, stageIndex: number): boolean {
  const stage = run.stages[stageIndex];
  return stageTasks(run, stage.key).every((t) => {
    const def = taskDefOf(run.stages, t.stage_key, t.task_key);
    return t.state === 'done' || t.state === 'skipped' || (!!def?.optional && t.state !== 'active');
  });
}

/** Completes the stage when all mandatory tasks are done: sets status / label and activates the next stage. */
function advanceIfComplete(a: Application, run: WorkflowRun, stageIndex: number, now: Date): boolean {
  if (!stageComplete(run, stageIndex)) return false;
  const stage = run.stages[stageIndex];
  for (const t of stageTasks(run, stage.key)) {
    if (t.state === 'active') t.state = 'not_required'; // optional tasks left open
  }
  a.status_id = stage.citizen_status as Application['status_id'];
  a.stage_label = stage.stage_label;
  // next stage: the next one that is not "only when ordered"; an on-demand stage returns to the decision
  let next = stageIndex + 1;
  while (next < run.stages.length - 1 && run.stages[next].tasks.every((t) => t.on_demand)) next++;
  if (next < run.stages.length) {
    activateStage(run, next, now);
    // a stage whose officers were all bypassed in advance completes immediately
    if (next < run.stages.length - 1) advanceIfComplete(a, run, next, now);
  }
  return true;
}

/** Submits the note / report of a task (legacy Submit, process_move.aspx?s=true). */
export function submitTask(app: Application, taskId: number, by: string, data: Record<string, unknown>, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  const task = taskOrFail(run, taskId);
  ensureCurrent(run, task);
  ensureOwner(task, by);
  if (isFinalTask(run, task)) fail('Use the final decision to complete this task.');
  task.data = clone(data);
  task.draft = false;
  task.state = 'done';
  task.end_date = nowText(now);
  task.remarks = String(data['remark'] ?? '');
  if (data['recommendation'] === 'Y' || data['recommendation'] === 'N') task.recommendation = data['recommendation'];
  const si = run.stages.findIndex((s) => s.key === task.stage_key);
  advanceIfComplete(a, run, si, now);
  log(a, `${task.name} submitted`, task.remarks, task, ctx, now);
  refreshPending(a, ctx);
  return a;
}

/** The previous stage the file can be sent back to (legacy: only the previous officer). */
export function previousStageIndex(run: WorkflowRun, stageIndex: number): number {
  for (let i = stageIndex - 1; i >= 0; i--) {
    if (stageTasks(run, run.stages[i].key).some((t) => t.state === 'done')) return i;
  }
  return -1;
}

/** Sends the file back to the officers of the previous stage (legacy sendback.aspx). */
export function sendBack(app: Application, taskId: number, by: string, comments: string, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  const task = taskOrFail(run, taskId);
  ensureCurrent(run, task);
  ensureOwner(task, by);
  const def = taskDefOf(run.stages, task.stage_key, task.task_key);
  if (!def?.permissions.send_back) fail('This task cannot send the file back.');
  if (!comments.trim()) fail('Enter the comments for the officer the file is sent back to.');
  const si = run.stages.findIndex((s) => s.key === task.stage_key);
  const prev = previousStageIndex(run, si);
  if (prev < 0) fail('There is no previous stage to send the file back to.');
  // reset the current stage
  task.state = 'sent_back';
  task.end_date = nowText(now);
  task.remarks = comments.trim();
  task.sent_back_to = run.stages[prev].key;
  for (const t of stageTasks(run, task.stage_key)) {
    if (t.task_id === task.task_id) continue;
    if (t.state === 'active') {
      t.state = 'waiting';
      t.start_date = undefined;
    } else if (t.state === 'done') {
      run.tasks.push(copyRow(run, t, 'waiting'));
    }
  }
  // re-open the previous stage (new rows, data carried over)
  for (const t of stageTasks(run, run.stages[prev].key)) {
    if (t.state === 'done') run.tasks.push(copyRow(run, t, 'active', now));
  }
  // status goes back to what it was before the previous stage
  const before = run.stages.slice(0, prev).filter((s) => stageTasks(run, s.key).some((t) => t.state === 'done'));
  const last = before[before.length - 1];
  a.status_id = (last ? last.citizen_status : 2) as Application['status_id'];
  a.stage_label = last ? last.stage_label : 'Submitted';
  log(a, `Sent back to ${run.stages[prev].name}`, comments.trim(), task, ctx, now);
  refreshPending(a, ctx);
  return a;
}

/** The issuing authority bypasses an officer (legacy "X", "Officer Bypassed"). */
export function skipTask(app: Application, taskId: number, by: string, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  const task = taskOrFail(run, taskId);
  ensureCurrent(run, task);
  if (run.approver !== by) fail('Only the issuing authority can bypass an officer.');
  const def = taskDefOf(run.stages, task.stage_key, task.task_key);
  if (!def?.permissions.skippable) fail('This officer cannot be bypassed.');
  if (task.state !== 'active' && task.state !== 'waiting') fail('Only pending tasks can be bypassed.');
  if (isFinalTask(run, task)) fail('The final decision cannot be bypassed.');
  const inProgress = activeStageIndex(run);
  task.state = 'skipped';
  task.end_date = nowText(now);
  task.remarks = 'Officer Bypassed';
  const si = run.stages.findIndex((s) => s.key === task.stage_key);
  if (si === inProgress) advanceIfComplete(a, run, si, now);
  const approverName = ctx.users.find((u) => u.username === by)?.displayName ?? by;
  log(a, `${task.name} bypassed`, 'Officer Bypassed', task, ctx, now, approverName);
  refreshPending(a, ctx);
  return a;
}

/** Changes the officer of a pending task (legacy "C"; admin: any pending task). */
export function reassignTask(app: Application, taskId: number, by: string, toUsername: string, ctx: WorkflowContext, now: Date, asAdmin = false): Application {
  const a = clone(app);
  const run = runOrFail(a);
  const task = taskOrFail(run, taskId);
  ensureCurrent(run, task);
  if (task.state !== 'active' && task.state !== 'waiting' && task.state !== 'not_required') fail('Only pending tasks can be reassigned.');
  const def = taskDefOf(run.stages, task.stage_key, task.task_key);
  if (!asAdmin) {
    if (run.approver !== by) fail('Only the issuing authority can change an officer.');
    if (!def?.permissions.reassignable) fail('The officer of this task cannot be changed.');
  }
  const user = ctx.users.find((u) => u.username === toUsername);
  if (!user || !user.active || user.portal !== 'dept') fail('Select an active department officer.');
  if (user.deptRoleId !== task.role_id) fail(`The task needs a ${roleCode(task.role_id, ctx.roles)}.`);
  const from = task.assignee_name || 'Unassigned';
  task.assignee = user.username;
  task.assignee_name = user.displayName;
  if (isFinalTask(run, task)) run.approver = user.username;
  const byName = asAdmin ? 'Portal Administrator' : (ctx.users.find((u) => u.username === by)?.displayName ?? by);
  log(a, `${task.name}: officer changed`, `${from} → ${user.displayName}`, task, ctx, now, byName);
  refreshPending(a, ctx);
  return a;
}

// ---------------------------------------------------------------------------
// Other department actions on a file in process
// ---------------------------------------------------------------------------

/** Only the officer of a pending task on the active stage (or the issuing authority) may act on the file. */
function ensureInvolved(run: WorkflowRun, by: string): void {
  const involved = activeTasks(run).some((t) => t.assignee === by) || run.approver === by;
  if (!involved) fail('Only an officer with an open task on this file can do this.');
}

/** Requests a document from the applicant (legacy uploaddeptdocs.aspx — request). */
export function requestDocuments(app: Application, by: string, fileDesc: string, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  ensureInvolved(run, by);
  if (!fileDesc.trim()) fail('Describe the document requested from the applicant.');
  const req: RequestedDocument = {
    fileid: nextId(a.deptfiles, (f) => f.fileid),
    appid: a.appl_id,
    processid: activeTasks(run).find((t) => t.assignee === by)?.task_id ?? 0,
    file_name: fileDesc.trim().replace(/[^a-zA-Z0-9]+/g, ''),
    file_desc: fileDesc.trim(),
    status: 'R',
    citizen_comment: '',
    requested_by: actorName(ctx, by),
    requested_on: nowText(now),
  };
  a.deptfiles = [...a.deptfiles, req];
  log(a, 'Document requested', fileDesc.trim(), null, ctx, now, actorName(ctx, by), actorRole(ctx, by));
  return a;
}

/** Uploads a department document (legacy uploaddeptdocs.aspx — department upload, e.g. inspection photographs). */
export function uploadDeptDocument(app: Application, by: string, fileName: string, description: string, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  ensureInvolved(run, by);
  if (!fileName.trim()) fail('Choose a file to upload.');
  const docs = a.dept_documents ?? [];
  a.dept_documents = [...docs, { doc_id: nextId(docs, (d) => d.doc_id), file_name: fileName.trim(), description: description.trim(), uploaded_by: actorName(ctx, by), uploaded_on: nowText(now) }];
  log(a, 'Department document uploaded', description.trim() || fileName.trim(), null, ctx, now, actorName(ctx, by), actorRole(ctx, by));
  return a;
}

/** Sends an SMS to the applicant (legacy sendsms.aspx, simulated). */
export function sendSms(app: Application, by: string, message: string, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  ensureInvolved(run, by);
  if (!message.trim()) fail('Enter the message to send.');
  const sms = a.sms ?? [];
  a.sms = [...sms, { sms_id: nextId(sms, (s) => s.sms_id), message: message.trim(), sent_by: actorName(ctx, by), sent_on: nowText(now) }];
  log(a, 'SMS sent', message.trim(), null, ctx, now, actorName(ctx, by), actorRole(ctx, by));
  return a;
}

/**
 * Changes the fire station of a file while it is still Submitted, before any task was completed
 * (legacy update_application.aspx, status 2 only) — re-resolves the officers of every pending task
 * from the new station, exactly like a fresh submission would.
 */
export function changeFireStation(app: Application, by: string, district: number, distName: string, firestation: string, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  ensureInvolved(run, by);
  if (a.status_id !== 2 || run.tasks.some((t) => t.state === 'done' || t.state === 'skipped' || t.state === 'sent_back')) {
    fail('The fire station can only be changed while the file is Submitted, before any officer has acted on it.');
  }
  a.district = district;
  a.dist_name = distName;
  a.firestation = firestation;
  for (const t of run.tasks) {
    if (t.state !== 'active' && t.state !== 'waiting' && t.state !== 'not_required') continue;
    const officer = officersFor(t.role_id, firestation, ctx.users)[0];
    t.assignee = officer?.username ?? null;
    t.assignee_name = officer?.displayName ?? '';
  }
  run.approver = currentTasks(run).find((t) => isFinalTask(run, t))?.assignee ?? null;
  log(a, 'Fire station changed', `${a.dist_name} / ${firestation}`, null, ctx, now, actorName(ctx, by), actorRole(ctx, by));
  refreshPending(a, ctx);
  return a;
}

/** Updates the licensing authority, allowed only once the file has reached its final (decision) stage. */
export function updateLicensingAuthority(app: Application, by: string, licAuth: string, licAddr: string, ctx: WorkflowContext, now: Date): Application {
  const a = clone(app);
  const run = runOrFail(a);
  ensureInvolved(run, by);
  if (activeStageIndex(run) !== finalStageIndex(run.stages)) fail('The licensing authority can only be updated once the file has reached the final decision.');
  if (!licAuth.trim() || !licAddr.trim()) fail('Enter the licensing authority and its address.');
  const from = a.lic_auth;
  a.lic_auth = licAuth.trim();
  a.lic_addr = licAddr.trim();
  log(a, 'Licensing authority updated', `${from || '—'} → ${a.lic_auth}`, null, ctx, now, actorName(ctx, by), actorRole(ctx, by));
  return a;
}

// ---------------------------------------------------------------------------
// SLA
// ---------------------------------------------------------------------------

export function slaFor(app: Pick<Application, 'workflow'>, sla: SlaConfig) {
  return app.workflow ? sla.workflows[app.workflow.definition_id] : undefined;
}

/** SLA (days) of a task: the inspection SLA for inspection forms, otherwise the step SLA. */
export function taskSlaDays(run: WorkflowRun, task: WorkflowTask, sla: SlaConfig, forms: FormDef[]): number {
  const s = sla.workflows[run.definition_id];
  if (!s) return 7;
  if (forms.find((f) => f.id === task.form)?.inspection) return s.inspection_days;
  return s.step_days[task.task_key] ?? 7;
}

export function taskDaysPending(task: WorkflowTask, now: Date): number {
  return task.start_date ? Math.max(0, daysSince(task.start_date, now) ?? 0) : 0;
}

export function isTaskOverdue(run: WorkflowRun, task: WorkflowTask, sla: SlaConfig, forms: FormDef[], now: Date): boolean {
  return task.state === 'active' && taskDaysPending(task, now) > taskSlaDays(run, task, sla, forms);
}

/** Days since the workflow started (current revision). */
export function processingDays(app: Pick<Application, 'workflow'>, now: Date): number {
  const run = app.workflow;
  if (!run) return 0;
  const end = run.completed_on ? parseLegacyDate(run.completed_on) ?? now : now;
  return Math.max(0, daysSince(run.started_on, end) ?? 0);
}

export function isProcessingOverdue(app: Pick<Application, 'workflow'>, sla: SlaConfig, now: Date): boolean {
  const s = slaFor(app, sla);
  return !!s && !!app.workflow && !app.workflow.completed_on && processingDays(app, now) > s.processing_days;
}

/** Legacy rule: once the processing SLA is crossed the file can only be approved or rejected. */
export function allowedOutcomes(app: Application, sla: SlaConfig, now: Date): WorkflowOutcome[] {
  const run = app.workflow;
  if (!run) return [];
  const final = run.stages[finalStageIndex(run.stages)].tasks[0];
  const outcomes = final?.decision?.outcomes ?? [];
  return isProcessingOverdue(app, sla, now) ? outcomes.filter((o) => o !== 'return') : outcomes;
}

// ---------------------------------------------------------------------------
// Final decision
// ---------------------------------------------------------------------------

export interface DecisionInput {
  remark: string;
  /** Signed scanned NOC / letter (metadata only in this build) — mandatory for approve/return/reject. */
  signed_document?: { file_name: string; size?: number } | null;
  /** Renewals: validity entered by the issuing authority (legacy dgfs_note). */
  valid_from?: string;
  valid_to?: string;
  /** Extra "Copy to" lines and remarks about the committee report. */
  addcc?: string;
  rem_comm?: string;
}

export function decide(
  app: Application,
  taskId: number,
  by: string,
  outcome: WorkflowOutcome,
  input: DecisionInput,
  ctx: WorkflowContext,
  sla: SlaConfig,
  renewalRules: RenewalRule[],
  now: Date,
): Application {
  const a = clone(app);
  const run = runOrFail(a);
  const task = taskOrFail(run, taskId);
  ensureCurrent(run, task);
  ensureOwner(task, by);
  if (!isFinalTask(run, task)) fail('This is not the final decision task.');
  const def = taskDefOf(run.stages, task.stage_key, task.task_key);
  if (!def?.decision?.outcomes.includes(outcome)) fail(`"${outcome}" is not an allowed decision for this workflow.`);
  if (!allowedOutcomes(a, sla, now).includes(outcome)) {
    fail(`The processing SLA of ${slaFor(a, sla)?.processing_days} days has been exceeded — the application can only be approved or rejected.`);
  }
  if (outcome !== 'inspect' && !input.signed_document?.file_name) fail('Upload the signed NOC / letter before submitting the decision.');
  if (outcome !== 'inspect' && !input.remark?.trim()) fail('Enter the remarks of the decision (they are printed on the NOC / letter).');

  task.data = clone(input) as unknown as Record<string, unknown>;
  task.draft = false;
  task.state = 'done';
  task.end_date = nowText(now);
  task.remarks = input.remark?.trim() ?? '';
  task.decision = outcome;

  if (outcome === 'inspect') {
    const target = run.stages.findIndex((s) => s.key === def.decision?.inspect_stage);
    if (target < 0) fail('The inspection stage of this workflow is not configured.');
    run.tasks.push(copyRow(run, task, 'waiting'));
    activateStage(run, target, now);
    log(a, 'Inspection ordered', task.remarks, task, ctx, now);
    refreshPending(a, ctx);
    return a;
  }

  const date = nowText(now);
  a.final_date = date;
  a.last_modified = date;
  run.completed_on = date;
  run.outcome = outcome;
  if (outcome === 'approve') {
    a.status_id = 7;
    a.stage_label = 'Approved';
    if (a.appl_type !== 'P') {
      if (input.valid_from && input.valid_to) {
        a.valid_from = input.valid_from;
        a.valid_to = input.valid_to;
      } else {
        Object.assign(a, certificateValidity(date, renewalPeriodYears(a, renewalRules)));
      }
    }
  } else if (outcome === 'return') {
    a.status_id = 8;
    a.stage_label = 'Returned with Comments';
  } else {
    a.status_id = 9;
    a.stage_label = 'Rejected';
  }
  a.reviewer = '';
  const action = outcome === 'approve' ? (a.appl_type === 'D' ? 'Accepted' : 'Issued') : outcome === 'return' ? 'Returned' : 'Rejected';
  log(a, action, task.remarks, task, ctx, now);
  return a;
}

/** The stored data of the final decision task (addcc / rem_comm / validity), if any decision was taken. */
export function decisionInput(app: Pick<Application, 'workflow'>): Partial<DecisionInput> | undefined {
  const t = app.workflow?.tasks.find((x) => x.decision && x.decision !== 'inspect');
  return t?.data as Partial<DecisionInput> | undefined;
}

/**
 * Builds a throw-away preview of the application as it would be after a decision — used to render a
 * live NOC / letter preview while the issuing authority is still filling the form. Never persisted;
 * the real transaction still goes through `decide()` with its full validation.
 */
export function decisionPreviewApp(app: Application, outcome: WorkflowOutcome, input: DecisionInput, ctx: WorkflowContext, renewalRules: RenewalRule[], now: Date): Application {
  const a = clone(app);
  const run = a.workflow;
  if (!run) return a;
  const date = nowText(now);
  a.final_date = date;
  if (outcome === 'approve') {
    a.status_id = 7;
    if (a.appl_type !== 'P') {
      if (input.valid_from && input.valid_to) {
        a.valid_from = input.valid_from;
        a.valid_to = input.valid_to;
      } else {
        Object.assign(a, certificateValidity(date, renewalPeriodYears(a, renewalRules)));
      }
    }
  } else if (outcome === 'return') {
    a.status_id = 8;
  } else if (outcome === 'reject') {
    a.status_id = 9;
  }
  const finalKey = run.stages[finalStageIndex(run.stages)].key;
  const finalTask = currentTasks(run).find((t) => t.stage_key === finalKey)!;
  const previewTask: WorkflowTask = {
    ...clone(finalTask),
    task_id: nextTaskId(run),
    data: clone(input) as unknown as Record<string, unknown>,
    remarks: input.remark?.trim() ?? '',
    decision: outcome,
    state: 'done',
    end_date: date,
  };
  run.tasks = [...run.tasks, previewTask];
  if (outcome !== 'inspect') {
    const action = outcome === 'approve' ? (a.appl_type === 'D' ? 'Accepted' : 'Issued') : outcome === 'return' ? 'Returned' : 'Rejected';
    log(a, action, previewTask.remarks, previewTask, ctx, now);
  }
  return a;
}

/** Citizen revises a returned / rejected application: the run moves to the history (legacy Revision column). */
export function archiveRun(app: Application): Application {
  const a = clone(app);
  if (a.workflow) {
    a.workflow_history = [...(a.workflow_history ?? []), a.workflow];
    a.workflow = undefined;
  }
  a.stage_label = '';
  return a;
}

// ---------------------------------------------------------------------------
// Queues (the new hqlist)
// ---------------------------------------------------------------------------

export interface TaskItem {
  app: Application;
  task: WorkflowTask;
  action_label: string;
}

/** Active tasks assigned to the officer (dashboard "My tasks"). */
export function myTasks(apps: Application[], username: string): TaskItem[] {
  const out: TaskItem[] = [];
  for (const app of apps) {
    const run = app.workflow;
    if (!run || run.completed_on) continue;
    for (const t of activeTasks(run)) {
      if (t.assignee === username) {
        out.push({ app, task: t, action_label: taskDefOf(run.stages, t.stage_key, t.task_key)?.action_label ?? 'Open' });
      }
    }
  }
  return out.sort((x, y) => (parseLegacyDate(x.task.start_date)?.getTime() ?? 0) - (parseLegacyDate(y.task.start_date)?.getTime() ?? 0));
}

/**
 * Applications the officer may follow (dashboard "Monitoring"): those whose workflow involves him —
 * as an assignee, or through his designation at the fire station of the property. The monitoring
 * role sees every submitted application.
 */
export function monitoredApplications(apps: Application[], user: UserAccount): Application[] {
  return apps.filter((app) => {
    if (app.status_id < 2 || !app.workflow) return false;
    if (user.deptRoleId === '8') return true;
    const run = app.workflow;
    if (run.tasks.some((t) => t.assignee === user.username)) return true;
    return run.stages.some((s) => s.tasks.some((t) => t.role_id === user.deptRoleId)) && isAssociated(user, app.firestation);
  });
}

/** Level of a Declaration: the level of the Occupancy NOC being renewed. */
export function declarationLevel(app: Pick<Application, 'noc_level' | 'ref_no' | 'parent_id'>, apps: Application[] = []): DelegationLevel {
  const parent = apps.find((x) => (app.parent_id && x.appl_id === app.parent_id) || (!!app.ref_no && x.appl_number === app.ref_no));
  return parent?.delegation_level ?? app.noc_level ?? 'DFO';
}

export function outcomeLabel(o: WorkflowOutcome): string {
  return { approve: 'Approved', return: 'Returned with Remarks', reject: 'Rejected', inspect: 'Inspection' }[o];
}
