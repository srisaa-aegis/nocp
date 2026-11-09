import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideFixtureBackend } from '../../../testing/fixture-backend';
import { resetBrowserState } from '../../../testing/session';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  beforeEach(async () => {
    resetBrowserState();
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [provideRouter([]), provideFixtureBackend()],
    }).compileComponents();
  });

  it.each([
    ['builder1@example.com', 'Password reset instructions'],
    ['nobody@example.com', 'No account found'],
  ])('for %s shows "%s"', (email, message) => {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.componentInstance['email'].set(email);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(message);
  });
});
