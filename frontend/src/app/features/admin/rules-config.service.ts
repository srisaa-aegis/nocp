import { Injectable, inject } from '@angular/core';
import { Observable, defer, throwError } from 'rxjs';
import { ApiClient } from '../../core/api/api-client.service';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import { delegationRuleProblems, feeConfigProblems, renewalRuleProblems } from '../../core/domain/config-rules';
import { LookupService, RulesConfig } from '../../core/lookups/lookup.service';
import { DelegationRule, FeeConfig, RenewalRule } from '../../core/models';

/** Admin maintenance of the configurable rules (fees, approval levels, renewal periods). */
@Injectable({ providedIn: 'root' })
export class RulesConfigService {
  private readonly api = inject(ApiClient);
  private readonly lookups = inject(LookupService);

  load(): Observable<RulesConfig> {
    return this.lookups.config();
  }

  private checked<T>(problems: string[], save: () => Observable<T>): Observable<T> {
    return problems.length ? throwError(() => new Error(problems.join(' '))) : defer(save);
  }

  saveFees(config: FeeConfig): Observable<FeeConfig> {
    return this.checked(feeConfigProblems(config), () => this.api.save(API_ENDPOINTS.adminSaveFees, config));
  }

  saveDelegationRules(rules: DelegationRule[]): Observable<DelegationRule[]> {
    return this.checked(delegationRuleProblems(rules), () => this.api.save(API_ENDPOINTS.adminSaveDelegationRules, rules));
  }

  saveRenewalRules(rules: RenewalRule[]): Observable<RenewalRule[]> {
    return this.checked(renewalRuleProblems(rules), () => this.api.save(API_ENDPOINTS.adminSaveRenewalRules, rules));
  }
}
