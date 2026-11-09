import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState, seedSession } from '../../../testing/session';
import { Dashboard } from './dashboard';

describe('Dashboard (dept) — queues derived from the workflow runs', () => {
  afterEach(() => resetBrowserState());

  async function render(username: string, role: string) {
    resetBrowserState();
    seedSession(username, 'dept', role, username);
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideRouter([]), provideFixtureBackend()],
    }).compileComponents();
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const groups = (el: HTMLElement) => Array.from(el.querySelectorAll('.group-title')).map((h) => h.childNodes[0].textContent?.trim());
  const actions = (el: HTMLElement) => Array.from(el.querySelectorAll('section[aria-labelledby="my-tasks-title"] a.btn')).map((a) => a.textContent?.trim());

  it('the DFS sees his open tasks grouped by task: the DFS note (110) and the final decision of a renewal (106)', async () => {
    const { el } = await render('dfs.officer', '2');
    expect(groups(el)).toEqual(['Final Decision', 'DFS Note']);
    expect(actions(el)).toEqual(['Issue/Reject', 'Review']);
    expect(el.querySelector('a.btn[href*="/dept/applications/106"]')?.getAttribute('href')).toContain('task=');
    // 106 has been pending with the DFS for years — past the decision SLA
    expect(el.querySelectorAll('tr.row--overdue').length).toBeGreaterThanOrEqual(1);
  });

  it('an SFO gets the committee concurrence of the Head Office file of his fire station (102)', async () => {
    const { el } = await render('sfo.officer', '9');
    expect(groups(el)).toEqual(['Committee Member Concurrence']);
    expect(el.textContent).toContain('2017030007');
    expect(el.textContent).toContain('Fire stations:');
  });

  it('the DG has no open task but monitors the Head Office files in process, grouped by stage', async () => {
    const { fixture, el } = await render('dg.officer', '1');
    expect(el.textContent).toContain('No task is waiting for you.');
    const c = fixture.componentInstance as unknown as { monitorRows: () => { app: { appl_id: number } }[]; stages: () => { label: string; count: number }[] };
    expect(c.monitorRows().map((r) => r.app.appl_id).sort()).toEqual([102, 109, 110]);
    expect(c.stages().map((s) => s.label).sort()).toEqual(['Reviewed by ADFS', 'Reviewed by DFS-CD', 'Submitted']);
  });

  it('the monitoring role sees every file in process; decided files on request', async () => {
    const { fixture, el } = await render('monitor.hq', '8');
    const c = fixture.componentInstance as unknown as { monitorRows: () => { app: { appl_id: number } }[]; showCompleted: { set: (v: boolean) => void } };
    expect(c.monitorRows().map((r) => r.app.appl_id).sort()).toEqual([102, 106, 108, 109, 110]);
    c.showCompleted.set(true);
    fixture.detectChanges();
    expect(c.monitorRows().length).toBe(11);
    expect(el.textContent).toContain('All fire stations');
  });

  it('filters both lists by type and text', async () => {
    const { fixture } = await render('monitor.hq', '8');
    const c = fixture.componentInstance as unknown as { monitorRows: () => { app: { appl_id: number } }[]; type: { set: (v: string) => void }; text: { set: (v: string) => void } };
    c.type.set('O');
    expect(c.monitorRows().map((r) => r.app.appl_id).sort()).toEqual([102, 110]);
    c.text.set('coastal');
    expect(c.monitorRows().map((r) => r.app.appl_id)).toEqual([110]);
  });

  it('shows the citizen feedback panel with the average rating and a period selector', async () => {
    const { el } = await render('dg.officer', '1');
    const panel = el.querySelector('.feedback-panel')!;
    expect(panel.querySelector('.feedback-panel__value')?.textContent?.trim()).toBe('3.67');
    expect(panel.textContent).toContain('3 rating(s)');
    expect(panel.textContent).toContain('Renewal was processed within the promised time.');
    expect(Array.from(panel.querySelectorAll('[role="tab"]')).map((b) => b.textContent?.trim())).toEqual(['Last month', '3 months', '6 months', '12 months', 'Overall']);
    expect(panel.querySelector('[aria-selected="true"]')?.textContent?.trim()).toBe('Overall');
  });
});
