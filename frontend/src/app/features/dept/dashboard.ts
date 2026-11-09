import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { FeedbackSummary } from '../../core/domain/feedback';
import {
  isProcessingOverdue,
  processingDays,
  roleCode,
  slaFor,
  taskDaysPending,
  taskSlaDays,
} from '../../core/domain/workflow';
import { LookupService, WorkflowConfig } from '../../core/lookups/lookup.service';
import { Application, DelegationLevel, UserAccount, WorkflowTask } from '../../core/models';
import { ApplTypeBadge } from '../../shared/ui/appl-type-badge';
import { IconComponent } from '../../shared/ui/icon';
import { StarRating } from '../../shared/ui/star-rating';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { DeptWorkflowService } from './dept-workflow.service';

export interface TaskRow {
  app: Application;
  task: WorkflowTask;
  action: string;
  days: number;
  sla: number;
  overdue: boolean;
  station: string;
}

export interface MonitorRow {
  app: Application;
  station: string;
  days: number;
  sla: number | null;
  overdue: boolean;
  complete: boolean;
}

/**
 * Department dashboard (legacy modules/dept/applications.aspx + RoleStatuses.txt, now derived from the
 * workflow runs): "My tasks" — the open tasks assigned to the officer — and "Monitoring" — every
 * application whose workflow involves the officer, grouped by the stage reached.
 */
@Component({
  selector: 'app-dept-dashboard',
  imports: [ApplTypeBadge, IconComponent, StarRating, StatusBadge, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly lookups = inject(LookupService);
  private readonly dept = inject(DeptWorkflowService);
  private readonly toast = inject(ToastService);

  protected readonly session = this.auth.session;
  protected readonly loading = signal(true);

  private readonly me = signal<UserAccount | undefined>(undefined);
  private readonly cfg = signal<WorkflowConfig | null>(null);
  protected readonly taskRowsAll = signal<TaskRow[]>([]);
  private readonly monitorRowsAll = signal<MonitorRow[]>([]);

  private readonly stationNames = toSignal(
    this.lookups.fireStations$.pipe(map((d) => new Map(d.flatMap((x) => x.stations.map((s) => [String(s.id), s.name] as const))))),
    { initialValue: new Map<string, string>() },
  );

  // Filters (both lists)
  protected readonly text = signal('');
  protected readonly type = signal('');
  protected readonly level = signal<DelegationLevel | ''>('');
  protected readonly stage = signal<string>('');
  protected readonly showCompleted = signal(false);

  protected readonly roleLabel = computed(() => {
    const me = this.me();
    const cfg = this.cfg();
    if (!me || !cfg) return '';
    const role = cfg.roles.find((r) => r.id === me.deptRoleId);
    return role ? `${role.code} · ${role.name}` : '';
  });

  protected readonly jurisdiction = computed(() => {
    const me = this.me();
    if (!me) return '';
    if (me.all_stations) return 'All fire stations';
    const names = (me.stations ?? []).map((s) => this.stationNames().get(s) ?? s);
    return names.length ? `Fire stations: ${names.join(', ')}` : 'No fire station associated';
  });

  private matches(app: Application): boolean {
    if (this.type() && app.appl_type !== this.type()) return false;
    if (this.level() && app.delegation_level !== this.level()) return false;
    const q = this.text().trim().toLowerCase();
    if (q) {
      const hay = `${app.appl_number} ${app.site_name} ${app.build_name} ${app.dist_name} ${app.site_addr}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  protected readonly taskRows = computed(() => this.taskRowsAll().filter((r) => this.matches(r.app)));

  /** My tasks grouped by the task (one card per kind of work). */
  protected readonly taskGroups = computed(() => {
    const groups = new Map<string, TaskRow[]>();
    for (const r of this.taskRows()) groups.set(r.task.name, [...(groups.get(r.task.name) ?? []), r]);
    return [...groups.entries()].map(([name, rows]) => ({ name, rows }));
  });

  protected readonly overdueTasks = computed(() => this.taskRowsAll().filter((r) => r.overdue).length);

  private readonly monitorFiltered = computed(() =>
    this.monitorRowsAll().filter((r) => this.matches(r.app) && (this.showCompleted() || !r.complete)),
  );

  /** Stage chips (legacy role-status queues) with counts. */
  protected readonly stages = computed(() => {
    const counts = new Map<string, number>();
    for (const r of this.monitorFiltered()) {
      const label = r.app.stage_label || 'Submitted';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count }));
  });

  protected readonly monitorRows = computed(() => {
    const s = this.stage();
    return this.monitorFiltered().filter((r) => !s || (r.app.stage_label || 'Submitted') === s);
  });

  protected readonly inProcess = computed(() => this.monitorRowsAll().filter((r) => !r.complete).length);
  protected readonly processingOverdue = computed(() => this.monitorRowsAll().filter((r) => r.overdue).length);

  /** Citizen feedback panel (legacy GetAvgRating(months)). */
  protected readonly feedbackMonths = signal<number | null>(null);
  protected readonly feedback = signal<FeedbackSummary | null>(null);
  protected readonly periods: { label: string; months: number | null }[] = [
    { label: 'Last month', months: 1 },
    { label: '3 months', months: 3 },
    { label: '6 months', months: 6 },
    { label: '12 months', months: 12 },
    { label: 'Overall', months: null },
  ];
  protected readonly round = Math.round;

  constructor() {
    this.loadFeedback(this.feedbackMonths());
    this.load();
  }

  protected loadFeedback(months: number | null): void {
    this.feedbackMonths.set(months);
    this.dept.feedback(months).subscribe((f) => this.feedback.set(f));
  }

  private load(now = new Date()): void {
    const username = this.session()?.username ?? '';
    this.dept.queues(username).subscribe({
      next: ({ me, tasks, monitored, cfg }) => {
        this.me.set(me);
        this.cfg.set(cfg);
        const station = (a: Application) => this.stationNames().get(String(a.firestation)) ?? a.firestation;
        this.taskRowsAll.set(
          tasks.map(({ app, task, action_label }) => {
            const sla = taskSlaDays(app.workflow!, task, cfg.sla, cfg.forms);
            const days = taskDaysPending(task, now);
            return { app, task, action: action_label, days, sla, overdue: days > sla, station: station(app) };
          }),
        );
        this.monitorRowsAll.set(
          monitored
            .map((app) => ({
              app,
              station: station(app),
              days: processingDays(app, now),
              sla: slaFor(app, cfg.sla)?.processing_days ?? null,
              overdue: isProcessingOverdue(app, cfg.sla, now),
              complete: !!app.workflow?.completed_on,
            }))
            .sort((x, y) => Number(x.complete) - Number(y.complete) || y.days - x.days),
        );
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load the department queues.');
      },
    });
  }

  protected roleOf(task: WorkflowTask): string {
    return roleCode(task.role_id, this.cfg()?.roles ?? []);
  }

  protected clearFilters(): void {
    this.text.set('');
    this.type.set('');
    this.level.set('');
    this.stage.set('');
  }
}
