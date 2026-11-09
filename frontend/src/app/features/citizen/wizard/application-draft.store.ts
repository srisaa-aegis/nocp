import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';
import { API_ENDPOINTS, ApiEndpoint } from '../../../core/api/api-endpoints';
import { AuthService } from '../../../core/auth/auth.service';
import { newBlock, newDraft } from '../../../core/domain/application-factory';
import { FeeBreakdown, computeDelegationLevel, computeFee, nextId, saveProblem } from '../../../core/domain/application-rules';
import { formatLegacyDate } from '../../../core/domain/dates';
import { RequiredDocument, requiredDocuments, validateUpload } from '../../../core/domain/documents';
import { computeBlockFfe } from '../../../core/domain/ffe';
import { ValidationIssue, validateApplication } from '../../../core/domain/validation';
import { declarationLevel } from '../../../core/domain/workflow';
import { BlockStepId, WizardStep, WizardStepId, stepsFor } from '../../../core/domain/wizard-steps';
import { LookupService, WizardLookups } from '../../../core/lookups/lookup.service';
import { Application, ApplicationTypeCode, Block } from '../../../core/models';
import { ApplicationsService } from '../applications.service';

export type SaveState = 'new' | 'saved' | 'dirty' | 'saving' | 'error';

export interface SaveResult {
  ok: boolean;
  error?: string;
  /** Set when the application was created by this save (it had no id yet). */
  createdId?: number;
}

/**
 * Working copy + behaviour of the application being edited.
 *
 * Legacy model (applicationController.SaveApplication / ConfirmDoc):
 *  - **Save** may happen any number of times and only needs the Site Name and Site Address.
 *    A brand-new application exists only in the browser until its first save.
 *  - Validation messages are shown on the form at all times (legacy red fields) but never block
 *    moving between the pages of the application.
 *  - **Submit** validates everything; errors are listed, otherwise a single-page confirmation is
 *    shown and the application is submitted on confirmation.
 *
 * Derived values (FFE grid from the rule trees, approval level, fee, district name) are
 * recalculated on every change, exactly like the legacy pages recalculated on load/save.
 */
@Injectable()
export class ApplicationDraftStore {
  private readonly applications = inject(ApplicationsService);
  private readonly lookupService = inject(LookupService);
  private readonly auth = inject(AuthService);

  readonly app = signal<Application | null>(null);
  readonly lookups = signal<WizardLookups | null>(null);
  readonly loadError = signal<string | null>(null);
  readonly saveState = signal<SaveState>('saved');
  readonly lastSavedAt = signal<Date | null>(null);

  private readonly version = signal(0);
  /** Increments on every change to the working copy — depend on it in computeds that read mutable fields. */
  readonly changeCount = this.version.asReadonly();

  readonly isNew = computed(() => {
    this.version();
    return (this.app()?.appl_id ?? 0) === 0;
  });
  readonly dirty = computed(() => this.saveState() === 'dirty' || this.saveState() === 'new');

  readonly steps = computed<WizardStep[]>(() => {
    this.version();
    const a = this.app();
    return a ? stepsFor(a.appl_type) : [];
  });

  readonly issues = computed<ValidationIssue[]>(() => {
    this.version();
    const a = this.app();
    const l = this.lookups();
    return a && l ? validateApplication(a, l) : [];
  });

  readonly errors = computed(() => this.issues().filter((i) => i.severity === 'error'));

  readonly fee = computed<FeeBreakdown | null>(() => {
    this.version();
    const a = this.app();
    const l = this.lookups();
    return a && l ? computeFee(a, l.feeConfig) : null;
  });

  readonly requiredDocs = computed<RequiredDocument[]>(() => {
    this.version();
    const a = this.app();
    const l = this.lookups();
    return a && l ? requiredDocuments(a, l.documentRequirements) : [];
  });

  // -------------------------------------------------------------------------
  // Loading / saving
  // -------------------------------------------------------------------------

