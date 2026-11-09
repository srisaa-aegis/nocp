import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFixtureBackend } from '../../../../testing/fixture-backend';
import { resetBrowserState, seedSession } from '../../../../testing/session';
import { Reports } from './reports';

describe('Reports (dept)', () => {
  beforeEach(async () => {
    resetBrowserState();
    seedSession('monitor.hq', 'dept', '8', 'Monitoring Cell (HQ)');
    await TestBed.configureTestingModule({ imports: [Reports], providers: [provideRouter([]), provideFixtureBackend()] }).compileComponents();
  });

  afterEach(() => resetBrowserState());

  async function open(report: string) {
    const fixture = TestBed.createComponent(Reports);
    fixture.componentRef.setInput('report', report);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('lists the ten reports and shows the pendency dashboard with two charts', async () => {
    const { el } = await open('pendency');
    expect(el.querySelectorAll('.side__link').length).toBe(10);
    expect(el.querySelector('.side__link.is-active')?.textContent).toContain('Pendency');
    expect(el.querySelectorAll('app-bar-chart svg').length).toBe(2);
    expect(el.querySelector('.kpi__value')?.textContent?.trim()).toBe('5');
    expect(el.textContent).toContain('2026100071');
  });

  it('filters by level and shows only the filters of the report', async () => {
    const { fixture, el } = await open('pendency');
    expect(el.querySelectorAll('.filters .f').length).toBe(2); // level, region
    fixture.componentInstance['level'].set('RFO');
    fixture.detectChanges();
    expect(el.querySelector('.kpi__value')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('.print-meta')?.textContent).toContain('Regional (RFO)');
  });

  it('renders the challan report with totals and hides districts without applications', async () => {
    const { fixture, el } = await open('challan');
    expect(el.querySelectorAll('table.challan > tbody').length).toBe(4); // Srikakulam, Visakhapatnam, Krishna, Guntur
    expect(el.querySelector('table.challan tfoot')?.textContent).toContain('952,627');
    fixture.componentInstance['hideEmpty'].set(false);
    fixture.detectChanges();
    expect(el.querySelectorAll('table.challan > tbody').length).toBe(13);
  });

  it('prepares the CSV of the current report', async () => {
    const { fixture } = await open('statistics');
    const csv = fixture.componentInstance['csvData']();
    expect(csv.headers[0]).toBe('Type');
    expect(csv.rows.at(-1)).toEqual(['Total', 1, 1, 1, 1, 1, 4, 1, 1, 11]);
  });

  it('shows the level-wise particulars in three tables', async () => {
    const { el } = await open('levels');
    expect(el.querySelectorAll('section.block table').length).toBe(3);
    expect(el.textContent).toContain('Above 15 m (Head Office)');
  });
});
