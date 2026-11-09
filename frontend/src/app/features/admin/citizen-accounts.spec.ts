import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { CitizenAccounts } from './citizen-accounts';

describe('CitizenAccounts', () => {
  beforeEach(async () => {
    resetBrowserState();
    await TestBed.configureTestingModule({ imports: [CitizenAccounts], providers: [provideFixtureBackend()] }).compileComponents();
  });

  afterEach(() => resetBrowserState());

  async function render() {
    const fixture = TestBed.createComponent(CitizenAccounts);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const account = (u: string) => firstValueFrom(TestBed.inject(AccountsService).byUsername(u));

  it('lists only citizen accounts with their status', async () => {
    const fixture = await render();
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('Deactivated');
    expect(fixture.nativeElement.textContent).not.toContain('dg.officer');
  });

  it('modifies a profile through the modal', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c['openEdit']((await account('citizen2'))!);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.modal')).toBeTruthy();
    c['form'].mobile = '9000000002';
    c['saveEdit']();
    await fixture.whenStable();
    expect((await account('citizen2'))!.mobile).toBe('9000000002');
    expect(c['editing']()).toBeNull();
  });

  it('validates and changes a password', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c['openPassword']((await account('citizen1'))!);
    c['newPassword'] = 'abcdef';
    c['confirmPassword'] = 'abcdeX';
    c['savePassword']();
    expect(c['pwdError']()).toContain('do not match');
    c['confirmPassword'] = 'abcdef';
    c['savePassword']();
    await fixture.whenStable();
    expect((await account('citizen1'))!.password).toBe('abcdef');
  });

  it('deactivates after confirmation', async () => {
    const fixture = await render();
    vi.spyOn(TestBed.inject(ConfirmDialogService), 'open').mockResolvedValue(true);
    await fixture.componentInstance['toggleActive']((await account('citizen1'))!);
    await fixture.whenStable();
    expect((await account('citizen1'))!.active).toBe(false);
  });
});