  /** Loads a saved application, or prepares a new unsaved one when `id` is "new". */
  async load(id: string, owner: string, newType?: ApplicationTypeCode): Promise<void> {
    this.loadError.set(null);
    try {
      const lookups = await firstValueFrom(this.lookupService.wizard().pipe(take(1)));
      this.lookups.set(lookups);
      if (id === 'new') {
        const account = await firstValueFrom(this.auth.currentAccount());
        if (!account || !newType) throw new Error('Application not found.');
        this.app.set(newDraft(0, newType, account, lookups.partyRoles, new Date(), lookups.occupancyConditions));
        this.saveState.set('new');
      } else {
        const app = await firstValueFrom(this.applications.get(Number(id), owner));
        if (app.status_id !== 1) {
          this.loadError.set('This application has been submitted and can no longer be edited.');
          return;
        }
        this.app.set(app);
        this.saveState.set('saved');
      }
      this.syncDerived();
      this.version.update((v) => v + 1);
    } catch (e) {
      this.loadError.set((e as Error).message || 'Application not found.');
    }
  }

  /** Call after any change to the working copy. */
  touch(): void {
    this.syncDerived();
    this.version.update((v) => v + 1);
    if (this.saveState() !== 'new') this.saveState.set('dirty');
  }

  /** Template helper: `(ngModelChange)="store.set(app, 'site_name', $event)"`. */
  set<T extends object, K extends keyof T>(target: T, key: K, value: T[K]): void {
    target[key] = value;
    this.touch();
  }

  /** Legacy Save: needs only the site name and address. Creates the application on its first save. */
  async save(endpoint: ApiEndpoint = API_ENDPOINTS.citizenApplicationUpdate): Promise<SaveResult> {
    const a = this.app();
    if (!a) return { ok: false, error: 'Application not loaded.' };
    const problem = saveProblem(a);
    if (problem) return { ok: false, error: problem };
    const wasNew = a.appl_id === 0;
    this.saveState.set('saving');
    try {
      const snapshot = JSON.parse(JSON.stringify(a)) as Application;
      const saved = await firstValueFrom(wasNew ? this.applications.createFromDraft(snapshot) : this.applications.save(snapshot, endpoint));
      a.appl_id = saved.appl_id;
      a.last_modified = saved.last_modified;
      this.lastSavedAt.set(new Date());
      this.saveState.set('saved');
      this.version.update((v) => v + 1);
      return { ok: true, createdId: wasNew ? saved.appl_id : undefined };
    } catch (e) {
      this.saveState.set('error');
      return { ok: false, error: (e as Error).message };
    }
  }

  /** Saves only when there are unsaved changes and the minimum (site name + address) is present. */
  async saveIfPossible(): Promise<SaveResult> {
    const a = this.app();
    if (!a || !this.dirty() || saveProblem(a)) return { ok: false };
    return this.save();
  }

  // -------------------------------------------------------------------------
  // Derived values kept in sync with the working copy
  // -------------------------------------------------------------------------

  private syncDerived(): void {
    const a = this.app();
    const l = this.lookups();
    if (!a || !l) return;
    a.dist_name = l.districts.find((d) => d.id === Number(a.district))?.desc ?? '';
    a.delegation_level = a.appl_type === 'D' ? declarationLevel(a) : computeDelegationLevel(a, l.delegationRules);
    for (const block of a.blocks) {
      block.ffe = computeBlockFfe(block, a.plot_area, a.perimeter, l.ffeRules, l.equipments, block.ffe);
    }
    if (a.payment.status !== 'paid') {
      a.payment.amount = computeFee(a, l.feeConfig).total;
    }
  }

  // -------------------------------------------------------------------------
  // Validation display (always visible, never blocking navigation)
  // -------------------------------------------------------------------------

  errorsFor(step: WizardStepId): ValidationIssue[] {
    return this.issues().filter((i) => i.step === step && i.severity === 'error');
  }

  warningsFor(step: WizardStepId): ValidationIssue[] {
    return this.issues().filter((i) => i.step === step && i.severity === 'warning');
  }

  /** Errors of one block (by index), optionally of one page of its flow. */
  blockErrorsFor(index: number, page?: BlockStepId): ValidationIssue[] {
    return this.issues().filter((i) => i.severity === 'error' && i.block === index && (!page || i.blockStep === page));
  }

  blockWarningsFor(index: number, page?: BlockStepId): ValidationIssue[] {
    return this.issues().filter((i) => i.severity === 'warning' && i.block === index && (!page || i.blockStep === page));
  }

  /** Position of a block in the application by its id (-1 when not found). */
  blockIndexOf(blockId: number): number {
    this.version();
    return this.app()?.blocks.findIndex((b) => b.block_id === Number(blockId)) ?? -1;
  }

