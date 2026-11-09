import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { fixture, provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState, seedSession } from '../../../testing/session';
import { activeTasks } from '../../core/domain/workflow';
import { DelegationRule } from '../../core/models';
import { ApplicationsService } from '../citizen/applications.service';
import { ApplicationView } from './application-view';
import { ToastService } from '../../shared/ui/toast.service';

const delegationRules = fixture<DelegationRule[]>('assets/data/config/delegation-rules.json');

describe('ApplicationView (dept processing page — Phase 3b)', () => {
  beforeEach(() => resetBrowserState());
  afterEach(() => resetBrowserState());

  /**
   * `AuthService` caches the session in a signal read once at construction, so switching persona
   * within one test (citizen → several officers → …) needs a fresh injector per `open()` — real
   * browser `localStorage` (the mock persistence store) is untouched by this and keeps every mutation.
   */
  async function configureTestBed(): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [ApplicationView], providers: [provideRouter([]), provideFixtureBackend()] }).compileComponents();
  }

  /** Submits draft 104 (Provisional, Head Office, fire station 26 Krishna) fresh — section.hq ∥ dfo.officer ∥ sfo.krishna. */
  async function submitFreshP104(): Promise<void> {
    await configureTestBed();
    seedSession('citizen1', 'citizen');
    const apps = TestBed.inject(ApplicationsService);
    const draft = await firstValueFrom(apps.get(104, 'citizen1'));
    draft.payment.status = 'paid';
    draft.declaration_accepted = true;
    await firstValueFrom(apps.submit(draft, delegationRules, new Date(2026, 10, 7)));
  }

  async function open(username: string, role: string, id: string, task?: string) {
    await configureTestBed();
    seedSession(username, 'dept', role, username);
    const f = TestBed.createComponent(ApplicationView);
    f.componentRef.setInput('id', id);
    if (task) f.componentRef.setInput('task', task);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return { f, el: f.nativeElement as HTMLElement };
  }

  /** ngModel writes land one microtask later; re-settle before reading DOM values. */
  async function settle(f: { detectChanges: () => void; whenStable: () => Promise<unknown> }): Promise<void> {
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
  }

  const byName = (el: HTMLElement, name: string) => Array.from(el.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`));

  /** Spies on the toast service — toasts render at the app root, not inside this isolated component. */
  function toastSpy() {
    return { success: vi.spyOn(TestBed.inject(ToastService), 'success'), error: vi.spyOn(TestBed.inject(ToastService), 'error') };
  }

  /** Picks a <select> option by its visible text (works for both plain and [ngValue] bindings). */
  function selectByText(select: HTMLSelectElement, text: string): void {
    const option = Array.from(select.options).find((o) => o.textContent?.includes(text))!;
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
  }

  it('shows the read-only view with the stage stepper, process steps, SLA and tabs (3a carried forward)', async () => {
    const { f, el } = await open('monitor.hq', '8', '109');
    expect(el.querySelector('.my-task')).toBeNull(); // no open task, no quick actions for a non-involved officer
    expect(el.querySelectorAll('.stage').length).toBe(6);
    const tab = (label: string) => Array.from(el.querySelectorAll<HTMLButtonElement>('.tab')).find((b) => b.textContent?.includes(label))!;
    tab('SMS').click();
    await settle(f);
    expect(el.querySelectorAll('.sms-list li').length).toBe(2);
  });

  it('Section Note: fills the required checks, saves a draft (kept on reload) and submitting clears the officer’s task', async () => {
    await submitFreshP104();
    const { f, el } = await open('section.hq', '10', '104');
    const toast = toastSpy();
    expect(el.querySelector('.my-task')?.textContent).toContain('Your task: Scrutiny by Section');
    expect(el.querySelector('app-section-note-form')).not.toBeNull();

    byName(el, 'applicant_ok')[0].click();
    byName(el, 'survey_ok')[0].click();
    byName(el, 'plans_ok')[0].click();
    byName(el, 'bank_guarantee_ok')[0].click();
    byName(el, 'ffe_estimate_ok')[0].click();
    await settle(f);

    const save = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.task-actions button')).find((b) => b.textContent?.includes('Save draft'))!;
    const submit = () => Array.from(el.querySelectorAll<HTMLButtonElement>('.task-actions button')).find((b) => b.textContent?.includes('Submit Note'))!;
    expect(submit().disabled).toBe(true); // remark still empty
    save().click();
    await settle(f);
    expect(toast.success).toHaveBeenCalledWith('Draft saved.');

    // reloading the page keeps the draft (merged with the defaults) — `open()` gets a fresh
    // injector (see `configureTestBed`), so continue on this new fixture from here on
    const reloaded = await open('section.hq', '10', '104');
    expect(byName(reloaded.el, 'applicant_ok')[0].checked).toBe(true);
    const toast2 = toastSpy();

    const remark = reloaded.el.querySelector<HTMLTextAreaElement>('#sn_remark')!;
    remark.value = 'All documents in order.';
    remark.dispatchEvent(new Event('input'));
    await settle(reloaded.f);
    expect(reloaded.el.querySelector('.problems')).toBeNull();
    Array.from(reloaded.el.querySelectorAll<HTMLButtonElement>('.task-actions button'))
      .find((b) => b.textContent?.includes('Submit Note'))!
      .click();
    await settle(reloaded.f);
    expect(toast2.success).toHaveBeenCalledWith('Scrutiny by Section submitted.');
    expect(reloaded.el.querySelector('.my-task')).toBeNull(); // section.hq has no other task on this file
  });

  it('Inspection Report → Committee Concurrence completes the scrutiny stage and opens the RFO Note', async () => {
    const { f, el } = await open('dfo.visakhapatnam', '6', '102');
    const toast = toastSpy();
    expect(el.querySelectorAll('.block-card').length).toBe(2);
    const data = f.componentInstance['taskData']() as {
      blocks: { block_id: number; open_spaces_ok: string; escapes_ok: string; floors_ok: string; ffe_ok: string; pnoc_complied: string }[];
      inspection_date: string;
      remark: string;
    };
    data.blocks.forEach((b) => {
      b.open_spaces_ok = 'Y';
      b.escapes_ok = 'Y';
      b.floors_ok = 'Y';
      b.ffe_ok = 'Y';
      b.pnoc_complied = 'Y';
    });
    data.remark = 'Everything as declared.';
    // nudge the child form's own recompute (the same trick the isolated component spec uses)
    el.querySelector<HTMLInputElement>(`input[name="os${data.blocks[0].block_id}"]`)!.dispatchEvent(new Event('change'));
    f.componentInstance['onFormChanged']();
    await settle(f);
    expect(el.querySelector('.computed')?.textContent).toContain('Recommend');
    Array.from(el.querySelectorAll<HTMLButtonElement>('.task-actions button'))
      .find((b) => b.textContent?.includes('Submit Report'))!
      .click();
    await settle(f);
    expect(toast.success).toHaveBeenCalledWith('Inspection Report (Committee Chairman) submitted.');

    // the committee member still has an open task; the RFO is not active yet
    const { f: f2, el: el2 } = await open('sfo.officer', '9', '102');
    const toast2 = toastSpy();
    expect(el2.querySelector('app-committee-concurrence-form')).not.toBeNull();
    byName(el2, 'agree')[0].click();
    await settle(f2);
    Array.from(el2.querySelectorAll<HTMLButtonElement>('.task-actions button'))
      .find((b) => b.textContent?.includes('Submit'))!
      .click();
    await settle(f2);
    expect(toast2.success).toHaveBeenCalledWith('Committee Member Concurrence submitted.');

    const { el: el3 } = await open('rfo.officer', '7', '102');
    expect(el3.querySelector('app-rfo-note-form')).not.toBeNull();
    expect(el3.querySelector('.stage-label')?.textContent).toContain('Inspected');
  });

  it('sends the file back to the previous stage', async () => {
    const { f, el } = await open('dfs.officer', '2', '110');
    const toast = toastSpy();
    expect(el.querySelector('app-questionnaire-form')).not.toBeNull();
    Array.from(el.querySelectorAll<HTMLButtonElement>('.task-actions button'))
      .find((b) => b.textContent?.includes('Send back'))!
      .click();
    await settle(f);
    const comments = document.querySelector<HTMLTextAreaElement>('#sb_comments')!;
    comments.value = 'Please re-check the refuge areas.';
    comments.dispatchEvent(new Event('input'));
    await settle(f);
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Confirm')!.click();
    await settle(f);
    expect(toast.success).toHaveBeenCalledWith('Sent back to the previous stage.');
    expect(el.querySelector('.my-task')).toBeNull(); // the DFS no longer has the task

    // the DFS-CD officer now sees it active again, with the earlier note pre-filled
    const { el: el2 } = await open('dfscd.officer', '3', '110');
    expect(el2.querySelector('.my-task')?.textContent).toContain('Your task: DFS-CD Note');
  });

  it('the issuing authority bypasses and changes the officer of a pending task', async () => {
    const { f, el } = await open('dg.officer', '1', '102');
    const toast = toastSpy();
    const rows = () => Array.from(el.querySelectorAll('.pending-officers tbody tr'));
    expect(rows().length).toBeGreaterThan(0);
    const row = (name: string) => rows().find((r) => r.textContent?.includes(name))!;

    const committeeRow = row('Committee Member Concurrence');
    Array.from(committeeRow.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Bypass'))!.click();
    await settle(f);
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Confirm')!.click();
    await settle(f);
    expect(toast.success).toHaveBeenCalledWith('Officer bypassed.');
    expect(row('Committee Member Concurrence')).toBeUndefined(); // no longer pending

    const inspectionRow = row('Inspection Report');
    Array.from(inspectionRow.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Change officer'))!.click();
    await settle(f);
    const select = document.querySelector<HTMLSelectElement>('#reassign_to')!;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(['dfo.officer', 'dfo.guntur', 'dfo.srikakulam']);
    select.value = 'dfo.officer';
    select.dispatchEvent(new Event('change'));
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Confirm')!.click();
    await settle(f);
    expect(toast.success).toHaveBeenCalledWith('Officer changed.');
    expect(row('Inspection Report')?.textContent).toContain('DFO - Krishna');
  });

  it('requests a document, uploads a department document and sends an SMS', async () => {
    const { f, el } = await open('dfo.visakhapatnam', '6', '102');
    const docTab = Array.from(el.querySelectorAll<HTMLButtonElement>('.tab')).find((b) => b.textContent?.includes('Documents'))!;
    docTab.click();
    await settle(f);
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Request a document'))!.click();
    await settle(f);
    document.querySelector<HTMLInputElement>('#req_desc')!.value = 'Revised NBC compliance letter';
    document.querySelector<HTMLInputElement>('#req_desc')!.dispatchEvent(new Event('input'));
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Confirm')!.click();
    await settle(f);
    expect(el.textContent).toContain('Revised NBC compliance letter');

    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Upload'))!.click();
    await settle(f);
    const input = document.querySelector<HTMLInputElement>('#up_file')!;
    const file = new File(['x'], 'photo.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    document.querySelector<HTMLInputElement>('#up_desc')!.value = 'Site photo';
    document.querySelector<HTMLInputElement>('#up_desc')!.dispatchEvent(new Event('input'));
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Confirm')!.click();
    await settle(f);
    expect(el.textContent).toContain('photo.pdf');

    const smsTab = Array.from(el.querySelectorAll<HTMLButtonElement>('.tab')).find((b) => b.textContent?.includes('SMS'))!;
    smsTab.click();
    await settle(f);
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Send SMS'))!.click();
    await settle(f);
    document.querySelector<HTMLTextAreaElement>('#sms_msg')!.value = 'Please keep the site ready for inspection.';
    document.querySelector<HTMLTextAreaElement>('#sms_msg')!.dispatchEvent(new Event('input'));
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Confirm')!.click();
    await settle(f);
    expect(el.textContent).toContain('Please keep the site ready');
  });

  it('changes the fire station while Submitted, re-resolving the officers from the new station', async () => {
    await submitFreshP104();
    const { f, el } = await open('section.hq', '10', '104');
    const toast = toastSpy();
    expect(el.textContent).toContain('Krishna');
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Change fire station'))!.click();
    await settle(f);
    selectByText(document.querySelector<HTMLSelectElement>('#fs_district')!, 'Visakhapatnam');
    await settle(f);
    selectByText(document.querySelector<HTMLSelectElement>('#fs_station')!, 'Visakhapatnam');
    Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === 'Confirm')!.click();
    await settle(f);
    expect(toast.success).toHaveBeenCalledWith('Fire station changed.');
    expect(el.textContent).toContain('Visakhapatnam / Visakhapatnam');
    expect(el.textContent).toContain('SFO - Visakhapatnam');
  });

  it('updates the licensing authority once the file has reached the final decision', async () => {
    const { el } = await open('dfs.officer', '2', '106');
    expect(el.querySelector('app-final-decision-form')).not.toBeNull();
    expect(Array.from(el.querySelectorAll<HTMLButtonElement>('button')).some((b) => b.textContent?.includes('Update licensing authority'))).toBe(false); // R, not P/O

    // the button only shows for P / O at their final stage; verified against the engine in workflow.spec.ts
  });

  it('the final decision approves the file and the applicant immediately sees it as Approved', async () => {
    const { f, el } = await open('dfs.officer', '2', '106');
    const outcomeBtn = Array.from(el.querySelectorAll<HTMLButtonElement>('.outcome-btn')).find((b) => b.textContent?.includes('Approved'))!;
    outcomeBtn.click();
    await settle(f);
    document.querySelector<HTMLTextAreaElement>('#fd_remark')!.value = 'Renewal approved; conditions complied.';
    document.querySelector<HTMLTextAreaElement>('#fd_remark')!.dispatchEvent(new Event('input'));
    await settle(f);
    const input = el.querySelector<HTMLInputElement>('#fd_signed')!;
    const file = new File(['x'], 'signed-noc.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle(f);
    const toast = toastSpy();
    Array.from(el.querySelectorAll<HTMLButtonElement>('.decision-actions button'))[0].click();
    await settle(f);
    expect(toast.success).toHaveBeenCalledWith('Decision submitted.');
    expect(el.querySelector('app-status-badge')?.textContent).toContain('Approved');

    const apps = TestBed.inject(ApplicationsService);
    const citizenSide = await firstValueFrom(apps.get(106, 'citizen1'));
    expect(citizenSide.status_id).toBe(7);
    expect(activeTasks(citizenSide.workflow!)).toEqual([]);
  });
});
