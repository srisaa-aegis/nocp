import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LookupService } from '../../core/lookups/lookup.service';
import { ApplicationType } from '../../core/models';
import { ApplTypeBadge } from '../../shared/ui/appl-type-badge';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { IconComponent } from '../../shared/ui/icon';
import { StatusBadge } from '../../shared/ui/status-badge';
import { ToastService } from '../../shared/ui/toast.service';
import { AdminSearchQuery, AdminSearchRow, AdminService } from './admin.service';

/**
 * Admin "Search & Delete" — replaces the legacy stale draft-files grid
 * (draftfiles.htm + deleteOldFiles.aspx) with a filterable search over every
 * application and single/bulk deletion.
 */
@Component({
  selector: 'app-admin-applications',
  imports: [FormsModule, ApplTypeBadge, StatusBadge, IconComponent],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
})
export class AdminApplications {
  private readonly adminService = inject(AdminService);
  private readonly lookups = inject(LookupService);
  private readonly dialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  protected readonly applicationTypes = toSignal(this.lookups.applicationTypes$, { initialValue: [] as ApplicationType[] });

  protected text = '';
  protected type = '';
  protected status = '';
  protected draftsOnly = false;
  protected staleDays: number | null = null;

  protected readonly results = signal<AdminSearchRow[]>([]);
  protected readonly searched = signal(false);
  protected readonly loading = signal(false);
  protected readonly selected = signal<Set<number>>(new Set());

  protected readonly allSelected = computed(
    () => this.results().length > 0 && this.results().every((r) => this.selected().has(r.appl_id)),
  );

  constructor() {
    this.search();
  }

  protected presetStaleDrafts(): void {
    this.text = '';
    this.type = '';
    this.status = '';
    this.draftsOnly = true;
    this.staleDays = 180;
    this.search();
  }

  protected clear(): void {
    this.text = '';
    this.type = '';
    this.status = '';
    this.draftsOnly = false;
    this.staleDays = null;
    this.search();
  }

  protected search(): void {
    const query: AdminSearchQuery = {
      text: this.text || undefined,
      type: this.type || undefined,
      statusId: this.status ? Number(this.status) : null,
      draftsOnly: this.draftsOnly,
      staleDays: this.staleDays != null && String(this.staleDays) !== '' ? Number(this.staleDays) : null,
    };
    this.loading.set(true);
    this.adminService.search(query).subscribe((rows) => {
      this.results.set(rows);
      this.selected.set(new Set());
      this.searched.set(true);
      this.loading.set(false);
    });
  }

  protected toggle(id: number): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
  }

  protected toggleAll(): void {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.results().map((r) => r.appl_id)));
  }

  protected deleteOne(row: AdminSearchRow): Promise<void> {
    return this.confirmAndDelete([row]);
  }

  protected deleteSelected(): Promise<void> {
    return this.confirmAndDelete(this.results().filter((r) => this.selected().has(r.appl_id)));
  }

  private async confirmAndDelete(rows: AdminSearchRow[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const nonDrafts = rows.filter((r) => r.status_id !== 1).length;
    const confirmed = await this.dialog.open({
      title: rows.length === 1 ? 'Delete application?' : `Delete ${rows.length} applications?`,
      message:
        (rows.length === 1
          ? `"${rows[0].site_name}" (${rows[0].appl_number || 'draft #' + rows[0].appl_id}) will be permanently deleted.`
          : `${rows.length} applications will be permanently deleted.`) +
        (nonDrafts > 0 ? ` Warning: ${nonDrafts} of them ${nonDrafts === 1 ? 'is' : 'are'} not a draft and may be under departmental processing.` : '') +
        ' This cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }
    this.adminService.deleteApplications(rows.map((r) => r.appl_id)).subscribe((count) => {
      this.toast.success(`${count} application(s) deleted.`);
      this.search();
    });
  }
}
