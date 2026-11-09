import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { Search } from './search';

describe('Search (dept)', () => {
  beforeEach(async () => {
    resetBrowserState();
    await TestBed.configureTestingModule({ imports: [Search], providers: [provideRouter([]), provideFixtureBackend()] }).compileComponents();
  });

  it('filters submitted applications by free text and never shows drafts', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('Padma Rekha Apartments');
    expect(text()).not.toContain('So So So House'); // draft

    fixture.componentInstance['query'].set('guntur');
    fixture.detectChanges();
    expect(text()).toContain('Sunrise Towers');
    expect(text()).not.toContain('Padma Rekha Apartments');
  });

  it('links every result to the department view of the application', async () => {
    const fixture = TestBed.createComponent(Search);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('tbody a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/dept/applications/109');
  });
});
