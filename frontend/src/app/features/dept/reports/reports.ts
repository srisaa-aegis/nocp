import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import {
  LEVEL_NAMES,
  REPORT_LEVELS,
  REPORT_STATUSES,
  REPORT_TYPES,
  ReportFilter,
  ReportType,
  TYPE_NAMES,
  applicationsReport,
  challanReport,
  consolidatedReport,
  districtReport,
  feedbackReport,
  levelParticularsReport,
  overdueReport,
  pendencyReport,
  smsReport,
  statisticsReport,
  toCsv,
} from '../../../core/domain/reports';
import { LookupService } from '../../../core/lookups/lookup.service';
import { Application, DelegationLevel, District, SlaConfig, StatusId } from '../../../core/models';
import { statusPresentation } from '../../../shared/status.util';
import { BarChart, ChartSeries } from '../../../shared/charts/bar-chart';
import { IconComponent } from '../../../shared/ui/icon';
import { StarRating } from '../../../shared/ui/star-rating';
import { StatusBadge } from '../../../shared/ui/status-badge';
import { DeptWorkflowService } from '../dept-workflow.service';

type FilterKey = 'level' | 'type' | 'region' | 'status' | 'host' | 'from' | 'to';

export interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  filters: FilterKey[];
  legacy: string;
}

export const REPORTS: ReportDef[] = [
  { id: 'pendency', title: 'Pendency', description: 'Files in process by level and type, with whom they are pending and for how long (DG dashboard).', icon: 'bar-chart', filters: ['level', 'region'], legacy: 'dgDashboardReport (Rpt_type 1)' },
  { id: 'statistics', title: 'Statistics', description: 'Applications by type and status, and by approval level.', icon: 'layers', filters: ['level', 'region', 'from', 'to'], legacy: 'statistics_report (Rpt_type 2)' },
  { id: 'consolidated', title: 'Consolidated status', description: 'Approved, returned, rejected and in process per district.', icon: 'list', filters: ['level', 'type', 'region', 'from', 'to'], legacy: 'consolidated_report (Rpt_type 3)' },
  { id: 'applications', title: 'Applications list', description: 'Every block of every application with plot, built-up area, height and fee.', icon: 'file', filters: ['type', 'level', 'region', 'from', 'to'], legacy: 'applications_report (Rpt_type 6)' },
  { id: 'overdue', title: 'Overdue', description: 'Files past the processing SLA per district and type.', icon: 'alert-triangle', filters: ['level', 'region'], legacy: 'applications_overdue (Rpt_type 7)' },
  { id: 'sms', title: 'SMS', description: 'Text messages sent to applicants.', icon: 'bell', filters: ['level', 'from', 'to'], legacy: 'sms_report (Rpt_type 4)' },
  { id: 'feedback', title: 'Feedback rating', description: 'Ratings and remarks given by applicants.', icon: 'star', filters: ['level', 'from', 'to'], legacy: 'feedback_rating (Rpt_type 5)' },
  { id: 'challan', title: 'Challan amount', description: 'NOCs issued, applications received and fees collected per district and type.', icon: 'credit-card', filters: ['level', 'region', 'from', 'to'], legacy: 'reports/rpt_challan' },
  { id: 'district', title: 'District-wise', description: 'Applications per district and type by level, region, status and portal.', icon: 'building', filters: ['level', 'region', 'status', 'host', 'from', 'to'], legacy: 'reports/rpt_district_approved' },
  { id: 'levels', title: 'Level-wise particulars', description: 'Received, approved, rejected, returned and under process per type for each approval level.', icon: 'sliders', filters: ['from', 'to'], legacy: 'reports/rpt_height' },
];

export const TYPE_COLORS: Record<ReportType, string> = { P: '#e8491d', O: '#1a4fb4', R: '#0f8a47', D: '#7421b8' };

/**
 * Department reports (Reports menu). One page per legacy report with its filters, print and CSV
 * export. Computed in the browser from the application store by core/domain/reports.ts.
 */
