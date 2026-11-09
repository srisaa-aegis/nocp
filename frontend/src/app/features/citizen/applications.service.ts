import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, switchMap } from 'rxjs';
import { AccountsService } from '../../core/accounts/accounts.service';
import { archiveRun, declarationLevel, findDefinition, startRun } from '../../core/domain/workflow';
import { LookupService } from '../../core/lookups/lookup.service';
import { ApiClient } from '../../core/api/api-client.service';
import { API_ENDPOINTS, ApiEndpoint } from '../../core/api/api-endpoints';
import {
  canApplyForOccupancy,
  canApplyForRenewal,
  canDelete,
  canEdit,
  canRate,
  canRevise,
  saveProblem,
  computeDelegationLevel,
  nextApplicationNumber,
  nextId,
  toSummary,
} from '../../core/domain/application-rules';
import {
  newDraft,
  occupancyFromProvisional,
  processStep,
  renewalFromOccupancy,
} from '../../core/domain/application-factory';
import { formatLegacyDate } from '../../core/domain/dates';
import {
  Application,
  ApplicationSummary,
  ApplicationTypeCode,
  DelegationRule,
  OccupancyCondition,
  PartyRole,
  UploadedDocument,
  UserAccount,
} from '../../core/models';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Citizen-facing application data access over the single applications store.
 * Each method targets the catalog endpoint that mirrors the legacy RPC it
 * replaces (newapplication.aspx, update_application.aspx, submitapplication.aspx…),
 * and performs an atomic read-modify-write, the way a server transaction would.
 */
@Injectable({ providedIn: 'root' })
export class ApplicationsService {
  private readonly api = inject(ApiClient);
  private readonly lookups = inject(LookupService);
  private readonly accounts = inject(AccountsService);

  private all(endpoint: ApiEndpoint = API_ENDPOINTS.citizenApplicationList): Observable<Application[]> {
    return this.api.get<Application[]>(endpoint);
  }

  /** "My Applications" — newest first. */
  listMine(owner: string): Observable<ApplicationSummary[]> {
    return this.all().pipe(
      map((apps) =>
        apps
          .filter((a) => a.owner === owner)
          .map(toSummary)
          .sort((a, b) => b.appl_id - a.appl_id),
      ),
    );
  }

  /** Full aggregate; errors if missing or (when `owner` is given) not owned by that citizen. */
  get(applId: number, owner?: string): Observable<Application> {
    return this.all(API_ENDPOINTS.citizenApplicationDetail).pipe(
      map((apps) => {
        const app = apps.find((a) => a.appl_id === applId);
        assert(app && (!owner || app.owner === owner), 'Application not found.');
        return app;
      }),
    );
  }

  private transaction<R>(endpoint: ApiEndpoint, fn: (apps: Application[]) => { apps: Application[]; result: R }): Observable<R> {
    let result: R | undefined;
    return this.api
      .update<Application[]>(endpoint, (apps) => {
        const out = fn(apps);
        result = out.result;
        return out.apps;
      })
      .pipe(map(() => result as R));
  }

  private replace(apps: Application[], app: Application): Application[] {
    return apps.map((a) => (a.appl_id === app.appl_id ? app : a));
  }

  createDraft(type: ApplicationTypeCode, owner: UserAccount, partyRoles: PartyRole[]): Observable<Application> {
    return this.transaction(API_ENDPOINTS.citizenApplicationCreate, (apps) => {
      const draft = newDraft(nextId(apps, (a) => a.appl_id), type, owner, partyRoles);
      return { apps: [...apps, draft], result: draft };
    });
  }

  /**
   * First save of a new application (legacy newapplication.aspx with appl_id 0): requires only the
   * site name and address, assigns the application id and stores it as a draft.
   */
  createFromDraft(draft: Application): Observable<Application> {
    return this.transaction(API_ENDPOINTS.citizenApplicationCreate, (apps) => {
      const problem = saveProblem(draft);
      assert(!problem, problem ?? '');
      const created: Application = { ...draft, appl_id: nextId(apps, (a) => a.appl_id), status_id: 1, last_modified: formatLegacyDate(new Date()) };
      return { apps: [...apps, created], result: created };
    });
  }

  createOccupancyFromProvisional(parentId: number, owner: string, conditions: OccupancyCondition[] = []): Observable<Application> {
    return this.carryForward(API_ENDPOINTS.citizenOccupancyFromProvisional, parentId, owner, (p) => {
      assert(canApplyForOccupancy(toSummary(p)), 'An Occupancy application can only be made from an issued Provisional NOC that has none yet.');
    }, (parent, id) => occupancyFromProvisional(parent, id, new Date(), conditions));
  }

