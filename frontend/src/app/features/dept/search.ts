import { Component, computed, inject, signal } from '@angular/core';
import { ApplicationSummary } from '../../core/models';
import { ApplTypeBadge } from '../../shared/ui/appl-type-badge';
import { StatusBadge } from '../../shared/ui/status-badge';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSummary } from '../../core/domain/application-rules';
import { DeptWorkflowService } from './dept-workflow.service';

@Component({
  selector: 'app-search',
  imports: [ApplTypeBadge, StatusBadge, RouterLink],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search {
  private readonly dept = inject(DeptWorkflowService);

  protected readonly query = signal('');
  protected readonly all = signal<ApplicationSummary[]>([]);
  protected readonly loading = signal(true);

  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) {
      return this.all();
    }
    return this.all().filter(
      (a) =>
        a.appl_number.toLowerCase().includes(q) ||
        a.site_name.toLowerCase().includes(q) ||
        a.build_name.toLowerCase().includes(q) ||
        a.dist_name.toLowerCase().includes(q),
    );
  });

  constructor() {
    this.dept.applications().pipe(map((apps) => apps.map(toSummary))).subscribe((list) => {
      this.all.set(list);
      this.loading.set(false);
    });
  }
}
