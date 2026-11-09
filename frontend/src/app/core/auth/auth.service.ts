import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { AccountsService } from '../accounts/accounts.service';
import { LoginResult, RegistrationRequest, RegistrationResult, Session, UserAccount } from '../models';

const SESSION_KEY = 'noc.session';

export function landingFor(portal: Session['portal']): string {
  switch (portal) {
    case 'citizen':
      return '/citizen/dashboard';
    case 'dept':
      return '/dept/dashboard';
    case 'admin':
      return '/admin/dashboard';
  }
}

/**
 * Mock authentication. There is no real backend: "login" validates the
 * supplied credentials against the accounts store (seeded from
 * `assets/data/auth/users.json`, editable by the Admin portal) and stores a
 * fake `Session` in `sessionStorage`. Mirrors the legacy login.aspx behaviour
 * of returning a role-based `landing` URL.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accounts = inject(AccountsService);

  private readonly sessionSignal = signal<Session | null>(this.restoreSession());
  readonly session = this.sessionSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionSignal() !== null);

  private restoreSession(): Session | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  }

  private persistSession(session: Session | null): void {
    this.sessionSignal.set(session);
    try {
      if (session) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      /* best effort */
    }
  }

  login(username: string, password: string): Observable<LoginResult> {
    const key = username.trim().toLowerCase();
    return this.accounts.list().pipe(
      map((users) => {
        const match = users.find(
          (u) => (u.username.toLowerCase() === key || u.email.toLowerCase() === key) && u.password === password,
        );
        if (!match) {
          return { success: false, error: 'Invalid username or password.' } satisfies LoginResult;
        }
        if (!match.active) {
          return {
            success: false,
            error: 'This account has been deactivated. Please contact the portal administrator.',
          } satisfies LoginResult;
        }
        const session: Session = {
          username: match.username,
          displayName: match.displayName,
          portal: match.portal,
          deptRoleId: match.deptRoleId,
          loggedInAt: new Date().toISOString(),
        };
        this.persistSession(session);
        return { success: true, landing: landingFor(session.portal), session } satisfies LoginResult;
      }),
    );
  }

  /** The full account record of the logged-in user (for pre-filling forms). */
  currentAccount(): Observable<UserAccount | undefined> {
    const s = this.sessionSignal();
    return s ? this.accounts.byUsername(s.username) : of(undefined);
  }

  register(req: RegistrationRequest): Observable<RegistrationResult> {
    return this.accounts.register(req).pipe(
      map((r) => ({ success: true, username: r.account.username, temporaryPassword: r.temporaryPassword }) satisfies RegistrationResult),
      catchError((e: Error) => of({ success: false, error: e.message } satisfies RegistrationResult)),
    );
  }

  forgotPassword(email: string): Observable<LoginResult> {
    const key = email.trim().toLowerCase();
    return this.accounts.list().pipe(
      map((users) => {
        const account = users.find((u) => u.email.toLowerCase() === key);
        if (!account) {
          return { success: false, error: 'No account found with that e-mail.' } satisfies LoginResult;
        }
        if (!account.active) {
          return { success: false, error: 'This account is deactivated. Please contact the administrator.' } satisfies LoginResult;
        }
        return { success: true } satisfies LoginResult;
      }),
    );
  }

  logout(): void {
    this.persistSession(null);
  }
}
