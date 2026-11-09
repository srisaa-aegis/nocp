import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { LeaveAware } from '../../core/auth/unsaved-changes.guard';
import { definitionProblems, roleCode, simulate } from '../../core/domain/workflow';
import { StatusId, WorkflowDefinition, WorkflowOutcome, WorkflowStageDef, WorkflowTaskDef } from '../../core/models';
import { statusPresentation } from '../../shared/status.util';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { IconComponent } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';
import { WorkflowAdminData, WorkflowsAdminService } from './workflows-admin.service';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Admin → Workflows → edit one workflow: ordered stages (↑ ↓, add, remove) with parallel tasks
 * (role, form, dashboard action, optional / only when ordered, permissions), the final decision
 * pinned last with its outcomes; live validation, flow preview and an officer simulator per fire
 * station. Saving bumps the version — applications in process keep the version they started with.
 */
@Component({
  selector: 'app-workflow-editor',
  imports: [FormsModule, RouterLink, IconComponent],
  templateUrl: './workflow-editor.html',
  styleUrl: './workflow-editor.scss',
})
export class WorkflowEditor implements LeaveAware {
  private readonly service = inject(WorkflowsAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  /** Route param (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly data = signal<WorkflowAdminData | null>(null);
  protected readonly draft = signal<WorkflowDefinition | null>(null);
  private original = '';
  private readonly rev = signal(0);
  protected readonly saving = signal(false);
  protected readonly notFound = signal(false);

  protected readonly simDistrict = signal<number>(0);
  protected readonly simStation = signal<string>('');

  protected readonly statuses: { id: StatusId; label: string }[] = ([2, 3, 4, 5, 6] as StatusId[]).map((id) => ({ id, label: `${id} — ${statusPresentation(id).label}` }));
  protected readonly optionalOutcomes: { id: WorkflowOutcome; label: string }[] = [{ id: 'inspect', label: 'Order an inspection (then decide)' }];

  protected readonly roles = computed(() => this.data()?.roles.filter((r) => r.code !== 'VIEW') ?? []);
  protected readonly taskForms = computed(() => this.data()?.forms.filter((f) => !f.decision) ?? []);
  protected readonly decisionForms = computed(() => this.data()?.forms.filter((f) => f.decision) ?? []);

  protected readonly dirty = computed(() => {
    this.rev();
    const d = this.draft();
    return !!d && JSON.stringify(d) !== this.original;
  });

  protected readonly problems = computed(() => {
    this.rev();
    const d = this.draft();
    const data = this.data();
    return d && data ? definitionProblems(d, data.roles, data.forms) : [];
  });

  protected readonly usage = computed(() => {
    const d = this.draft();
    const u = d ? this.data()?.usage[d.id] ?? {} : {};
    return Object.entries(u)
      .map(([version, v]) => ({ version: Number(version), ...v }))
      .sort((a, b) => b.version - a.version);
  });

  protected readonly stations = computed(() => this.data()?.fireStations.find((d) => Number(d.id) === this.simDistrict())?.stations ?? []);

  protected readonly simulation = computed(() => {
    this.rev();
    const d = this.draft();
    const data = this.data();
    const st = this.simStation();
    return d && data && st ? simulate(d, st, { users: data.users, roles: data.roles }) : [];
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private load(id: string): void {
    this.service.load().subscribe((data) => {
      this.data.set(data);
      const def = data.workflows.find((w) => w.id === id);
      this.notFound.set(!def);
      if (def) this.reset(def);
      if (!this.simDistrict()) {
        const first = data.districts[0];
        if (first) this.pickDistrict(first.id);
      }
    });
  }

  private reset(def: WorkflowDefinition): void {
    this.original = JSON.stringify(def);
    this.draft.set(clone(def));
    this.touch();
  }

  protected touch(): void {
    this.rev.update((n) => n + 1);
  }

  protected pickDistrict(id: number): void {
    this.simDistrict.set(Number(id));
    this.simStation.set(String(this.stations()[0]?.id ?? ''));
  }

  protected roleName(id: string): string {
    return roleCode(id, this.data()?.roles ?? []);
  }

  protected isFinal(i: number): boolean {
    return i === (this.draft()?.stages.length ?? 0) - 1;
  }

  private usedKeys(): Set<string> {
    const d = this.draft();
    return new Set((d?.stages ?? []).flatMap((s) => [s.key, ...s.tasks.map((t) => t.key)]));
  }

  private uniqueKey(base: string): string {
    const used = this.usedKeys();
    const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'step';
    if (!used.has(slug)) return slug;
    let n = 2;
    while (used.has(`${slug}_${n}`)) n++;
    return `${slug}_${n}`;
  }

  private newTask(): WorkflowTaskDef {
    return {
      key: this.uniqueKey('task'),
      name: '',
      role_id: '',
      form: '',
      action_label: 'Review',
      permissions: { send_back: true, request_documents: true, skippable: true, reassignable: true },
    };
  }

  // --- stages ---------------------------------------------------------------

  protected addStage(): void {
    const d = this.draft();
    if (!d) return;
    const before = d.stages[d.stages.length - 2];
    const stage: WorkflowStageDef = {
      key: this.uniqueKey('stage'),
      name: 'New stage',
      stage_label: 'Reviewed',
      citizen_status: before?.citizen_status ?? 3,
      tasks: [],
    };
    stage.tasks.push(this.newTask());
    d.stages.splice(d.stages.length - 1, 0, stage);
    this.touch();
  }

  protected async removeStage(i: number): Promise<void> {
    const d = this.draft();
    if (!d || this.isFinal(i)) return;
    const ok = await this.dialog.open({
      title: 'Remove stage?',
      message: `The stage "${d.stages[i].name}" and its ${d.stages[i].tasks.length} task(s) will be removed from this workflow.`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    d.stages.splice(i, 1);
    this.touch();
  }

  protected moveStage(i: number, dir: -1 | 1): void {
    const d = this.draft();
    if (!d) return;
    const j = i + dir;
    if (this.isFinal(i) || j < 0 || j >= d.stages.length - 1) return;
    [d.stages[i], d.stages[j]] = [d.stages[j], d.stages[i]];
    this.touch();
  }

  // --- tasks ----------------------------------------------------------------

  protected addTask(stage: WorkflowStageDef): void {
    stage.tasks.push(this.newTask());
    this.touch();
  }

  protected removeTask(stage: WorkflowStageDef, ti: number): void {
    stage.tasks.splice(ti, 1);
    this.touch();
  }

  protected onDemandChanged(stage: WorkflowStageDef, task: WorkflowTaskDef, value: boolean): void {
    task.on_demand = value || undefined;
    // "only when ordered" applies to a whole stage
    for (const t of stage.tasks) t.on_demand = value || undefined;
    this.touch();
  }

  // --- decision -------------------------------------------------------------

  protected hasOutcome(task: WorkflowTaskDef, o: WorkflowOutcome): boolean {
    return !!task.decision?.outcomes.includes(o);
  }

  protected toggleOutcome(task: WorkflowTaskDef, o: WorkflowOutcome, on: boolean): void {
    const d = (task.decision ??= { outcomes: ['approve', 'return', 'reject'] });
    d.outcomes = on ? [...new Set([...d.outcomes, o])] : d.outcomes.filter((x) => x !== o);
    if (o === 'inspect' && !on) delete d.inspect_stage;
    if (o === 'inspect' && on && !d.inspect_stage) {
      d.inspect_stage = this.draft()?.stages.find((s) => s.tasks.length && s.tasks.every((t) => t.on_demand))?.key;
    }
    this.touch();
  }

  protected onDemandStages(): WorkflowStageDef[] {
    return (this.draft()?.stages ?? []).filter((s, i) => !this.isFinal(i) && s.tasks.length && s.tasks.every((t) => t.on_demand));
  }

  // --- save / discard / restore ---------------------------------------------

  protected save(): void {
    const d = this.draft();
    if (!d || this.problems().length) return;
    this.saving.set(true);
    this.service.save(clone(d), this.auth.session()?.username ?? 'admin').subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.toast.success(`${saved.name} saved as version ${saved.version}. New submissions use it; files in process keep their version.`);
        this.load(saved.id);
      },
      error: (e: Error) => {
        this.saving.set(false);
        this.toast.error(e.message);
      },
    });
  }

  protected discard(): void {
    if (this.original) this.reset(JSON.parse(this.original) as WorkflowDefinition);
  }

  protected async restoreDefault(): Promise<void> {
    const d = this.draft();
    const def = this.data()?.defaults.find((w) => w.id === d?.id);
    if (!d || !def) return;
    const ok = await this.dialog.open({
      title: 'Restore the default workflow?',
      message: 'The stages and tasks are replaced by the workflow shipped with the portal. Nothing is saved until you press Save.',
      confirmText: 'Restore',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    this.draft.set({ ...clone(def), version: d.version, updated_on: d.updated_on, updated_by: d.updated_by });
    this.touch();
  }

  async canLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    return this.dialog.open({
      title: 'Discard unsaved changes?',
      message: 'The changes to this workflow have not been saved.',
      confirmText: 'Discard',
      cancelText: 'Stay',
    });
  }

  protected back(): void {
    this.router.navigateByUrl('/admin/workflows');
  }
}
