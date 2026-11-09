import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, map, switchMap } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { AccountsService, DeptUserInput } from '../../core/accounts/accounts.service';
import { LookupService } from '../../core/lookups/lookup.service';
import { DeptRole, District, DistrictFireStations, Region, UserAccount } from '../../core/models';
import { AdminService, OpenTask } from './admin.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { IconComponent } from '../../shared/ui/icon';
import { Modal } from '../../shared/ui/modal';
import { ToastService } from '../../shared/ui/toast.service';

/**
 * Admin: manage department users — Add, Modify (role, fire stations), Reset Password,
 * Deactivate/Reactivate. The fire stations decide which applications an officer works on: the
 * officers of a workflow are those of each role associated with the fire station of the property.
 * Deactivating an officer with open tasks requires moving them to another officer of the same role.
 */
@Component({
  selector: 'app-dept-users',
  imports: [FormsModule, IconComponent, Modal],
  templateUrl: './dept-users.html',
  styleUrl: './accounts.scss',
})
export class DeptUsers {
  private readonly accounts = inject(AccountsService);
  private readonly lookups = inject(LookupService);
  private readonly dialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly admin = inject(AdminService);

  protected readonly regions = toSignal(this.lookups.regions$, { initialValue: [] as Region[] });
  protected readonly fireStations = toSignal(this.lookups.fireStations$, { initialValue: [] as DistrictFireStations[] });
  protected readonly roles = toSignal(this.lookups.deptRoles$, { initialValue: [] as DeptRole[] });
  protected readonly districts = toSignal(this.lookups.districts$, { initialValue: [] as District[] });

