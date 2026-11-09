import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { renewalPeriodYears } from '../../../core/domain/application-rules';
import { formatLegacyDate, isoToLegacy, legacyToIso } from '../../../core/domain/dates';
import { validateUpload } from '../../../core/domain/documents';
import { DecisionInput, WorkflowContext, decisionPreviewApp, outcomeLabel } from '../../../core/domain/workflow';
import { WizardLookups } from '../../../core/lookups/lookup.service';
import { Application, RenewalRule, WorkflowOutcome } from '../../../core/models';
import { DeclarationLetter } from '../../../shared/certificates/declaration-letter';
import { NocOccupancy } from '../../../shared/certificates/noc-occupancy';
import { NocProvisional } from '../../../shared/certificates/noc-provisional';
import { NocRenewal } from '../../../shared/certificates/noc-renewal';
import { RejectionLetter } from '../../../shared/certificates/rejection-letter';
import { IconComponent } from '../../../shared/ui/icon';
import { ToastService } from '../../../shared/ui/toast.service';

/**
 * Final decision of the issuing authority — legacy dgfs_note / dgfs_note_o / dfs_note_r, plus a live
 * preview of the NOC / letter (Phase 2 certificate components) while the form is filled in. The
 * signed scanned document is mandatory to submit (simulated upload, metadata only).
 */
@Component({
  selector: 'app-final-decision-form',
  imports: [FormsModule, IconComponent, NocProvisional, NocOccupancy, NocRenewal, DeclarationLetter, RejectionLetter],
  templateUrl: './final-decision-form.html',
  styleUrl: './final-decision-form.scss',
})
export class FinalDecisionForm {
  private readonly toast = inject(ToastService);

  readonly app = input.required<Application>();
  readonly lookups = input.required<WizardLookups>();
  readonly parent = input<Application | null>(null);
  readonly ctx = input.required<WorkflowContext>();
  readonly renewalRules = input.required<RenewalRule[]>();
  readonly allowed = input.required<WorkflowOutcome[]>();
  readonly submitting = input(false);
  readonly decided = output<{ outcome: WorkflowOutcome; input: DecisionInput }>();

  protected readonly outcomeLabel = outcomeLabel;
  protected readonly outcome = signal<WorkflowOutcome | null>(null);
  protected readonly remark = signal('');
  protected readonly addcc = signal('');
  protected readonly remComm = signal('');
  protected readonly validFrom = signal('');
  protected readonly validTo = signal('');
  protected readonly signedDoc = signal<{ file_name: string; size?: number } | null>(null);

  protected readonly needsValidity = computed(() => this.outcome() === 'approve' && this.app().appl_type !== 'P');

  protected readonly previewApp = computed<Application | null>(() => {
    const o = this.outcome();
    if (!o) return null;
    const input: DecisionInput = {
      remark: this.remark(),
      addcc: this.addcc(),
      rem_comm: this.remComm(),
      valid_from: this.validFrom() || undefined,
      valid_to: this.validTo() || undefined,
      signed_document: this.signedDoc(),
    };
    return decisionPreviewApp(this.app(), o, input, this.ctx(), this.renewalRules(), new Date());
  });

  protected readonly problems = computed(() => {
    const o = this.outcome();
    if (!o) return ['Select a decision.'];
    if (o === 'inspect') return [];
    const out: string[] = [];
    if (!this.remark().trim()) out.push('Enter the remarks of the decision (they are printed on the NOC / letter).');
    if (!this.signedDoc()) out.push('Upload the signed copy of the NOC / letter.');
    return out;
  });

  protected selectOutcome(o: WorkflowOutcome): void {
    this.outcome.set(o);
    if (o === 'approve' && this.app().appl_type !== 'P' && !this.validFrom()) {
      const years = renewalPeriodYears(this.app(), this.renewalRules());
      const now = new Date();
      const to = new Date(now.getFullYear() + years, now.getMonth(), now.getDate() - 1);
      this.validFrom.set(formatLegacyDate(now));
      this.validTo.set(formatLegacyDate(to));
    }
  }

  protected validFromIso(): string {
    return legacyToIso(this.validFrom());
  }

  protected validToIso(): string {
    return legacyToIso(this.validTo());
  }

  protected setValidFrom(iso: string): void {
    this.validFrom.set(isoToLegacy(iso));
  }

  protected setValidTo(iso: string): void {
    this.validTo.set(isoToLegacy(iso));
  }

  protected onUpload(event: Event): void {
    const el = event.target as HTMLInputElement;
    const file = el.files?.[0];
    el.value = '';
    if (!file) return;
    const problem = validateUpload(file);
    if (problem) {
      this.toast.error(problem);
      return;
    }
    this.signedDoc.set({ file_name: file.name, size: file.size });
    this.toast.success(`${file.name} attached — it will be sent with the decision.`);
  }

  protected submit(): void {
    const o = this.outcome();
    if (!o || this.problems().length) return;
    this.decided.emit({
      outcome: o,
      input: {
        remark: this.remark().trim(),
        addcc: this.addcc().trim() || undefined,
        rem_comm: this.remComm().trim() || undefined,
        valid_from: this.validFrom() || undefined,
        valid_to: this.validTo() || undefined,
        signed_document: this.signedDoc(),
      },
    });
  }
}