  fieldError(field: string): string | null {
    return this.issues().find((i) => i.field === field && i.severity === 'error')?.message ?? null;
  }

  fieldWarning(field: string): string | null {
    return this.issues().find((i) => i.field === field && i.severity === 'warning')?.message ?? null;
  }

  /** Any error whose field starts with the given prefix (e.g. a block tab or table). */
  hasErrorUnder(prefix: string): boolean {
    return this.issues().some((i) => i.severity === 'error' && (i.field === prefix || i.field.startsWith(prefix + '.')));
  }

  // -------------------------------------------------------------------------
  // Blocks and their rows
  // -------------------------------------------------------------------------

  addBlock(blockType = 'N', name?: string): number {
    const a = this.app()!;
    const block = newBlock(nextId(a.blocks, (b) => b.block_id), blockType);
    if (name) block.block_name = name;
    a.blocks.push(block);
    this.touch();
    return a.blocks.length - 1;
  }

  removeBlock(index: number): void {
    const a = this.app()!;
    const [removed] = a.blocks.splice(index, 1);
    if (removed) {
      a.documents = a.documents.filter((d) => d.code.split(':')[1] !== String(removed.block_id));
    }
    this.touch();
  }

  addFloor(block: Block): void {
    const n = block.floors.filter((f) => f.flr_type === 'F').length + 1;
    const last = block.floors[block.floors.length - 1];
    const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
    block.floors.push({
      floor_id: nextId(block.floors, (f) => f.floor_id),
      flr_type: 'F',
      flr_name: `${n}${suffix} Floor`,
      built_area: last?.built_area ?? 0,
      occ_type: last?.occ_type ?? '',
      occ_c_app: last?.occ_c_app ?? 0,
      seats_num: 0,
    });
    this.touch();
  }

  removeFloor(block: Block, index: number): void {
    const [removed] = block.floors.splice(index, 1);
    const a = this.app()!;
    if (removed) {
      a.documents = a.documents.filter((d) => d.code !== `FloorPlan:${block.block_id}:${removed.floor_id}`);
    }
    this.touch();
  }

  /** Generic add for the block's row tables (escapes, exits, doors, lifts, refuges, car parks). */
  addRow<K extends 'escapes' | 'exits' | 'doors' | 'lifts' | 'refuges' | 'carparks'>(block: Block, list: K): void {
    const rows = block[list] as unknown as Record<string, unknown>[];
    const idKey = { escapes: 'escape_id', exits: 'exit_id', doors: 'door_id', lifts: 'lift_id', refuges: 'refuge_id', carparks: 'cpark_id' }[list];
    const id = rows.reduce((m, r) => Math.max(m, Number(r[idKey]) || 0), 0) + 1;
    const templates: Record<string, Record<string, unknown>> = {
      escapes: { etype: 'E', desc: 'External Staircase', width: 0, location: 'W' },
      exits: { ename: 'Entrance / Exit', width: 0, awidth: 0, direc: block.front_dir || 'E' },
      doors: { desc: '', width: 0, location: block.front_dir || 'E' },
      lifts: { ltype: 'F', lname: `Fire Lift ${id}`, capacity: 0 },
      refuges: { floor_id: block.floors[block.floors.length - 1]?.floor_id ?? 0, area: 0 },
      carparks: { floor: block.floors[0]?.flr_name ?? '', capacity: 0 },
    };
    rows.push({ [idKey]: id, ...templates[list] });
    this.touch();
  }

  removeRow(block: Block, list: 'escapes' | 'exits' | 'doors' | 'lifts' | 'refuges' | 'carparks', index: number): void {
    (block[list] as unknown[]).splice(index, 1);
    this.touch();
  }

  /** Legacy "Add Fire Fighting Equipment" (Occupancy): an item not required by the rules. */
  addEquipment(block: Block, equipId: number): void {
    const eq = this.lookups()?.equipments.find((e) => e.id === equipId);
    if (!eq || block.ffe.items.some((i) => i.equip_id === equipId)) return;
    const level: 'F' | 'B' = eq.level === 'F' ? 'F' : 'B';
    block.ffe.items.push({
      equip_id: equipId,
      level,
      floors: level === 'F' ? Object.fromEntries(block.floors.map((f) => [String(f.floor_id), { reqt: null, prop: null, prov: null }])) : {},
      block: { reqt: null, prop: null, prov: null },
      note_keys: [],
      added: true,
      remarks: '',
    });
    this.touch();
  }

