import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { delegationLevelName } from '../../core/domain/application-rules';
import { validateUpload } from '../../core/domain/documents';
import {
  CommitteeConcurrenceData,
  InspectionReportData,
  QuestionnaireData,
  RfoNoteData,
  SectionNoteData,
  initialTaskFormData,
  taskFormProblems,
} from '../../core/domain/task-forms';
import {
  WorkflowContext,
  activeTasks,
  currentTasks,
  DecisionInput,
  isFinalTask,
  isProcessingOverdue,
  processingDays,
  slaFor,
  taskDaysPending,
  taskDefOf,
  taskSlaDays,
} from '../../core/domain/workflow';
import { LookupService, WizardLookups, WorkflowConfig } from '../../core/lookups/lookup.service';
import { Application, DistrictFireStations, RenewalRule, UserAccount, WorkflowOutcome, WorkflowTask, WorkflowTaskDef } from '../../core/models';
import { ApplicationSheet } from '../../shared/application-sheet/application-sheet';
import { ApplTypeBadge } from '../../shared/ui/appl-type-badge';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { IconComponent } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { WorkflowProgress } from '../../shared/workflow/workflow-progress';
import { DeptWorkflowService } from './dept-workflow.service';
import { CommitteeConcurrenceForm } from './forms/committee-concurrence-form';
import { FinalDecisionForm } from './forms/final-decision-form';
import { InspectionReportForm } from './forms/inspection-report-form';
import { QuestionnaireForm } from './forms/questionnaire-form';
import { RfoNoteForm } from './forms/rfo-note-form';
import { SectionNoteForm } from './forms/section-note-form';

type Tab = 'workflow' | 'application' | 'documents' | 'correspondence' | 'timeline';
type ModalKind = 'sendback' | 'bypass' | 'reassign' | 'request_doc' | 'upload_doc' | 'sms' | 'fire_station' | 'lic_auth';

interface MyTask {
  task: WorkflowTask;
  def: WorkflowTaskDef | undefined;
  days: number;
  sla: number;
  formName: string;
}

interface PendingRow {
  task: WorkflowTask;
  def: WorkflowTaskDef | undefined;
  isMine: boolean;
}

/**
 * Department processing page of one application (legacy application.aspx + process_steps.aspx +
 * process_move.aspx / sendback.aspx / reassign.aspx / uploaddeptdocs.aspx / sendsms.aspx /
 * update_application.aspx). Phase 3a built the read-only view (header, stage stepper, process
 * steps, application sheet, documents, SMS, log); Phase 3b adds the officer's own note / report
 * form (Save / Submit), the final decision with its live NOC / letter preview, send back / bypass /
 * change officer, document requests, department documents, SMS, fire station and licensing
 * authority.
 */
