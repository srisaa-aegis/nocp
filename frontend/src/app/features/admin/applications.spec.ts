import { TestBed } from '@angular/core/testing';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { ConfirmDialogService } from '../../shared/ui/confirm-dialog.service';
import { AdminApplications } from './applications';

describe('AdminApplications (search & delete)', () => {
  beforeEach(async () => {
    resetBrowserState();
    await TestBed.configureTestingModule({ imports: [AdminApplications], providers: [provideFixtureBackend()] }).compileComponents();
  });

  afterEach(() => resetBrowserState());

  async function render() {
    const fixture = TestBed.createComponent(AdminApplications);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists every application initially', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(14);
  });

  it('finds stale drafts with the preset and bulk-deletes them after confirmation', async () => {
    const fixture = await render();
    const c = fixture.componentInstance;
    c['presetStaleDrafts']();
    fixture.detectChanges();
    expect(c['results']().map((r) => r.appl_id).sort()).toEqual([104, 112, 113]);

    const confirm = vi.spyOn(TestBed.inject(ConfirmDialogService), 'open').mockResolvedValue(true);
    c['toggleAll']();
    await c['deleteSelected']();
    fixture.detectChanges();
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Delete 3 applications?' }));
    expect(c['results']()).toEqual([]);

    c['clear']();
    expect(c['results']().length).toBe(11);
  });

  it('warns when deleting an application that is not a draft', async () => {
    const fixture = await render();
    const confirm = vi.spyOn(TestBed.inject(ConfirmDialogService), 'open').mockResolvedValue(false);
    const row = fixture.componentInstance['results']().find((r) => r.appl_id === 102)!;
    await fixture.componentInstance['deleteOne'](row);
    expect(confirm.mock.calls[0][0].message).toContain('not a draft');
    expect(fixture.componentInstance['results']().some((r) => r.appl_id === 102)).toBe(true);
  });
});