@Component({
  selector: 'app-dept-reports',
  imports: [RouterLink, DecimalPipe, BarChart, IconComponent, StatusBadge, StarRating],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly dept = inject(DeptWorkflowService);
  private readonly lookups = inject(LookupService);
  private readonly router = inject(Router);

  /** Route param (withComponentInputBinding). */
  readonly report = input<string>('pendency');

  protected readonly reports = REPORTS;
  protected readonly types = REPORT_TYPES;
  protected readonly levels = REPORT_LEVELS;
  protected readonly statuses = REPORT_STATUSES;
  protected readonly typeNames = TYPE_NAMES;
  protected readonly levelNames = LEVEL_NAMES;
  protected readonly typeColors = TYPE_COLORS;
  protected readonly now = new Date();

  protected readonly apps = signal<Application[]>([]);
  protected readonly sla = signal<SlaConfig | null>(null);
  protected readonly loading = signal(true);
  protected readonly districts = toSignal(this.lookups.districts$, { initialValue: [] as District[] });
  protected readonly regions = toSignal(this.lookups.regions$, { initialValue: [] });

  // filters
  protected readonly level = signal<DelegationLevel | ''>('');
  protected readonly type = signal<ReportType | ''>('');
  protected readonly region = signal('');
  protected readonly status = signal<StatusId | 0>(0);
  protected readonly host = signal<string | undefined>(undefined);
  protected readonly from = signal('');
  protected readonly to = signal('');

  /** District tables: hide the districts without any application (legacy note "missing districts have zero"). */
  protected readonly hideEmpty = signal(true);
  protected readonly districtReport = computed(() => ['consolidated', 'overdue', 'challan', 'district'].includes(this.def().id));

  protected visible<T extends { values: { total: number } | { applied: { total: number } } }>(rows: T[]): T[] {
    if (!this.hideEmpty()) return rows;
    return rows.filter((r) => ('applied' in r.values ? r.values.applied.total : r.values.total) > 0);
  }

  protected readonly def = computed(() => REPORTS.find((r) => r.id === this.report()) ?? REPORTS[0]);
  protected has(f: FilterKey): boolean {
    return this.def().filters.includes(f);
  }

  protected readonly filter = computed<ReportFilter>(() => {
    const d = this.def();
    const on = (k: FilterKey) => d.filters.includes(k);
    return {
      level: on('level') ? this.level() : '',
      type: on('type') ? this.type() : '',
      region: on('region') ? this.region() : '',
      status: on('status') ? this.status() : 0,
      host: on('host') ? this.host() : undefined,
      from: on('from') ? this.from() : '',
      to: on('to') ? this.to() : '',
    };
  });

  protected readonly filterText = computed(() => {
    const f = this.filter();
    const parts: string[] = [];
    if (f.level) parts.push(LEVEL_NAMES[f.level]);
    if (f.type) parts.push(TYPE_NAMES[f.type]);
    if (f.region) parts.push(this.regions().find((r) => r.code === f.region)?.name ?? f.region);
    if (f.status) parts.push(statusPresentation(f.status).label);
    if (f.host !== undefined) parts.push(f.host || 'Fire portal');
    if (f.from || f.to) parts.push(`applied ${f.from || '…'} to ${f.to || '…'}`);
    return parts.length ? parts.join(' · ') : 'All submitted applications';
  });

  // --- report data ------------------------------------------------------------

  protected readonly pendency = computed(() => {
    const sla = this.sla();
    return sla ? pendencyReport(this.apps(), this.filter(), sla, this.now, this.regions()) : null;
  });
  protected readonly statistics = computed(() => statisticsReport(this.apps(), this.filter(), this.regions()));
  protected readonly consolidated = computed(() => consolidatedReport(this.apps(), this.filter(), this.districts(), this.regions()));
  protected readonly applicationList = computed(() => applicationsReport(this.apps(), this.filter(), this.regions()));
  protected readonly overdue = computed(() => {
    const sla = this.sla();
    return sla ? overdueReport(this.apps(), this.filter(), sla, this.districts(), this.now, this.regions()) : null;
  });
  protected readonly smsRows = computed(() => {
    const f = this.filter();
    return smsReport(this.apps(), { level: f.level }, { from: f.from, to: f.to }, this.regions());
  });
  protected readonly feedback = computed(() => feedbackReport(this.apps(), this.filter(), this.regions()));
  protected readonly challan = computed(() => challanReport(this.apps(), this.filter(), this.districts(), this.regions()));
  protected readonly districtWise = computed(() => districtReport(this.apps(), this.filter(), this.districts(), this.regions()));
  protected readonly particulars = computed(() => levelParticularsReport(this.apps(), this.filter(), this.regions()));

  // --- charts -----------------------------------------------------------------

  protected readonly levelCategories = ['Head Office', 'Regional', 'District'];

  protected readonly pendencySeries = computed<ChartSeries[]>(() => {
    const p = this.pendency();
    if (!p) return [];
    return REPORT_TYPES.map((t) => ({ label: TYPE_NAMES[t], color: TYPE_COLORS[t], values: REPORT_LEVELS.map((l) => p.matrix[l][t]) }));
  });

  /** Short status names for the chart axis. */
  protected readonly statusCategories = ['Submitted', 'Inspected', 'ADFS', 'DFS-CD', 'Final appr.', 'Approved', 'Returned', 'Rejected'];
  protected readonly statusSeries = computed<ChartSeries[]>(() => {
    const s = this.statistics();
    return [{ label: 'Applications', color: '#404759', values: REPORT_STATUSES.map((id) => s.totals[id]) }];
  });

  protected readonly statisticsLevelSeries = computed<ChartSeries[]>(() => {
    const s = this.statistics();
    return REPORT_TYPES.map((t) => ({ label: TYPE_NAMES[t], color: TYPE_COLORS[t], values: REPORT_LEVELS.map((l) => s.byLevel[l][t]) }));
  });

  protected readonly consolidatedSeries = computed<ChartSeries[]>(() => {
    const c = this.consolidated().totals;
    return [{ label: 'Applications', color: '#404759', values: [c.approved, c.returned, c.rejected, c.in_process] }];
  });

  constructor() {
    this.dept.data().subscribe({
      next: ({ apps, cfg }) => {
        this.apps.set(apps);
        this.sla.set(cfg.sla);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected statusLabel(id: number): string {
    return statusPresentation(id as StatusId).label;
  }

  protected go(id: string): void {
    this.router.navigate(['/dept/reports', id]);
  }

  protected clear(): void {
    this.level.set('');
    this.type.set('');
    this.region.set('');
    this.status.set(0);
    this.host.set(undefined);
    this.from.set('');
    this.to.set('');
  }

  protected onStatus(v: string): void {
    this.status.set((Number(v) || 0) as StatusId | 0);
  }

  protected onHost(v: string): void {
    this.host.set(v === '*' ? undefined : v);
  }

  protected print(): void {
    window.print();
  }

  /** Header and rows of the current report, for the CSV export. */
  protected csvData(): { headers: string[]; rows: unknown[][] } {
    const tn = (t: string) => TYPE_NAMES[t as ReportType] ?? t;
    switch (this.def().id) {
      case 'pendency':
        return {
          headers: ['Type', 'Level', 'Appl. No.', 'Revision', 'District', 'Building', 'Builder', 'Address', 'Pending with', 'Status', 'Since', 'Days', 'SLA days', 'Overdue'],
          rows: (this.pendency()?.byType ?? []).flatMap((g) =>
            g.rows.map((r) => [tn(r.type), r.level, r.appl_number, r.revision, r.dist_name, r.site_name, r.build_name, r.site_addr, r.pending_with, this.statusLabel(r.status_id), r.since, r.days, r.sla ?? '', r.overdue ? 'Yes' : 'No']),
          ),
        };
      case 'statistics':
        return {
          headers: ['Type', ...REPORT_STATUSES.map((s) => this.statusLabel(s)), 'Total'],
          rows: [...this.statistics().rows.map((r) => [tn(r.type), ...REPORT_STATUSES.map((s) => r.byStatus[s]), r.total]), ['Total', ...REPORT_STATUSES.map((s) => this.statistics().totals[s]), this.statistics().totals.total]],
        };
      case 'consolidated':
        return {
          headers: ['District', 'Approved', 'Returned', 'Rejected', 'In process', 'Total'],
          rows: [...this.consolidated().rows.map((r) => [r.name, r.values.approved, r.values.returned, r.values.rejected, r.values.in_process, r.values.total]), ['Total', this.consolidated().totals.approved, this.consolidated().totals.returned, this.consolidated().totals.rejected, this.consolidated().totals.in_process, this.consolidated().totals.total]],
        };
      case 'applications':
        return {
          headers: ['Appl. No.', 'Block', 'Builder', 'Address', 'Type', 'Level', 'Plot area (sq.m)', 'Built-up area (sq.m)', 'Height (m)', 'Challan amount (Rs.)', 'Status'],
          rows: this.applicationList().map((r) => [r.appl_number, r.block_name, r.builder, r.address, tn(r.type), r.level, r.plot_area, r.built_area, r.height ?? '', r.challan, this.statusLabel(r.status_id)]),
        };
      case 'overdue':
        return {
          headers: ['District', ...REPORT_TYPES.map(tn), 'Total'],
          rows: [...(this.overdue()?.rows ?? []).map((r) => [r.name, ...REPORT_TYPES.map((t) => r.values[t]), r.values.total]), ['Total', ...REPORT_TYPES.map((t) => this.overdue()?.totals[t] ?? 0), this.overdue()?.totals.total ?? 0]],
        };
      case 'sms':
        return { headers: ['Appl. No.', 'Building', 'Mobile', 'Message', 'Sent by', 'Sent on'], rows: this.smsRows().map((r) => [r.appl_number, r.site_name, r.mobile, r.message, r.sent_by, r.sent_on]) };
      case 'feedback':
        return { headers: ['Appl. No.', 'Applicant', 'Description', 'Rating', 'Submitted on', 'Level'], rows: this.feedback().rows.map((r) => [r.appl_number, r.applicant, r.description, r.rating, r.submitted_on, r.level]) };
      case 'challan':
        return {
          headers: ['District', 'Row', ...REPORT_TYPES.map(tn), 'Total'],
          rows: [
            ...this.challan().rows.flatMap((r) => [
              [r.name, 'Issued', ...REPORT_TYPES.map((t) => r.values.issued[t]), r.values.issued.total],
              [r.name, 'Applied', ...REPORT_TYPES.map((t) => r.values.applied[t]), r.values.applied.total],
              [r.name, 'Challan (Rs.)', ...REPORT_TYPES.map((t) => r.values.amount[t]), r.values.amount.total],
            ]),
          ],
        };
      case 'district':
        return {
          headers: ['District', ...REPORT_TYPES.map(tn), 'Total'],
          rows: [...this.districtWise().rows.map((r) => [r.name, ...REPORT_TYPES.map((t) => r.values[t]), r.values.total]), ['Total', ...REPORT_TYPES.map((t) => this.districtWise().totals[t]), this.districtWise().totals.total]],
        };
      default:
        return {
          headers: ['Level', 'Type', 'Received', 'Approved', 'Rejected', 'Returned (addl. information)', 'Under process'],
          rows: this.particulars().flatMap((p) => p.rows.map((r) => [p.title, tn(r.type), r.received, r.approved, r.rejected, r.returned, r.under_process])),
        };
    }
  }

  protected exportCsv(): void {
    const { headers, rows } = this.csvData();
    const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noc-${this.def().id}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
