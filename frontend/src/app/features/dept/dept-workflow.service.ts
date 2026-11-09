import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ApiClient } from '../../core/api/api-client.service';
import { API_ENDPOINTS, ApiEndpoint } from '../../core/api/api-endpoints';
import { FeedbackSummary, feedbackSummary } from '../../core/domain/feedback';
import {
  changeFireStation,
  decide,
  DecisionInput,
  monitoredApplications,
  myTasks,
  reassignTask,
  requestDocuments,
  saveTask,
  sendBack,
  sendSms,
  skipTask,
  submitTask,
  TaskItem,
  updateLicensingAuthority,
  uploadDeptDocument,
  WorkflowContext,
} from '../../core/domain/workflow';
import { LookupService, WorkflowConfig } from '../../core/lookups/lookup.service';
import { Application, RenewalRule, UserAccount, WorkflowOutcome } from '../../core/models';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Everything a department page needs: the submitted applications, the accounts and the workflow configuration. */
export interface DeptData {
  apps: Application[];
  users: UserAccount[];
  cfg: WorkflowConfig;
}

interface OpContext {
  ctx: WorkflowContext;
  cfg: WorkflowConfig;
  renewalRules: RenewalRule[];
}

/**
 * Department-side data access (the new hqlist + process_move / sendback / reassign RPCs). Every
 * workflow operation is an atomic read-modify-write of the application store running the pure
 * engine in core/domain/workflow.ts, the way a server transaction would. Drafts are never visible.
 */
@Injectable({ providedIn: 'root' })
export class DeptWorkflowService {
  private readonly api = inject(ApiClient);
  private readonly lookups = inject(LookupService);
  private readonly accounts = inject(AccountsService);

  /** Submitted applications (drafts excluded). */
  applications(endpoint: ApiEndpoint = API_ENDPOINTS.deptQueue): Observable<Application[]> {
    return this.api.get<Application[]>(endpoint).pipe(map((apps) => apps.filter((a) => a.status_id > 1)));
  }

  data(endpoint: ApiEndpoint = API_ENDPOINTS.deptQueue): Observable<DeptData> {
    return forkJoin({ apps: this.applications(endpoint), users: this.accounts.list(), cfg: this.lookups.workflowConfig() });
  }

  /** One submitted application with its workflow run. */
  application(applId: number): Observable<Application> {
    return this.applications(API_ENDPOINTS.deptApplication).pipe(
      map((apps) => {
        const app = apps.find((a) => a.appl_id === applId);
        assert(app, 'Application not found.');
        return app;
      }),
    );
  }

  /** The application this one was carried forward from (for the certificate preview), if any. */
  parentOf(app: Pick<Application, 'parent_id'>): Observable<Application | null> {
    if (!app.parent_id) return of(null);
    return this.application(app.parent_id).pipe(catchError(() => of(null)));
  }

  /** Dashboard queues of an officer: his open tasks and the applications he monitors. */
  queues(username: string): Observable<DeptData & { me: UserAccount | undefined; tasks: TaskItem[]; monitored: Application[] }> {
    return this.data().pipe(
      map((d) => {
        const me = d.users.find((u) => u.username === username);
        return { ...d, me, tasks: myTasks(d.apps, username), monitored: me ? monitoredApplications(d.apps, me) : [] };
      }),
    );
  }

  /** Average citizen rating over the last `months` months (null = overall) — legacy Feedback_AvgRating.aspx. */
  feedback(months: number | null, now: Date = new Date()): Observable<FeedbackSummary> {
    return this.api.get<Application[]>(API_ENDPOINTS.deptFeedbackRatings).pipe(map((apps) => feedbackSummary(apps, months, now)));
  }

  // -------------------------------------------------------------------------
  // Workflow operations (used by the processing page — Phase 3b)
  // -------------------------------------------------------------------------

  private context(): Observable<OpContext> {
    return forkJoin({ users: this.accounts.list(), cfg: this.lookups.workflowConfig(), rules: this.lookups.config() }).pipe(
      map(({ users, cfg, rules }) => ({ ctx: { users, roles: cfg.roles }, cfg, renewalRules: rules.renewalRules })),
    );
  }

  private mutate(endpoint: ApiEndpoint, applId: number, fn: (app: Application, c: OpContext) => Application): Observable<Application> {
    return this.context().pipe(
      switchMap((c) => {
        let result: Application | undefined;
        return this.api
          .update<Application[]>(endpoint, (apps) => {
            const app = apps.find((a) => a.appl_id === applId);
            assert(app && app.status_id > 1, 'Application not found.');
            result = fn(app, c);
            return apps.map((a) => (a.appl_id === applId ? (result as Application) : a));
          })
          .pipe(map(() => result as Application));
      }),
    );
  }

  saveTask(applId: number, taskId: number, by: string, data: Record<string, unknown>): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptTaskSave, applId, (app) => saveTask(app, taskId, by, data));
  }

  submitTask(applId: number, taskId: number, by: string, data: Record<string, unknown>, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptTaskSubmit, applId, (app, c) => submitTask(app, taskId, by, data, c.ctx, now));
  }

  sendBack(applId: number, taskId: number, by: string, comments: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptSendBack, applId, (app, c) => sendBack(app, taskId, by, comments, c.ctx, now));
  }

  skipTask(applId: number, taskId: number, by: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptSkipTask, applId, (app, c) => skipTask(app, taskId, by, c.ctx, now));
  }

  reassignTask(applId: number, taskId: number, by: string, to: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptReassignTask, applId, (app, c) => reassignTask(app, taskId, by, to, c.ctx, now));
  }

  decide(applId: number, taskId: number, by: string, outcome: WorkflowOutcome, input: DecisionInput, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptDecision, applId, (app, c) =>
      decide(app, taskId, by, outcome, input, c.ctx, c.cfg.sla, c.renewalRules, now),
    );
  }

  requestDocuments(applId: number, by: string, fileDesc: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptRequestDocuments, applId, (app, c) => requestDocuments(app, by, fileDesc, c.ctx, now));
  }

  uploadDocument(applId: number, by: string, fileName: string, description: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptUploadDocument, applId, (app, c) => uploadDeptDocument(app, by, fileName, description, c.ctx, now));
  }

  sendSms(applId: number, by: string, message: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptSendSms, applId, (app, c) => sendSms(app, by, message, c.ctx, now));
  }

  changeFireStation(applId: number, by: string, district: number, distName: string, firestation: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptUpdateFireStation, applId, (app, c) => changeFireStation(app, by, district, distName, firestation, c.ctx, now));
  }

  updateLicensingAuthority(applId: number, by: string, licAuth: string, licAddr: string, now = new Date()): Observable<Application> {
    return this.mutate(API_ENDPOINTS.deptUpdateLicensingAuthority, applId, (app, c) => updateLicensingAuthority(app, by, licAuth, licAddr, c.ctx, now));
  }
}
