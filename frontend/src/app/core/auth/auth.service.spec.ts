import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { AccountsService } from '../accounts/accounts.service';
import { AuthService } from './auth.service';

describe('AuthService (against the real accounts fixture)', () => {
  let service: AuthService;

  beforeEach(() => {
    resetBrowserState();
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => resetBrowserState());

  it('starts unauthenticated when there is no stored session', () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it.each([
    ['citizen1', '/citizen/dashboard'],
    ['dg.officer', '/dept/dashboard'],
    ['admin', '/admin/dashboard'],
  ])('logs %s in and lands on %s', async (username, landing) => {
    const result = await firstValueFrom(service.login(username, 'demo'));
    expect(result.success).toBe(true);
    expect(result.landing).toBe(landing);
    expect(service.session()?.username).toBe(username);
  });

  it('keeps the department role id on the session', async () => {
    await firstValueFrom(service.login('dfs.officer', 'demo'));
    expect(service.session()?.deptRoleId).toBe('2');
  });

  it('accepts the e-mail address as the username (legacy rule)', async () => {
    const result = await firstValueFrom(service.login('builder1@example.com', 'demo'));
    expect(result.success).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const result = await firstValueFrom(service.login('citizen1', 'wrong'));
    expect(result.success).toBe(false);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('rejects a deactivated account with a specific message', async () => {
    const result = await firstValueFrom(service.login('sai.constructions', 'demo'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('deactivated');
  });

  it('honours a password changed by the admin', async () => {
    const accounts = TestBed.inject(AccountsService);
    await firstValueFrom(accounts.changePassword(2, 'brand-new'));
    expect((await firstValueFrom(service.login('citizen2', 'demo'))).success).toBe(false);
    expect((await firstValueFrom(service.login('citizen2', 'brand-new'))).success).toBe(true);
  });

  it('registers a citizen who can then log in with the issued temporary password', async () => {
    const reg = await firstValueFrom(
      service.register({ name: 'New Builder', mobile: '9876543210', email: 'New@Example.com', gender: 'F', dob: '', aadhar: '', address: 'Guntur' }),
    );
    expect(reg.success).toBe(true);
    expect(reg.username).toBe('new@example.com');
    const login = await firstValueFrom(service.login('new@example.com', reg.temporaryPassword!));
    expect(login.success).toBe(true);
    expect(login.landing).toBe('/citizen/dashboard');
  });

  it('refuses a duplicate registration', async () => {
    const reg = await firstValueFrom(
      service.register({ name: 'Dup', mobile: '9876543210', email: 'builder1@example.com', gender: '', dob: '', aadhar: '', address: '' }),
    );
    expect(reg.success).toBe(false);
    expect(reg.error).toContain('already exists');
  });

  it('forgotPassword succeeds for a known active e-mail and fails otherwise', async () => {
    expect((await firstValueFrom(service.forgotPassword('builder1@example.com'))).success).toBe(true);
    expect((await firstValueFrom(service.forgotPassword('nobody@example.com'))).success).toBe(false);
    expect((await firstValueFrom(service.forgotPassword('sai.constructions@example.com'))).success).toBe(false);
  });

  it('logout clears the session', async () => {
    await firstValueFrom(service.login('citizen1', 'demo'));
    service.logout();
    expect(service.session()).toBeNull();
  });
});