  createRenewalFromOccupancy(parentId: number, owner: string): Observable<Application> {
    return this.carryForward(API_ENDPOINTS.citizenRenewalFromOccupancy, parentId, owner, (p) => {
      assert(canApplyForRenewal(toSummary(p)), 'A Renewal can only be made from an issued Occupancy NOC or Renewal that has none yet.');
    }, renewalFromOccupancy);
  }

  private carryForward(
    endpoint: ApiEndpoint,
    parentId: number,
    owner: string,
    check: (parent: Application) => void,
    make: (parent: Application, id: number) => Application,
  ): Observable<Application> {
    return this.transaction(endpoint, (apps) => {
      const parent = apps.find((a) => a.appl_id === parentId && a.owner === owner);
      assert(parent, 'Application not found.');
      check(parent);
      const child = make(parent, nextId(apps, (a) => a.appl_id));
      const updatedParent = { ...parent, child_id: child.appl_id };
      return { apps: [...this.replace(apps, updatedParent), child], result: child };
    });
  }

  /** Saves a draft (legacy SaveApplication). Only drafts are editable, exactly like legacy CannotEdit(). */
  save(app: Application, endpoint: ApiEndpoint = API_ENDPOINTS.citizenApplicationUpdate): Observable<Application> {
    return this.transaction(endpoint, (apps) => {
      const current = apps.find((a) => a.appl_id === app.appl_id);
      assert(current, 'Application not found.');
      assert(canEdit(current), 'Only draft applications can be edited.');
      const problem = saveProblem(app);
      assert(!problem, problem ?? '');
      const saved: Application = { ...app, last_modified: formatLegacyDate(new Date()) };
      return { apps: this.replace(apps, saved), result: saved };
    });
  }

  /**
   * Submits a (validated) draft: assigns the application number and approval level, stamps the
   * applied date, starts the department workflow configured for its type × level (officers of the
   * fire station) and appends the process log.
   */
  submit(app: Application, delegationRules: DelegationRule[], now: Date = new Date()): Observable<Application> {
    return forkJoin({ cfg: this.lookups.workflowConfig(), users: this.accounts.list() }).pipe(
      switchMap(({ cfg, users }) =>
        this.transaction(API_ENDPOINTS.citizenApplicationSubmit, (apps) => {
          const current = apps.find((a) => a.appl_id === app.appl_id);
          assert(current && current.status_id === 1, 'Only draft applications can be submitted.');
          assert(app.payment.status === 'paid', 'The fee has not been paid.');
          assert(app.declaration_accepted, 'The declaration has not been accepted.');
          const level = app.appl_type === 'D' ? declarationLevel(app, apps) : computeDelegationLevel(app, delegationRules);
          const def = findDefinition(cfg.workflows, app.appl_type, level);
          assert(def, `No department workflow is configured for this application type at the ${level} level.`);
          let submitted: Application = {
            ...app,
            appl_number: app.appl_number || nextApplicationNumber(apps.map((a) => a.appl_number), now),
            applied_date: formatLegacyDate(now),
            last_modified: formatLegacyDate(now),
            delegation_level: level,
          };
          submitted = startRun(submitted, def, { users, roles: cfg.roles }, now);
          submitted.processLog = [
            ...app.processLog,
            processStep(
              submitted,
              app.revision > 1 ? 'Resubmitted' : 'Submitted',
              app.revision > 1 ? `Revision ${app.revision} submitted by the applicant.` : 'Application submitted by the applicant.',
              { name: app.build_name, role: 'Applicant' },
              now,
            ),
          ];
          return { apps: this.replace(apps, submitted), result: submitted };
        }),
      ),
    );
  }

  /** Reopens a returned (8) / rejected (9) application as a new revision (legacy revise.aspx). */
  revise(applId: number, owner: string, now: Date = new Date()): Observable<Application> {
    return this.transaction(API_ENDPOINTS.citizenApplicationRevise, (apps) => {
      const current = apps.find((a) => a.appl_id === applId && a.owner === owner);
      assert(current, 'Application not found.');
      assert(canRevise(current), 'Only returned or rejected applications can be revised.');
      const revised: Application = {
        ...archiveRun(current),
        status_id: 1,
        revision: current.revision + 1,
        final_date: '',
        reviewer: '',
        declaration_accepted: false,
        last_modified: formatLegacyDate(now),
      };
      revised.processLog = [
        ...current.processLog,
        processStep(revised, 'Revision started', `Revision ${revised.revision} opened by the applicant.`, { name: current.build_name, role: 'Applicant' }, now),
      ];
      return { apps: this.replace(apps, revised), result: revised };
    });
  }