  removeAddedEquipment(block: Block, equipId: number): void {
    block.ffe.items = block.ffe.items.filter((i) => !(i.added && i.equip_id === equipId && this.isNotRequired(i)));
    this.touch();
  }

  private isNotRequired(item: Block['ffe']['items'][number]): boolean {
    return item.block.reqt === null && Object.values(item.floors).every((c) => c.reqt === null);
  }

  // -------------------------------------------------------------------------
  // Documents (metadata only — binaries are never persisted in this stub build)
  // -------------------------------------------------------------------------

  async attachDocument(doc: RequiredDocument, file: { name: string; size: number; type?: string }): Promise<string | null> {
    const problem = validateUpload(file);
    if (problem) return problem;
    const a = this.app()!;
    a.documents = a.documents.filter((d) => d.code !== doc.code);
    a.documents.push({
      doc_id: nextId(a.documents, (d) => d.doc_id),
      code: doc.code,
      file_name: file.name,
      category: doc.blockName ? `${doc.label} (${doc.blockName})` : doc.label,
      uploaded_on: formatLegacyDate(new Date()),
      size: file.size,
    });
    this.touch();
    await this.saveIfPossible();
    return null;
  }

  async removeDocument(code: string): Promise<void> {
    const a = this.app()!;
    a.documents = a.documents.filter((d) => d.code !== code);
    this.touch();
    await this.saveIfPossible();
  }

  documentFor(code: string) {
    return this.app()?.documents.find((d) => d.code === code) ?? null;
  }

  // -------------------------------------------------------------------------
  // Payment (simulated PayU gateway / manual bank challan) — requires a saved application
  // -------------------------------------------------------------------------

  async payOnline(now: Date = new Date()): Promise<SaveResult> {
    const a = this.app()!;
    const problem = saveProblem(a);
    if (problem) return { ok: false, error: problem };
    a.payment = {
      ...a.payment,
      mode: 'online',
      amount: this.fee()?.total ?? a.payment.amount,
      status: 'paid',
      txn_ref: `PAYU${now.getTime().toString().slice(-10)}`,
      paid_on: formatLegacyDate(now),
    };
    this.touch();
    return this.save(API_ENDPOINTS.paymentInitiate);
  }

  async recordChallan(challan: { num: string; date: string; bank: string; branch: string }): Promise<string | null> {
    if (![challan.num, challan.date, challan.bank, challan.branch].every((v) => v && v.trim())) {
      return 'Enter the challan number, date, bank and branch.';
    }
    const a = this.app()!;
    a.payment = {
      ...a.payment,
      mode: 'challan',
      amount: this.fee()?.total ?? a.payment.amount,
      status: 'paid',
      challan_num: challan.num.trim(),
      challan_date: challan.date,
      challan_bnk: challan.bank.trim(),
      challan_brch: challan.branch.trim(),
      paid_on: challan.date,
    };
    this.touch();
    const r = await this.save();
    return r.ok ? null : r.error ?? 'Could not save the application.';
  }

  // -------------------------------------------------------------------------
  // Submit (legacy ConfirmDoc → confirm page → submitapplication.aspx)
  // -------------------------------------------------------------------------

  /** Step 1 of submission: save and validate everything. */
  async validateForSubmit(): Promise<{ ok: boolean; errors: ValidationIssue[]; error?: string }> {
    const saved = await this.save();
    if (!saved.ok) return { ok: false, errors: [], error: saved.error };
    const errors = this.errors();
    return { ok: errors.length === 0, errors };
  }

  /** Step 2 of submission (from the confirmation page): submit, number the application and start the workflow. */
  async submit(): Promise<{ ok: true; app: Application } | { ok: false; error: string }> {
    const a = this.app();
    const l = this.lookups();
    if (!a || !l) return { ok: false, error: 'Application not loaded.' };
    if (this.errors().length > 0) return { ok: false, error: `Please resolve ${this.errors().length} issue(s) before submitting.` };
    try {
      const submitted = await firstValueFrom(this.applications.submit(a, l.delegationRules));
      this.app.set(submitted);
      this.saveState.set('saved');
      return { ok: true, app: submitted };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
