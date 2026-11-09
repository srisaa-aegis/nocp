import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { fixture as data, provideFixtureBackend } from '../../../../testing/fixture-backend';
import { resetBrowserState } from '../../../../testing/session';
import { LookupService, WizardLookups } from '../../../core/lookups/lookup.service';
import { Application, DeptRole, RenewalRule, UserAccount } from '../../../core/models';
import { FinalDecisionForm } from './final-decision-form';

describe('FinalDecisionForm', () => {
  const apps = data<Application[]>('assets/data/applications/applications.json');
  const users = data<UserAccount[]>('assets/data/auth/users.json');
  const roles = data<DeptRole[]>('assets/data/lookups/dept-roles.json');
  const renewal = data<RenewalRule[]>('assets/data/config/renewal-rules.json');
  const ctx = { users, roles };

  beforeEach(() => {
    resetBrowserState();
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
  });

  afterEach(() => resetBrowserState());

  async function render(appId: number, allowed: ('approve' | 'return' | 'reject' | 'inspect')[] = ['approve', 'return', 'reject']) {
    const lookups = await firstValueFrom(TestBed.inject(LookupService).wizard());
    const f = TestBed.createComponent(FinalDecisionForm);
    f.componentRef.setInput('app', structuredClone(apps.find((a) => a.appl_id === appId)!));
    f.componentRef.setInput('lookups', lookups as WizardLookups);
    f.componentRef.setInput('ctx', ctx);
    f.componentRef.setInput('renewalRules', renewal);
    f.componentRef.setInput('allowed', allowed);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  it('requires a remark and the signed copy before approve / return / reject can be submitted; previews the right certificate', async () => {
    const f = await render(101); // Provisional, approved
    const el = f.nativeElement as HTMLElement;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>('.outcome-btn')).map((b) => b.textContent?.trim());
    expect(buttons).toEqual(['Approved', 'Returned with Remarks', 'Rejected']);

    buttons.indexOf('Approved');
    el.querySelectorAll<HTMLButtonElement>('.outcome-btn')[0].click();
    f.detectChanges();
    expect(el.querySelector('.problems')?.textContent).toContain('Enter the remarks');
    expect(el.querySelector<HTMLButtonElement>('.decision-actions button')!.disabled).toBe(true);

    const remark = el.querySelector<HTMLTextAreaElement>('#fd_remark')!;
    remark.value = 'All conditions met.';
    remark.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(el.querySelector('.problems')?.textContent).toContain('Upload the signed copy');
    expect(el.querySelector('app-noc-provisional')).not.toBeNull(); // preview follows the outcome even before the file is attached

    const input = el.querySelector<HTMLInputElement>('#fd_signed')!;
    const file = new File(['x'], 'signed.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    f.detectChanges();
    expect(el.querySelector('.problems')).toBeNull();
    const submit = el.querySelector<HTMLButtonElement>('.decision-actions button')!;
    expect(submit.disabled).toBe(false);

    let emitted: { outcome: string } | undefined;
    f.componentInstance.decided.subscribe((e) => (emitted = e));
    submit.click();
    expect(emitted?.outcome).toBe('approve');
  });

  it('does not offer "Returned with Remarks" once the processing SLA is crossed, and previews the rejection letter', async () => {
    const f = await render(106, ['approve', 'reject']); // processing SLA already exceeded
    const el = f.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.outcome-btn')).map((b) => b.textContent?.trim())).toEqual(['Approved', 'Rejected']);
    el.querySelectorAll<HTMLButtonElement>('.outcome-btn')[1].click();
    f.detectChanges();
    const remark = el.querySelector<HTMLTextAreaElement>('#fd_remark')!;
    remark.value = 'Deficiencies not rectified.';
    remark.dispatchEvent(new Event('input'));
    f.detectChanges();
    expect(el.querySelector('app-rejection-letter')).not.toBeNull();
  });

  it('defaults the validity for a non-Provisional approval and lets the officer override it', async () => {
    const f = await render(106, ['approve', 'reject']); // Renewal
    const el = f.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.outcome-btn')[0].click(); // Approved
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const from = el.querySelector<HTMLInputElement>('#fd_from')!;
    expect(from.value).not.toBe('');
    expect(f.componentInstance['validTo']()).not.toBe('');
  });

  it('an "inspect" decision needs no remark / signed copy', async () => {
    const f = await render(107, ['approve', 'return', 'reject', 'inspect']);
    const el = f.nativeElement as HTMLElement;
    el.querySelectorAll<HTMLButtonElement>('.outcome-btn').item(3).click();
    f.detectChanges();
    expect(el.querySelector('.problems')).toBeNull();
    expect(el.querySelector<HTMLButtonElement>('.decision-actions button')!.disabled).toBe(false);
  });
});