  /** Deletes a draft and unlinks it from its parent (if it was carried forward). */
  deleteDraft(applId: number, owner: string): Observable<ApplicationSummary[]> {
    return this.transaction(API_ENDPOINTS.citizenApplicationDelete, (apps) => {
      const current = apps.find((a) => a.appl_id === applId && a.owner === owner);
      assert(current, 'Application not found.');
      assert(canDelete(current), 'Only first-revision draft applications can be deleted.');
      const remaining = apps
        .filter((a) => a.appl_id !== applId)
        .map((a) => (a.child_id === applId ? { ...a, child_id: 0 } : a));
      return {
        apps: remaining,
        result: remaining.filter((a) => a.owner === owner).map(toSummary).sort((a, b) => b.appl_id - a.appl_id),
      };
    });
  }

  /** Responds to a department document request (legacy UploadRequestDocs). */
  uploadRequestedDocument(
    applId: number,
    owner: string,
    fileid: number,
    file: { name: string; size: number },
    comment: string,
    now: Date = new Date(),
  ): Observable<Application> {
    return this.transaction(API_ENDPOINTS.citizenRequestedDocUpload, (apps) => {
      const current = apps.find((a) => a.appl_id === applId && a.owner === owner);
      assert(current, 'Application not found.');
      const request = current.deptfiles.find((f) => f.fileid === fileid);
      assert(request && request.status === 'R', 'This document request is no longer open.');
      const doc: UploadedDocument = {
        doc_id: nextId(current.documents, (d) => d.doc_id),
        code: `Requested:${request.file_name}`,
        file_name: file.name,
        category: request.file_desc,
        uploaded_on: formatLegacyDate(now),
        size: file.size,
      };
      const updated: Application = {
        ...current,
        last_modified: formatLegacyDate(now),
        documents: [...current.documents, doc],
        deptfiles: current.deptfiles.map((f) => (f.fileid === fileid ? { ...f, status: 'U' as const, citizen_comment: comment } : f)),
      };
      updated.processLog = [
        ...current.processLog,
        processStep(updated, 'Requested document uploaded', `${request.file_desc}${comment ? ' — ' + comment : ''}`, { name: current.build_name, role: 'Applicant' }, now),
      ];
      return { apps: this.replace(apps, updated), result: updated };
    });
  }

  /** Citizen rating of a completed application (legacy savefeedback.aspx). */
  saveFeedback(applId: number, owner: string, rating: number, remarks: string, now: Date = new Date()): Observable<Application> {
    return this.transaction(API_ENDPOINTS.citizenFeedbackSave, (apps) => {
      const current = apps.find((a) => a.appl_id === applId && a.owner === owner);
      assert(current, 'Application not found.');
      assert(canRate(current), 'Only completed applications can be rated.');
      assert(rating >= 1 && rating <= 5, 'Please provide a rating (1 to 5 stars) before submitting.');
      assert(remarks.trim().length > 0, 'Please enter a description before submitting.');
      const updated: Application = { ...current, feedback: { rating, remarks: remarks.trim(), rated_on: formatLegacyDate(now) } };
      return { apps: this.replace(apps, updated), result: updated };
    });
  }

  // Business-rule helpers re-exported for templates/components.
  readonly canApplyForOccupancy = canApplyForOccupancy;
  readonly canApplyForRenewal = canApplyForRenewal;
  readonly canRevise = canRevise;
  readonly canDelete = canDelete;
  readonly canEdit = canEdit;
  readonly canRate = canRate;

  summarize(list: ApplicationSummary[]): { total: number; inProgress: number; approved: number; needsAttention: number } {
    return {
      total: list.length,
      inProgress: list.filter((a) => a.status_id >= 1 && a.status_id <= 6).length,
      approved: list.filter((a) => a.status_id === 7).length,
      needsAttention: list.filter((a) => a.status_id === 8 || a.status_id === 9 || a.pending_requests > 0).length,
    };
  }
}

export const applicationListFilter = (
  list: ApplicationSummary[],
  query: { type?: string; statusId?: number; text?: string },
): ApplicationSummary[] =>
  list.filter((a) => {
    if (query.type && a.appl_type !== query.type) return false;
    if (query.statusId != null && a.status_id !== query.statusId) return false;
    if (query.text) {
      const t = query.text.toLowerCase();
      const hay = `${a.appl_number} ${a.site_name} ${a.build_name} ${a.dist_name} ${a.site_addr}`.toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  });
