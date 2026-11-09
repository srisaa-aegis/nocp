import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountsService } from '../../core/accounts/accounts.service';
import { EscalationNotice, UserAccount } from '../../core/models';
import { Modal } from '../../shared/ui/modal';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { IconComponent } from '../../shared/ui/icon';
import { ToastService } from '../../shared/ui/toast.service';
import { AdminSearchRow, AdminService, EscalationPreview } from './admin.service';

@Component({
  selector: 'app-dashboard',
  imports: [IconComponent, RouterLink, Modal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly adminService = inject(AdminService);
  private readonly accounts = inject(AccountsService);
  private readonly dialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  protected readonly sending = signal(false);
  private readonly users = signal<UserAccount[]>([]);
  private readonly applications = signal<AdminSearchRow[]>([]);

  protected readonly stats = computed(() => {
    const users = this.users();
    const apps = this.applications();
    return {
      citizens: users.filter((u) => u.portal === 'citizen').length,
      citizensInactive: users.filter((u) => u.portal === 'citizen' && !u.active).length,
      deptUsers: users.filter((u) => u.portal === 'dept').length,
      deptInactive: users.filter((u) => u.portal === 'dept' && !u.active).length,
      applications: apps.length,
      drafts: apps.filter((a) => a.status_id === 1).length,
      staleDrafts: apps.filter((a) => a.status_id === 1 && (a.days_idle ?? 0) >= 180).length,
    };
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.accounts.list().subscribe((u) => this.users.set(u));
    this.adminService.search({}).subscribe((a) => this.applications.set(a));
  }

  /** Escalation preview (null = closed). */
  protected readonly preview = signal<EscalationPreview | null>(null);

  protected readonly kindLabel: Record<EscalationNotice['kind'], string> = { step: 'Step SLA', inspection: 'Inspection SLA', processing: 'Processing SLA' };

  protected openEscalations(): void {
    this.adminService.escalationPreview().subscribe((p) => this.preview.set(p));
  }

  protected sendEscalations(): void {
    this.sending.set(true);
    this.adminService.sendEscalations().subscribe((entry) => {
      this.sending.set(false);
      this.preview.set(null);
      this.toast.success(
        entry.notices.length === 0
          ? 'Nothing is due — no escalation sent.'
          : `Escalation reminders sent to ${entry.recipients} officer(s) for ${entry.notices.length} overdue item(s) in ${entry.applications} application(s).`,
      );
    });
  }

  protected async resetDemoData(): Promise<void> {
    const confirmed = await this.dialog.open({
      title: 'Reset demo data?',
      message: 'This restores every application and account back to the original seed data (dev/demo utility only).',
      confirmText: 'Reset',
      cancelText: 'Cancel',
    });
    if (!confirmed) {
      return;
    }
    this.adminService.resetDemoData();
    this.load();
    this.toast.success('Demo data has been reset.');
  }
}
