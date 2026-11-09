import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { AccountsService } from '../../core/accounts/accounts.service';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { AdminService } from './admin.service';
import { DeptUsers } from './dept-users';

describe('DeptUsers', () => {
  beforeEach(async () => {
    resetBrowserState();
    await TestBed.configureTestingModule({ imports: [DeptUsers], providers: [provideFixtureBackend()] }).compileComponents();
  });

  afterEach(() => resetBrowserState());

  async function render() {
    const fixture = TestBed.createComponent(DeptUsers);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const account = (u: string) => firstValueFrom(TestBed.inject(AccountsService).byUsername(u));

  it('lists department users with role names and their fire stations', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(17);
    expect(text).toContain('Director General, Fire Services');
    expect(text).toContain('Section (Head Office scrutiny)');
    expect(text).toContain('All fire stations');
    expect(text).toContain('Krishna (all 21)');
    expect(text).toContain('Visakhapatnam: Visakhapatnam, Pedagantyada');
  });

  it('filters by role', async () => {
    const fixture = await render();
    fixture.componentInstance['roleFilter'].set('6');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('adds a user and shows the temporary password once', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c['openAdd']();
    c['form'] = { username: 'sfo.tenali', displayName: 'SFO - Tenali', email: 'sfo.t@example.gov', mobile: '9440009999', deptRoleId: '9', district: 7 };
    c['save']();
    await fixture.whenStable();
    expect(c['formError']()).toContain('fire station');
    c['toggleStation']('112', true);
    c['save']();
    await fixture.whenStable();
    fixture.detectChanges();
    const issued = c['issued']()!;
    expect(issued.username).toBe('sfo.tenali');
    expect(fixture.nativeElement.querySelector('.temp-password')?.textContent).toBe(issued.password);
    expect((await account('sfo.tenali'))!.deptRoleId).toBe('9');
    expect((await account('sfo.tenali'))!.stations).toEqual(['112']);
  });

  it('shows validation errors from the service in the modal', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c['openAdd']();
    c['form'] = { username: 'dg.officer', displayName: 'Dup', email: 'x@example.gov', mobile: '9440009999', deptRoleId: '1', district: 0 };
    c['save']();
    await fixture.whenStable();
    expect(c['formError']()).toContain('already taken');
  });

  it('resets a password after confirmation', async () => {
    const fixture = await render();
    vi.spyOn(TestBed.inject(ConfirmDialogService), 'open').mockResolvedValue(true);
    await fixture.componentInstance['resetPassword']((await account('rfo.officer'))!);
    await fixture.whenStable();
    const issued = fixture.componentInstance['issued']()!;
    expect((await account('rfo.officer'))!.password).toBe(issued.password);
  });

  it('modifies the fire stations of a user (district select-all) and associates another with all stations', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c['openEdit']((await account('sfo.guntur'))!);
    const guntur = c['fireStations']().find((d) => d.id === '7')!;
    c['toggleDistrict'](guntur.stations, true);
    c['save']();
    await fixture.whenStable();
    expect((await account('sfo.guntur'))!.stations!.length).toBe(guntur.stations.length);

    c['openEdit']((await account('monitor.hq'))!);
    expect(c['allStations']()).toBe(true);
    c['save']();
    await fixture.whenStable();
    expect((await account('monitor.hq'))!.all_stations).toBe(true);
  });

  it('deactivates an officer without open tasks after confirmation', async () => {
    const fixture = await render();
    vi.spyOn(TestBed.inject(ConfirmDialogService), 'open').mockResolvedValue(true);
    await fixture.componentInstance['toggleActive']((await account('rfo.southern'))!);
    await fixture.whenStable();
    expect((await account('rfo.southern'))!.active).toBe(false);
  });

  it('deactivating an officer with open tasks requires moving them to an officer of the same role', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    const open = vi.spyOn(TestBed.inject(ConfirmDialogService), 'open');
    await c['toggleActive']((await account('dfs.officer'))!);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(open).not.toHaveBeenCalled();
    const h = c['handover']()!;
    expect(h.tasks.map((t) => t.appl_id).sort()).toEqual([102, 106, 109, 110]);
    // no other DFS exists yet
    expect(h.candidates.length).toBe(0);
    expect(document.body.textContent).toContain('no other active officer with this role');
    c['handover'].set(null);

    // with a second DFS the tasks are moved, then the user is deactivated
    await new Promise<void>((resolve) =>
      TestBed.inject(AccountsService)
        .createDeptUser({ username: 'dfs.acting', displayName: 'DFS (acting)', email: 'dfs.acting@example.gov', mobile: '9440001111', deptRoleId: '2', all_stations: true })
        .subscribe(() => resolve()),
    );
    (c as unknown as { reload: () => void }).reload();
    await fixture.whenStable();
    await c['toggleActive']((await account('dfs.officer'))!);
    await fixture.whenStable();
    expect(c['handover']()!.candidates.map((u) => u.username)).toEqual(['dfs.acting']);
    c['confirmHandover']();
    await fixture.whenStable();
    expect((await account('dfs.officer'))!.active).toBe(false);
    const moved = await firstValueFrom(TestBed.inject(AdminService).openTasksOf('dfs.acting'));
    expect(moved.length).toBe(4);
  });
});