  protected readonly all = signal<UserAccount[]>([]);
  protected readonly query = signal('');
  protected readonly roleFilter = signal('');
  protected readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();
    return this.all()
      .filter((a) => a.portal === 'dept')
      .filter((a) => !role || a.deptRoleId === role)
      .filter((a) => status === 'all' || (status === 'active' ? a.active : !a.active))
      .filter((a) => !q || `${a.displayName} ${a.username} ${a.email} ${a.mobile}`.toLowerCase().includes(q));
  });

  /** null = closed; 'new' = add; account = modify. */
  protected readonly editing = signal<UserAccount | 'new' | null>(null);
  protected form: DeptUserInput = this.emptyForm();
  /** Stations selected in the modal. */
  protected readonly stationSet = signal<Set<string>>(new Set());
  protected readonly allStations = signal(false);
  protected readonly stationFilter = signal('');
  protected readonly expanded = signal<Set<number>>(new Set());

  /** Deactivation with open tasks (null = closed). */
  protected readonly handover = signal<{ user: UserAccount; tasks: OpenTask[]; candidates: UserAccount[] } | null>(null);
  protected handoverTo = '';
  protected readonly formError = signal<string | null>(null);
  protected readonly issued = signal<{ username: string; password: string; reason: string } | null>(null);

  constructor() {
    this.reload();
  }

  private emptyForm(): DeptUserInput {
    return { username: '', displayName: '', email: '', mobile: '', deptRoleId: '', district: 0, stations: [], all_stations: false };
  }

  private reload(): void {
    this.accounts.list().subscribe((list) => this.all.set(list));
  }

  protected roleName(id?: string): string {
    const r = this.roles().find((x) => x.id === id);
    return r ? `${r.code} — ${r.name}` : id ?? '—';
  }

  protected roleCodeOf(id?: string): string {
    return this.roles().find((x) => x.id === id)?.code ?? id ?? '—';
  }

  protected roleLabel(id?: string): string {
    return this.roles().find((x) => x.id === id)?.name ?? '';
  }

  protected districtName(id?: number): string {
    return id ? this.districts().find((d) => d.id === id)?.desc ?? String(id) : 'HQ / State-wide';
  }

  /** Districts with their stations, filtered by the station search. */
  protected readonly stationGroups = computed(() => {
    const q = this.stationFilter().trim().toLowerCase();
    return this.fireStations()
      .map((d) => {
        const name = this.districtName(Number(d.id));
        const stations = d.stations.filter((s) => !q || s.name.toLowerCase().includes(q) || name.toLowerCase().includes(q));
        return { id: Number(d.id), name, all: d.stations, stations };
      })
      .filter((g) => g.stations.length);
  });

  protected selectedIn(all: { id: string }[]): number {
    const set = this.stationSet();
    return all.filter((s) => set.has(String(s.id))).length;
  }

  protected toggleStation(id: string, on: boolean): void {
    const next = new Set(this.stationSet());
    if (on) next.add(String(id));
    else next.delete(String(id));
    this.stationSet.set(next);
  }

  protected toggleDistrict(all: { id: string }[], on: boolean): void {
    const next = new Set(this.stationSet());
    for (const s of all) {
      if (on) next.add(String(s.id));
      else next.delete(String(s.id));
    }
    this.stationSet.set(next);
  }

  /** Adds every station of the districts of a region (RFOs). */
  protected selectRegion(districts: number[]): void {
    const next = new Set(this.stationSet());
    for (const d of this.fireStations().filter((x) => districts.includes(Number(x.id)))) d.stations.forEach((s) => next.add(String(s.id)));
    this.stationSet.set(next);
  }

  protected clearStations(): void {
    this.stationSet.set(new Set());
  }

  protected toggleExpanded(id: number): void {
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
  }

  /** "All fire stations" or "Krishna (all 21) · Guntur: Guntur-I". */
  protected stationSummary(a: UserAccount): string {
    if (a.all_stations) return 'All fire stations';
    const mine = new Set(a.stations ?? []);
    if (!mine.size) return 'None';
    const parts: string[] = [];
    for (const d of this.fireStations()) {
      const sel = d.stations.filter((s) => mine.has(String(s.id)));
      if (!sel.length) continue;
      const name = this.districtName(Number(d.id));
      parts.push(sel.length === d.stations.length ? `${name} (all ${sel.length})` : `${name}: ${sel.map((s) => s.name).join(', ')}`);
    }
    return parts.join(' · ');
  }

  protected get isNew(): boolean {
    return this.editing() === 'new';
  }

  private openStations(a?: UserAccount): void {
    this.stationSet.set(new Set(a?.stations ?? []));
    this.allStations.set(!!a?.all_stations);
    this.stationFilter.set('');
    const districts = new Set<number>();
    for (const d of this.fireStations()) if (d.stations.some((s) => (a?.stations ?? []).includes(String(s.id)))) districts.add(Number(d.id));
    this.expanded.set(districts);
  }

  protected openAdd(): void {
    this.form = this.emptyForm();
    this.openStations();
    this.formError.set(null);
    this.editing.set('new');
  }

  protected openEdit(a: UserAccount): void {
    this.form = {
      username: a.username,
      displayName: a.displayName,
      email: a.email,
      mobile: a.mobile,
      deptRoleId: a.deptRoleId ?? '',
      district: a.district ?? 0,
    };
    this.openStations(a);
    this.formError.set(null);
    this.editing.set(a);
  }

  protected save(): void {
    const target = this.editing();
    if (!target) return;
    const input = { ...this.form, district: Number(this.form.district) || 0, all_stations: this.allStations(), stations: this.allStations() ? [] : [...this.stationSet()] };
    if (target === 'new') {
      this.accounts.createDeptUser(input).subscribe({
        next: (r) => {
          this.editing.set(null);
          this.issued.set({ username: r.account.username, password: r.temporaryPassword, reason: 'Account created' });
          this.reload();
        },
        error: (e: Error) => this.formError.set(e.message),
      });
    } else {
      const { username: _ignored, ...patch } = input;
      void _ignored;
      this.accounts.updateDeptUser(target.id, patch).subscribe({
        next: () => {
          this.editing.set(null);
          this.toast.success(`User "${target.username}" updated.`);
          this.reload();
        },
        error: (e: Error) => this.formError.set(e.message),
      });
    }
  }

  protected async resetPassword(a: UserAccount): Promise<void> {
    const ok = await this.dialog.open({
      title: 'Reset password?',
      message: `A new temporary password will be generated for "${a.displayName}" (${a.username}). Their current password stops working immediately.`,
      confirmText: 'Reset Password',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    this.accounts.resetPassword(a.id).subscribe((r) => {
      this.issued.set({ username: r.account.username, password: r.temporaryPassword, reason: 'Password reset' });
    });
  }

  protected async toggleActive(a: UserAccount): Promise<void> {
    const deactivate = a.active;
    if (deactivate) {
      const tasks = await firstValueFrom(this.admin.openTasksOf(a.username));
      if (tasks.length) {
        const candidates = this.all().filter((u) => u.portal === 'dept' && u.active && u.id !== a.id && u.deptRoleId === a.deptRoleId);
        this.handoverTo = candidates[0]?.username ?? '';
        this.handover.set({ user: a, tasks, candidates });
        return;
      }
    }
    const ok = await this.dialog.open({
      title: deactivate ? 'Deactivate user?' : 'Reactivate user?',
      message: deactivate
        ? `"${a.displayName}" (${a.username}) will no longer be able to log in. No task is pending with this officer.`
        : `"${a.displayName}" (${a.username}) will be able to log in again. Tasks moved to other officers stay with them.`,
      confirmText: deactivate ? 'Deactivate' : 'Reactivate',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    this.accounts.setActive(a.id, !deactivate).subscribe(() => {
      this.toast.success(`User "${a.username}" ${deactivate ? 'deactivated' : 'reactivated'}.`);
      this.reload();
    });
  }

  /** Moves the open tasks to the chosen officer, then deactivates the user. */
  protected confirmHandover(): void {
    const h = this.handover();
    if (!h || !this.handoverTo) return;
    this.admin
      .reassignOpenTasks(h.user.username, this.handoverTo)
      .pipe(switchMap((moved) => this.accounts.setActive(h.user.id, false).pipe(map(() => moved))))
      .subscribe({
        next: (moved) => {
          this.handover.set(null);
          const to = this.all().find((u) => u.username === this.handoverTo)?.displayName ?? this.handoverTo;
          this.toast.success(`${moved} task(s) moved to ${to}; "${h.user.username}" deactivated.`);
          this.reload();
        },
        error: (e: Error) => this.toast.error(e.message),
      });
  }
}
