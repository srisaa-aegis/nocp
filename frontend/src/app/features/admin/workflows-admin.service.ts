import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, switchMap, take, throwError } from 'rxjs';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ApiClient } from '../../core/api/api-client.service';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { formatLegacyDate } from '../../core/domain/dates';
import { definitionProblems, slaProblems, workflowSetProblems } from '../../core/domain/workflow';
import { LookupService } from '../../core/lookups/lookup.service';
import {
  Application,
  DeptRole,
  District,
  DistrictFireStations,
  FormDef,
  Region,
  SlaConfig,
  UserAccount,
  WorkflowDefinition,
} from '../../core/models';

export interface WorkflowAdminData {
  workflows: WorkflowDefinition[];
  defaults: WorkflowDefinition[];
  sla: SlaConfig;
  forms: FormDef[];
  roles: DeptRole[];
  regions: Region[];
  users: UserAccount[];
  districts: District[];
  fireStations: DistrictFireStations[];
  /** Applications per workflow id → version → count (current runs only). */
  usage: Record<string, Record<number, { total: number; inProcess: number }>>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Admin → Workflows and Admin → SLA & Escalations (config/workflows.json, config/sla.json). */
@Injectable({ providedIn: 'root' })
export class WorkflowsAdminService {
  private readonly api = inject(ApiClient);
  private readonly lookups = inject(LookupService);
  private readonly accounts = inject(AccountsService);

  load(): Observable<WorkflowAdminData> {
    return forkJoin({
      workflows: this.api.get<WorkflowDefinition[]>(API_ENDPOINTS.configWorkflows),
      defaults: this.api.get<WorkflowDefinition[]>(API_ENDPOINTS.configWorkflowsDefault),
      sla: this.api.get<SlaConfig>(API_ENDPOINTS.configSla),
      forms: this.lookups.forms$.pipe(take(1)),
      roles: this.lookups.deptRoles$.pipe(take(1)),
      regions: this.lookups.regions$.pipe(take(1)),
      districts: this.lookups.districts$.pipe(take(1)),
      fireStations: this.lookups.fireStations$.pipe(take(1)),
      users: this.accounts.list(),
      apps: this.api.get<Application[]>(API_ENDPOINTS.adminApplicationSearch),
    }).pipe(
      map(({ apps, ...d }) => {
        const usage: WorkflowAdminData['usage'] = {};
        for (const a of apps) {
          const run = a.workflow;
          if (!run) continue;
          const byVersion = (usage[run.definition_id] ??= {});
          const u = (byVersion[run.version] ??= { total: 0, inProcess: 0 });
          u.total++;
          if (!run.completed_on) u.inProcess++;
        }
        return { ...d, usage };
      }),
    );
  }

  /**
   * Saves one workflow: validates it (and the whole set), bumps the version and stamps the editor.
   * Applications already in process keep the snapshot they started with.
   */
  save(def: WorkflowDefinition, by: string, now: Date = new Date()): Observable<WorkflowDefinition> {
    return forkJoin({ roles: this.lookups.deptRoles$.pipe(take(1)), forms: this.lookups.forms$.pipe(take(1)) }).pipe(
      switchMap(({ roles, forms }) => {
        let saved: WorkflowDefinition | undefined;
        return this.api
          .update<WorkflowDefinition[]>(API_ENDPOINTS.adminSaveWorkflows, (list) => {
            const current = list.find((w) => w.id === def.id);
            assert(current, 'Workflow not found.');
            assert(def.appl_type === current.appl_type && def.level === current.level, 'The application type and level of a workflow cannot be changed.');
            const problems = definitionProblems(def, roles, forms);
            assert(!problems.length, problems.join(' '));
            saved = { ...def, version: current.version + 1, updated_on: formatLegacyDate(now), updated_by: by };
            const next = list.map((w) => (w.id === def.id ? saved! : w));
            const setProblems = workflowSetProblems(next, roles, forms);
            assert(!setProblems.length, setProblems.join(' '));
            return next;
          })
          .pipe(map(() => saved!));
      }),
    );
  }

  saveSla(sla: SlaConfig): Observable<SlaConfig> {
    return this.api.get<WorkflowDefinition[]>(API_ENDPOINTS.configWorkflows).pipe(
      switchMap((defs) => {
        const problems = slaProblems(sla, defs);
        return problems.length ? throwError(() => new Error(problems.join(' '))) : this.api.save(API_ENDPOINTS.adminSaveSla, sla);
      }),
    );
  }
}
