import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(() => {
    resetBrowserState();
    TestBed.configureTestingModule({ providers: [provideFixtureBackend()] });
    service = TestBed.inject(AccountsService);
  });

  afterEach(() => resetBrowserState());

  const find = async (username: string) => (await firstValueFrom(service.byUsername(username)))!;

  describe('citizen accounts', () => {
    it('modifies a citizen profile', async () => {
      const c = await find('citizen2');
      await firstValueFrom(service.updateCitizen(c.id, { displayName: 'Renamed Ltd', email: 'renamed@example.com', mobile: '9000000001', address: 'New address' }));
      const updated = await find('citizen2');
      expect(updated.displayName).toBe('Renamed Ltd');
      expect(updated.email).toBe('renamed@example.com');
      expect(updated.username).toBe('citizen2');
    });

    it('rejects an e-mail already used by another account', async () => {
      const c = await find('citizen2');
      await expect(
        firstValueFrom(service.updateCitizen(c.id, { displayName: 'X Ltd', email: 'builder1@example.com', mobile: '9000000001' })),
      ).rejects.toThrow('already uses this e-mail');
    });

    it('rejects invalid mobile numbers', async () => {
      const c = await find('citizen2');
      await expect(firstValueFrom(service.updateCitizen(c.id, { displayName: 'X Ltd', email: 'x@example.com', mobile: '123' }))).rejects.toThrow('mobile');
    });

    it('changes a password (min. 6 characters)', async () => {
      const c = await find('citizen1');
      await expect(firstValueFrom(service.changePassword(c.id, '123'))).rejects.toThrow('at least 6');
      await firstValueFrom(service.changePassword(c.id, 'secret99'));
      expect((await find('citizen1')).password).toBe('secret99');
    });

    it('deactivates and reactivates an account', async () => {
      const c = await find('citizen1');
      await firstValueFrom(service.setActive(c.id, false));
      expect((await find('citizen1')).active).toBe(false);
      await firstValueFrom(service.setActive(c.id, true));
      expect((await find('citizen1')).active).toBe(true);
    });

    it('refuses to deactivate the administrator', async () => {
      const admin = await find('admin');
      await expect(firstValueFrom(service.setActive(admin.id, false))).rejects.toThrow('Administrator');
    });
  });

  describe('department users', () => {
    const input = { username: 'DFO.Guntur2', displayName: 'DFO - Guntur (2)', email: 'dfo.g2@example.gov', mobile: '9440001234', deptRoleId: '6', district: 7, stations: ['111', '112'] };

    it('adds a user with a lower-cased username and a temporary password', async () => {
      const r = await firstValueFrom(service.createDeptUser(input));
      expect(r.account.username).toBe('dfo.guntur2');
      expect(r.account.portal).toBe('dept');
      expect(r.account.stations).toEqual(['111', '112']);
      expect(r.account.active).toBe(true);
      expect(r.temporaryPassword).toHaveLength(10);
      expect((await find('dfo.guntur2')).password).toBe(r.temporaryPassword);
    });

    it('rejects a duplicate username', async () => {
      await expect(firstValueFrom(service.createDeptUser({ ...input, username: 'dfs.officer' }))).rejects.toThrow('already taken');
    });

    it('requires a role', async () => {
      await expect(firstValueFrom(service.createDeptUser({ ...input, deptRoleId: '' }))).rejects.toThrow('role');
    });

    it('requires at least one fire station unless associated with all', async () => {
      await expect(firstValueFrom(service.createDeptUser({ ...input, stations: [] }))).rejects.toThrow('fire station');
      const r = await firstValueFrom(service.createDeptUser({ ...input, stations: [], all_stations: true }));
      expect(r.account.all_stations).toBe(true);
    });

    it('modifies role and jurisdiction', async () => {
      const u = await find('sfo.officer');
      await firstValueFrom(service.updateDeptUser(u.id, { displayName: 'RFO - Visakhapatnam (acting)', email: u.email, mobile: u.mobile, deptRoleId: '7', district: 3 }));
      const updated = await find('sfo.officer');
      expect(updated.deptRoleId).toBe('7');
      expect(updated.displayName).toContain('acting');
    });

    it('resets a password to a new temporary password', async () => {
      const u = await find('rfo.officer');
      const r = await firstValueFrom(service.resetPassword(u.id));
      expect(r.temporaryPassword).not.toBe('demo');
      expect((await find('rfo.officer')).password).toBe(r.temporaryPassword);
      expect((await find('rfo.officer')).must_change_password).toBe(true);
    });
  });

  describe('self-service password change (citizens, officers and admins)', () => {
    it('changes the own password when the current one matches', async () => {
      await firstValueFrom(service.changeOwnPassword('dfo.officer', 'demo', 'n3wSecret'));
      const u = await find('dfo.officer');
      expect(u.password).toBe('n3wSecret');
      expect(u.must_change_password).toBe(false);
    });

    it('rejects a wrong current password, a short or unchanged new password and deactivated accounts', async () => {
      await expect(firstValueFrom(service.changeOwnPassword('citizen1', 'wrong', 'abcdef'))).rejects.toThrow('current password is incorrect');
      await expect(firstValueFrom(service.changeOwnPassword('citizen1', 'demo', 'abc'))).rejects.toThrow('at least 6');
      await firstValueFrom(service.changeOwnPassword('citizen1', 'demo', 'abcdef'));
      await expect(firstValueFrom(service.changeOwnPassword('citizen1', 'abcdef', 'abcdef'))).rejects.toThrow('different');
      await expect(firstValueFrom(service.changeOwnPassword('sai.constructions', 'demo', 'abcdef'))).rejects.toThrow('deactivated');
    });
  });
});