@Component({
  selector: 'app-dept-application-view',
  imports: [
    RouterLink,
    FormsModule,
    ApplTypeBadge,
    StatusBadge,
    IconComponent,
    ApplicationSheet,
    WorkflowProgress,
    Modal,
    SectionNoteForm,
    InspectionReportForm,
    CommitteeConcurrenceForm,
    RfoNoteForm,
    QuestionnaireForm,
    FinalDecisionForm,
  ],
  templateUrl: './application-view.html',
  styleUrl: './application-view.scss',
})
export class ApplicationView {
  private readonly dept = inject(DeptWorkflowService);
  private readonly lookupService = inject(LookupService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(ConfirmDialogService);

  /** Route param / query param, bound via withComponentInputBinding. */
  readonly id = input.required<string>();
  readonly task = input<string | undefined>(undefined);

  protected readonly app = signal<Application | null>(null);
  protected readonly cfg = signal<WorkflowConfig | null>(null);
  protected readonly users = signal<UserAccount[]>([]);
  protected readonly parent = signal<Application | null>(null);
  protected readonly renewalRules = signal<RenewalRule[]>([]);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly tab = signal<Tab>('workflow');
  protected readonly lookups = toSignal<WizardLookups | null>(this.lookupService.wizard(), { initialValue: null });
  protected readonly now = new Date();
  protected readonly me = computed(() => this.auth.session()?.username ?? '');

  protected readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'workflow', label: 'Workflow', icon: 'layers' },
    { id: 'application', label: 'Application', icon: 'file' },
    { id: 'documents', label: 'Documents', icon: 'paperclip' },
    { id: 'correspondence', label: 'SMS', icon: 'bell' },
    { id: 'timeline', label: 'Process log', icon: 'clock' },
  ];

  protected readonly ctx = computed<WorkflowContext>(() => ({ users: this.users(), roles: this.cfg()?.roles ?? [] }));
  protected readonly run = computed(() => this.app()?.workflow ?? null);
  protected readonly isApprover = computed(() => !!this.run() && this.run()!.approver === this.me());

  /** The open tasks of the logged-in officer on this application. */
  protected readonly myOpenTasks = computed<MyTask[]>(() => {
    const run = this.run();
    const cfg = this.cfg();
    const me = this.me();
    if (!run || !cfg || !me || run.completed_on) return [];
    return activeTasks(run)
      .filter((t) => t.assignee === me)
      .map((t) => {
        const def = taskDefOf(run.stages, t.stage_key, t.task_key);
        return {
          task: t,
          def,
          days: taskDaysPending(t, this.now),
          sla: taskSlaDays(run, t, cfg.sla, cfg.forms),
          formName: cfg.forms.find((f) => f.id === t.form)?.name ?? t.form,
        };
      });
  });

  protected readonly selectedTaskId = signal<number | null>(null);

  protected readonly selected = computed<MyTask | null>(() => {
    const mine = this.myOpenTasks();
    if (!mine.length) return null;
    return mine.find((t) => t.task.task_id === this.selectedTaskId()) ?? mine[0];
  });

  /** Plain number (not a fresh object each time), so the reset effect below only fires when the task actually changes. */
  private readonly selectedTaskKey = computed(() => this.selected()?.task.task_id ?? null);

  protected readonly selectedForm = computed(() => this.cfg()?.forms.find((f) => f.id === this.selected()?.def?.form));
  protected readonly isDecisionTask = computed(() => !!this.selected() && this.run() && isFinalTask(this.run()!, this.selected()!.task));

  /** Bumped whenever a sub-form mutates its (non-signal) working data, so `problems` recomputes. */
  private readonly rev = signal(0);
  protected readonly taskData = signal<Record<string, unknown> | null>(null);

  protected readonly problems = computed(() => {
    this.rev();
    const f = this.selectedForm();
    const d = this.taskData();
    const a = this.app();
    if (!f || !d || !a || this.isDecisionTask()) return [];
    return taskFormProblems(f, d, a);
  });

  protected readonly saving = signal(false);
  protected readonly submitting = signal(false);

  protected readonly highlight = computed(() => {
    const q = Number(this.task());
    return q || this.selected()?.task.task_id || null;
  });

  protected readonly processing = computed(() => {
    const a = this.app();
    const cfg = this.cfg();
    if (!a?.workflow || !cfg) return null;
    return {
      days: processingDays(a, this.now),
      sla: slaFor(a, cfg.sla)?.processing_days ?? null,
      overdue: isProcessingOverdue(a, cfg.sla, this.now),
      complete: !!a.workflow.completed_on,
    };
  });

  /** Decision outcomes still allowed (the processing SLA removes "return"). */
  protected readonly allowedDecisionOutcomes = computed<WorkflowOutcome[]>(() => {
    const a = this.app();
    const cfg = this.cfg();
    if (!a || !cfg || !this.isDecisionTask()) return [];
    const def = this.selected()?.def;
    const overdue = this.processing()?.overdue;
    const outcomes = def?.decision?.outcomes ?? [];
    return overdue ? outcomes.filter((o) => o !== 'return') : outcomes;
  });

  protected readonly stationName = computed(() => {
    const a = this.app();
    const l = this.lookups();
    if (!a || !l) return '';
    return l.fireStations.find((d) => Number(d.id) === Number(a.district))?.stations.find((s) => String(s.id) === String(a.firestation))?.name ?? a.firestation;
  });

  protected readonly history = computed(() => [...(this.app()?.workflow_history ?? [])].reverse());

  /** Every task still pending (current or future stages), for the issuing authority to manage. */
  protected readonly pendingOfficers = computed<PendingRow[]>(() => {
    const run = this.run();
    if (!run || !this.isApprover()) return [];
    return currentTasks(run)
      .filter((t) => (t.state === 'active' || t.state === 'waiting') && !isFinalTask(run, t))
      .map((t) => ({ task: t, def: taskDefOf(run.stages, t.stage_key, t.task_key), isMine: t.assignee === this.me() }));
  });

  protected readonly canChangeFireStation = computed(() => {
    const a = this.app();
    const run = this.run();
    if (!a || !run || a.status_id !== 2) return false;
    return !run.tasks.some((t) => t.state === 'done' || t.state === 'skipped' || t.state === 'sent_back') && (this.myOpenTasks().length > 0 || this.isApprover());
  });

  protected readonly canUpdateLicAuth = computed(() => {
    const a = this.app();
    const run = this.run();
    if (!a || !run || (a.appl_type !== 'P' && a.appl_type !== 'O')) return false;
    return this.isDecisionTask() && (this.myOpenTasks().length > 0 || this.isApprover());
  });

  protected readonly canUploadOrSms = computed(() => (this.myOpenTasks().length > 0 || this.isApprover()) && !!this.run() && !this.run()!.completed_on);

  // --- generic action modal ---------------------------------------------------

  protected readonly modal = signal<ModalKind | null>(null);
  protected readonly modalBusy = signal(false);
  protected modalTask: PendingRow | null = null;
  protected comments = '';
  protected reassignTo = '';
  protected requestDocDesc = '';
  protected uploadFile: { name: string; size: number } | null = null;
  protected uploadDesc = '';
  protected smsMessage = '';
  protected newDistrict = 0;
  protected newStation = '';
  protected licAuth = '';
  protected licAddr = '';

  protected readonly districts = toSignal(this.lookupService.districts$, { initialValue: [] });
  protected readonly fireStations = toSignal(this.lookupService.fireStations$, { initialValue: [] as DistrictFireStations[] });

  /**
   * Plain methods (not `computed()`): `newDistrict` / `modalTask` are plain fields (bound with
   * `[(ngModel)]` or set from a click handler, not signals), so a `computed()` here would compute
   * once and never see later mutations. Zone.js re-runs change detection on every event, which is
   * enough to keep a plain method fresh in the template.
   */
  protected newStations(): { id: string; name: string }[] {
    return this.fireStations().find((d) => Number(d.id) === Number(this.newDistrict))?.stations ?? [];
  }

  protected reassignCandidates(): UserAccount[] {
    const role = this.modalTask?.task.role_id;
    if (!role) return [];
    return this.users().filter((u) => u.portal === 'dept' && u.active && u.deptRoleId === role && u.username !== this.modalTask?.task.assignee);
  }

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
    // reload the working data only when the selected task itself changes (not on every app refresh)
    effect(() => {
      const key = this.selectedTaskKey();
      untracked(() => this.resetTaskData(key));
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.dept.data().subscribe({
      next: ({ apps, cfg, users }) => {
        const app = apps.find((a) => a.appl_id === id);
        this.cfg.set(cfg);
        this.users.set(users);
        this.app.set(app ?? null);
        this.notFound.set(!app);
        this.loading.set(false);
        if (app) {
          this.dept.parentOf(app).subscribe((p) => this.parent.set(p));
          if (this.task()) this.selectedTaskId.set(Number(this.task()));
        }
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
    this.lookupService.config().subscribe((c) => this.renewalRules.set(c.renewalRules));
  }

  private resetTaskData(taskId: number | null): void {
    const sel = this.myOpenTasks().find((t) => t.task.task_id === taskId);
    const app = this.app();
    const form = this.cfg()?.forms.find((f) => f.id === sel?.def?.form);
    if (!sel || !app || !form || this.isDecisionTask()) {
      this.taskData.set(null);
      return;
    }
    const initial = initialTaskFormData(form, app, this.auth.session()?.displayName ?? this.me(), sel.task.start_date ?? app.applied_date);
    const saved = sel.task.data && Object.keys(sel.task.data).length ? sel.task.data : {};
    this.taskData.set({ ...initial, ...saved });
    this.rev.update((n) => n + 1);
  }

  protected selectTask(taskId: number): void {
    this.selectedTaskId.set(taskId);
  }

  protected isSelectedTask(taskId: number): boolean {
    return this.selected()?.task.task_id === taskId;
  }

  protected onFormChanged(): void {
    this.rev.update((n) => n + 1);
  }

  // Typed views of the generic `taskData` record for each structured form component (strictTemplates).
  protected sectionNoteData(): SectionNoteData {
    return this.taskData() as unknown as SectionNoteData;
  }

  protected inspectionReportData(): InspectionReportData {
    return this.taskData() as unknown as InspectionReportData;
  }

  protected committeeConcurrenceData(): CommitteeConcurrenceData {
    return this.taskData() as unknown as CommitteeConcurrenceData;
  }

  protected rfoNoteData(): RfoNoteData {
    return this.taskData() as unknown as RfoNoteData;
  }

  protected questionnaireData(): QuestionnaireData {
    return this.taskData() as unknown as QuestionnaireData;
  }

  private applyUpdated(a: Application, message: string): void {
    this.app.set(a);
    this.toast.success(message);
  }

  private reportError(e: unknown): void {
    this.toast.error(e instanceof Error ? e.message : 'Something went wrong.');
  }

  // --- my task: save / submit / send back -------------------------------------

  protected saveDraft(): void {
    const sel = this.selected();
    const data = this.taskData();
    if (!sel || !data) return;
    this.saving.set(true);
    this.dept.saveTask(this.app()!.appl_id, sel.task.task_id, this.me(), data).subscribe({
      next: (a) => {
        this.saving.set(false);
        this.applyUpdated(a, 'Draft saved.');
      },
      error: (e) => {
        this.saving.set(false);
        this.reportError(e);
      },
    });
  }

  protected submitTask(): void {
    const sel = this.selected();
    const data = this.taskData();
    if (!sel || !data) return;
    if (this.problems().length) {
      this.toast.error(`Complete the form before submitting (${this.problems().length} item(s) pending).`);
      return;
    }
    this.submitting.set(true);
    this.dept.submitTask(this.app()!.appl_id, sel.task.task_id, this.me(), data).subscribe({
      next: (a) => {
        this.submitting.set(false);
        this.applyUpdated(a, `${sel.task.name} submitted.`);
      },
      error: (e) => {
        this.submitting.set(false);
        this.reportError(e);
      },
    });
  }

  protected canSendBack(): boolean {
    return !!this.selected()?.def?.permissions.send_back;
  }

  protected onDecide(e: { outcome: WorkflowOutcome; input: DecisionInput }): void {
    const sel = this.selected();
    if (!sel) return;
    this.submitting.set(true);
    this.dept.decide(this.app()!.appl_id, sel.task.task_id, this.me(), e.outcome, e.input).subscribe({
      next: (a) => {
        this.submitting.set(false);
        this.applyUpdated(a, e.outcome === 'inspect' ? 'Inspection ordered.' : 'Decision submitted.');
      },
      error: (err) => {
        this.submitting.set(false);
        this.reportError(err);
      },
    });
  }

  // --- generic modal ------------------------------------------------------------

  protected openModal(kind: ModalKind, row: PendingRow | null = null): void {
    this.modalTask = row;
    this.comments = '';
    this.reassignTo = this.reassignCandidates()[0]?.username ?? '';
    this.requestDocDesc = '';
    this.uploadFile = null;
    this.uploadDesc = '';
    this.smsMessage = '';
    const a = this.app();
    this.newDistrict = a?.district ?? 0;
    this.newStation = '';
    this.licAuth = a?.lic_auth ?? '';
    this.licAddr = a?.lic_addr ?? '';
    this.modal.set(kind);
  }

  protected closeModal(): void {
    this.modal.set(null);
    this.modalTask = null;
  }

  protected onUploadFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const problem = validateUpload(file);
    if (problem) {
      this.toast.error(problem);
      return;
    }
    this.uploadFile = { name: file.name, size: file.size };
  }

  protected confirmModal(): void {
    const a = this.app();
    if (!a) return;
    const kind = this.modal();
    this.modalBusy.set(true);
    const done = (a2: Application, msg: string) => {
      this.modalBusy.set(false);
      this.closeModal();
      this.applyUpdated(a2, msg);
    };
    const fail = (e: unknown) => {
      this.modalBusy.set(false);
      this.reportError(e);
    };
    switch (kind) {
      case 'sendback': {
        const taskId = this.modalTask?.task.task_id ?? this.selected()?.task.task_id;
        if (!taskId) return;
        this.dept.sendBack(a.appl_id, taskId, this.me(), this.comments).subscribe({ next: (x) => done(x, 'Sent back to the previous stage.'), error: fail });
        return;
      }
      case 'bypass': {
        const taskId = this.modalTask?.task.task_id;
        if (!taskId) return;
        this.dept.skipTask(a.appl_id, taskId, this.me()).subscribe({ next: (x) => done(x, 'Officer bypassed.'), error: fail });
        return;
      }
      case 'reassign': {
        const taskId = this.modalTask?.task.task_id;
        if (!taskId || !this.reassignTo) return;
        this.dept.reassignTask(a.appl_id, taskId, this.me(), this.reassignTo).subscribe({ next: (x) => done(x, 'Officer changed.'), error: fail });
        return;
      }
      case 'request_doc': {
        this.dept.requestDocuments(a.appl_id, this.me(), this.requestDocDesc).subscribe({ next: (x) => done(x, 'Document requested from the applicant.'), error: fail });
        return;
      }
      case 'upload_doc': {
        if (!this.uploadFile) return;
        this.dept.uploadDocument(a.appl_id, this.me(), this.uploadFile.name, this.uploadDesc).subscribe({ next: (x) => done(x, 'Document uploaded.'), error: fail });
        return;
      }
      case 'sms': {
        this.dept.sendSms(a.appl_id, this.me(), this.smsMessage).subscribe({ next: (x) => done(x, 'SMS sent.'), error: fail });
        return;
      }
      case 'fire_station': {
        const name = this.districts().find((d) => d.id === Number(this.newDistrict))?.desc ?? '';
        this.dept.changeFireStation(a.appl_id, this.me(), Number(this.newDistrict), name, this.newStation).subscribe({ next: (x) => done(x, 'Fire station changed.'), error: fail });
        return;
      }
      case 'lic_auth': {
        this.dept.updateLicensingAuthority(a.appl_id, this.me(), this.licAuth, this.licAddr).subscribe({ next: (x) => done(x, 'Licensing authority updated.'), error: fail });
        return;
      }
      default:
        this.modalBusy.set(false);
    }
  }

  protected levelName(a: Application): string {
    return delegationLevelName(a.delegation_level);
  }

  protected workflowName(a: Application): string {
    const id = a.workflow?.definition_id;
    return this.cfg()?.workflows.find((w) => w.id === id)?.name ?? id ?? '—';
  }
}
