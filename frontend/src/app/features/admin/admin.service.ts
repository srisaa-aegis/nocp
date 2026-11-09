import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, switchMap } from 'rxjs';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ApiClient } from '../../core/api/api-client.service';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { MockPersistenceService } from '../../core/api/mock-persistence.service';
import { toSummary } from '../../core/domain/application-rules';
import { daysSince } from '../../core/domain/dates';
import { dueEscalations, escalationEntry, overdueItems } from '../../core/domain/escalations';
import { currentTasks, reassignTask } from '../../core/domain/workflow';
import { LookupService } from '../../core/lookups/lookup.service';
import { Application, ApplicationSummary, EscalationLogEntry, EscalationNotice, WorkflowTask } from '../../core/models';

export interface EscalationPreview {
  /** Everything past its SLA. */
  overdue: EscalationNotice[];
  /** Items to notify now (not reminded within the reminder interval). */
  due: EscalationNotice[];
  last: EscalationLogEntry | null;
}

export interface OpenTask {
  appl_id: number;
  appl_number: string;
  site_name: string;
  task: WorkflowTask;
}

export interface AdminSearchQuery {
  text?: string;
  type?: string;
  statusId?: number | null;
  /** Only applications not modified for at least this many days. */
  staleDays?: number | null;
  /** Only drafts (status 1). */
  draftsOnly?: boolean;
}

export interface AdminSearchRow extends ApplicationSummary {
  days_idle: number | null;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiClient);
  private readonly mockPersistence = inject(MockPersistenceService);
  private readonly lookups = inject(LookupService);
  private readonly accounts = inject(AccountsService);

  /** Search every application, including citizens' drafts. */
  search(query: AdminSearchQuery, now: Date = new Date()): Observable<AdminSearchRow[]> {
    return this.api.get<Application[]>(API_ENDPOINTS.adminApplicationSearch).pipe(
      map((apps) =>
        apps
          .map((a) => ({ ...toSummary(a), days_idle: daysSince(a.last_modified, now) }))
          .filter((r) => {
            if (query.type && r.appl_type !== query.type) return false;
            if (query.statusId != null && r.status_id !== query.statusId) return false;
            if (query.draftsOnly && r.status_id !== 1) return false;
            if (query.staleDays != null && (r.days_idle == null || r.days_idle < query.staleDays)) return false;
            if (query.text) {
              const t = query.text.trim().toLowerCase();
              const hay = `${r.appl_id} ${r.appl_number} ${r.site_name} ${r.build_name} ${r.owner} ${r.dist_name}`.toLowerCase();
              if (!hay.includes(t)) return false;
            }
            return true;
          })
          .sort((a, b) => (b.days_idle ?? 0) - (a.days_idle ?? 0)),
      ),
    );
  }

  /** Deletes applications (mirrors deleteOldFiles.aspx) and unlinks parents of deleted children. */
  deleteApplications(ids: number[]): Observable<number> {
    const toDelete = new Set(ids);
    let removed = 0;
    return this.api
      .update<Application[]>(API_ENDPOINTS.adminApplicationDelete, (apps) => {
        const remaining = apps.filter((a) => !toDelete.has(a.appl_id));
        removed = apps.length - remaining.length;
        return remaining.map((a) => (toDelete.has(a.child_id) ? { ...a, child_id: 0 } : a));
      })
      .pipe(map(() => removed));
  }

  /** Escalations due now (legacy escalations.aspx — now based on the step / inspection / processing SLAs). */
  escalationPreview(now: Date = new Date()): Observable<EscalationPreview> {
    return forkJoin({
      apps: this.api.get<Application[]>(API_ENDPOINTS.adminApplicationSearch),
      cfg: this.lookups.workflowConfig(),
      users: this.accounts.list(),
      log: this.api.get<EscalationLogEntry[]>(API_ENDPOINTS.adminSendEscalations),
    }).pipe(
      map(({ apps, cfg, users, log }) => {
        const overdue = overdueItems(apps, cfg.sla, cfg.forms, users, now);
        return { overdue, due: dueEscalations(overdue, log, cfg.sla, now), last: log[log.length - 1] ?? null };
      }),
    );
  }

  /** Sends the reminders (simulated) and records them in the escalation log. */
  sendEscalations(now: Date = new Date()): Observable<EscalationLogEntry> {
    return this.escalationPreview(now).pipe(
      map((p) => escalationEntry(p.due, now)),
      switchMap((entry) =>
        this.api
          .update<EscalationLogEntry[]>(API_ENDPOINTS.adminSendEscalations, (log) => (entry.notices.length ? [...log, entry] : log))
          .pipe(map(() => entry)),
      ),
    );
  }

  /** Pending tasks (active, waiting or on demand) assigned to an officer, in applications still in process. */
  openTasksOf(username: string): Observable<OpenTask[]> {
    return this.api.get<Application[]>(API_ENDPOINTS.adminApplicationSearch).pipe(
      map((apps) =>
        apps.flatMap((a) =>
          a.workflow && !a.workflow.completed_on
            ? currentTasks(a.workflow)
                .filter((t) => t.assignee === username && (t.state === 'active' || t.state === 'waiting' || t.state === 'not_required'))
                .map((task) => ({ appl_id: a.appl_id, appl_number: a.appl_number, site_name: a.site_name, task }))
            : [],
        ),
      ),
    );
  }

  /** Moves every pending task of `from` to `to` (same role) — used when an officer is deactivated. */
  reassignOpenTasks(from: string, to: string, now: Date = new Date()): Observable<number> {
    return forkJoin({ users: this.accounts.list(), cfg: this.lookups.workflowConfig() }).pipe(
      switchMap(({ users, cfg }) => {
        let moved = 0;
        return this.api
          .update<Application[]>(API_ENDPOINTS.adminReassignTasks, (apps) =>
            apps.map((a) => {
              if (!a.workflow || a.workflow.completed_on) return a;
              let next = a;
              for (const t of currentTasks(a.workflow)) {
                if (t.assignee === from && (t.state === 'active' || t.state === 'waiting' || t.state === 'not_required')) {
                  next = reassignTask(next, t.task_id, 'admin', to, { users, roles: cfg.roles }, now, true);
                  moved++;
                }
              }
              return next;
            }),
          )
          .pipe(map(() => moved));
      }),
    );
  }

  /** Dev/demo-only utility: restores every mock collection to its original JSON seed. */
  resetDemoData(): void {
    this.mockPersistence.resetAll();
  }
}
