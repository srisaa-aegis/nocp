import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClient } from '../api/api-client.service';
import { API_ENDPOINTS, ApiEndpoint } from '../api/api-endpoints';
import { formatLegacyDate } from '../domain/dates';
import { generateTemporaryPassword } from '../domain/password';
import { nextId } from '../domain/application-rules';
import { RegistrationRequest, UserAccount } from '../models';

export type CitizenProfilePatch = Pick<UserAccount, 'displayName' | 'email' | 'mobile'> &
  Partial<Pick<UserAccount, 'address' | 'gender' | 'dob' | 'aadhar'>>;

export type DeptUserInput = Pick<UserAccount, 'username' | 'displayName' | 'email' | 'mobile' | 'deptRoleId'> & {
  district?: number;
  /** Fire stations the officer is associated with (ignored when `all_stations`). */
  stations?: string[];
  all_stations?: boolean;
};

export interface PasswordIssued {
  account: UserAccount;
  /** Shown once to the admin; a real system would send it by SMS/e-mail. */
  temporaryPassword: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE = /^[6-9]\d{9}$/;
const USERNAME = /^[a-z0-9._@-]{3,40}$/;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Login accounts for all portals (mock users.aspx / register.aspx / changepass.aspx).
 * Every operation is an atomic read-modify-write against the accounts store
 * through the API catalog; validation failures surface as Observable errors
 * whose `message` is user-presentable.
 */
@Injectable({ providedIn: 'root' })
export class AccountsService {
  private readonly api = inject(ApiClient);

  list(): Observable<UserAccount[]> {
    return this.api.get<UserAccount[]>(API_ENDPOINTS.accountsList);
  }

  byUsername(username: string): Observable<UserAccount | undefined> {
    const u = username.trim().toLowerCase();
    return this.list().pipe(map((list) => list.find((a) => a.username.toLowerCase() === u)));
  }

  private mutateOne(endpoint: ApiEndpoint, id: number, change: (a: UserAccount, all: UserAccount[]) => UserAccount): Observable<UserAccount> {
    let result: UserAccount | undefined;
    return this.api
      .update<UserAccount[]>(endpoint, (list) => {
        const idx = list.findIndex((a) => a.id === id);
        assert(idx >= 0, 'Account not found.');
        result = change({ ...list[idx] }, list);
        return [...list.slice(0, idx), result, ...list.slice(idx + 1)];
      })
      .pipe(map(() => result as UserAccount));
  }

  /** Citizen self-registration: username is the e-mail id (legacy rule); a temporary password is issued. */
  register(req: RegistrationRequest, now: Date = new Date()): Observable<PasswordIssued> {
    const temporaryPassword = generateTemporaryPassword();
    let created: UserAccount | undefined;
    return this.api
      .update<UserAccount[]>(API_ENDPOINTS.authRegister, (list) => {
        const email = req.email.trim().toLowerCase();
        assert(req.name.trim().length > 1, 'Name is required.');
        assert(EMAIL.test(email), 'Enter a valid e-mail address.');
        assert(MOBILE.test(req.mobile), 'Enter a valid 10-digit mobile number.');
        assert(!list.some((a) => a.email.toLowerCase() === email || a.username.toLowerCase() === email), 'An account with this e-mail already exists.');
        created = {
          id: nextId(list, (a) => a.id),
          username: email,
          password: temporaryPassword,
          displayName: req.name.trim(),
          portal: 'citizen',
          email,
          mobile: req.mobile,
          gender: req.gender,
          dob: req.dob,
          aadhar: req.aadhar,
          address: req.address,
          active: true,
          must_change_password: true,
          created_on: formatLegacyDate(now),
        };
        return [...list, created];
      })
      .pipe(map(() => ({ account: created as UserAccount, temporaryPassword })));
  }

  updateCitizen(id: number, patch: CitizenProfilePatch): Observable<UserAccount> {
    return this.mutateOne(API_ENDPOINTS.adminCitizenUpdate, id, (a, all) => {
      assert(a.portal === 'citizen', 'Not a citizen account.');
      assert(patch.displayName.trim().length > 1, 'Name is required.');
      assert(EMAIL.test(patch.email), 'Enter a valid e-mail address.');
      assert(MOBILE.test(patch.mobile), 'Enter a valid 10-digit mobile number.');
      assert(!all.some((o) => o.id !== id && o.email.toLowerCase() === patch.email.toLowerCase()), 'Another account already uses this e-mail.');
      return { ...a, ...patch, displayName: patch.displayName.trim() };
    });
  }

  changePassword(id: number, newPassword: string): Observable<UserAccount> {
    return this.mutateOne(API_ENDPOINTS.adminCitizenChangePassword, id, (a) => {
      assert(newPassword.length >= 6, 'Password must be at least 6 characters.');
      return { ...a, password: newPassword, must_change_password: false };
    });
  }

  /**
   * Self-service password change for any logged-in user (legacy changepass.aspx): the current password
   * must match; the new one must differ and have at least 6 characters.
   */
  changeOwnPassword(username: string, currentPassword: string, newPassword: string): Observable<UserAccount> {
    let result: UserAccount | undefined;
    return this.api
      .update<UserAccount[]>(API_ENDPOINTS.authChangePassword, (list) => {
        const u = username.trim().toLowerCase();
        const idx = list.findIndex((a) => a.username.toLowerCase() === u);
        assert(idx >= 0, 'Account not found.');
        const account = list[idx];
        assert(account.active !== false, 'This account has been deactivated.');
        assert(account.password === currentPassword, 'The current password is incorrect.');
        assert(newPassword.length >= 6, 'The new password must be at least 6 characters.');
        assert(newPassword !== currentPassword, 'The new password must be different from the current password.');
        result = { ...account, password: newPassword, must_change_password: false };
        return [...list.slice(0, idx), result, ...list.slice(idx + 1)];
      })
      .pipe(map(() => result as UserAccount));
  }

  setActive(id: number, active: boolean): Observable<UserAccount> {
    return this.mutateOne(API_ENDPOINTS.adminAccountSetActive, id, (a) => {
      assert(a.portal !== 'admin', 'Administrator accounts cannot be deactivated here.');
      return { ...a, active };
    });
  }

  createDeptUser(input: DeptUserInput, now: Date = new Date()): Observable<PasswordIssued> {
    const temporaryPassword = generateTemporaryPassword();
    let created: UserAccount | undefined;
    return this.api
      .update<UserAccount[]>(API_ENDPOINTS.adminDeptUserCreate, (list) => {
        const username = input.username.trim().toLowerCase();
        assert(USERNAME.test(username), 'Username must be 3-40 characters: letters, digits, ".", "_", "-" or "@".');
        assert(!list.some((a) => a.username.toLowerCase() === username), 'This username is already taken.');
        this.assertDeptFields(input, list);
        created = {
          id: nextId(list, (a) => a.id),
          username,
          password: temporaryPassword,
          displayName: input.displayName.trim(),
          portal: 'dept',
          deptRoleId: input.deptRoleId,
          district: input.district ?? 0,
          stations: input.all_stations ? [] : [...new Set(input.stations ?? [])],
          all_stations: !!input.all_stations,
          email: input.email.trim(),
          mobile: input.mobile,
          active: true,
          must_change_password: true,
          created_on: formatLegacyDate(now),
        };
        return [...list, created];
      })
      .pipe(map(() => ({ account: created as UserAccount, temporaryPassword })));
  }

  updateDeptUser(id: number, patch: Omit<DeptUserInput, 'username'>): Observable<UserAccount> {
    return this.mutateOne(API_ENDPOINTS.adminDeptUserUpdate, id, (a, all) => {
      assert(a.portal === 'dept', 'Not a department account.');
      this.assertDeptFields(
        { ...patch, stations: patch.stations ?? a.stations, all_stations: patch.all_stations ?? a.all_stations },
        all.filter((o) => o.id !== id),
      );
      return {
        ...a,
        displayName: patch.displayName.trim(),
        email: patch.email.trim(),
        mobile: patch.mobile,
        deptRoleId: patch.deptRoleId,
        district: patch.district ?? 0,
        stations: patch.all_stations ? [] : [...new Set(patch.stations ?? a.stations ?? [])],
        all_stations: patch.all_stations ?? a.all_stations ?? false,
      };
    });
  }

  resetPassword(id: number): Observable<PasswordIssued> {
    const temporaryPassword = generateTemporaryPassword();
    return this.mutateOne(API_ENDPOINTS.adminDeptUserResetPassword, id, (a) => ({
      ...a,
      password: temporaryPassword,
      must_change_password: true,
    })).pipe(map((account) => ({ account, temporaryPassword })));
  }

  private assertDeptFields(input: Omit<DeptUserInput, 'username'>, others: UserAccount[]): void {
    assert(input.displayName.trim().length > 1, 'Display name / designation is required.');
    assert(!!input.deptRoleId, 'Select a department role.');
    assert(!!input.all_stations || (input.stations ?? []).length > 0, 'Associate the officer with at least one fire station (or with all fire stations).');
    assert(EMAIL.test(input.email.trim()), 'Enter a valid e-mail address.');
    assert(MOBILE.test(input.mobile), 'Enter a valid 10-digit mobile number.');
    assert(!others.some((o) => o.email.toLowerCase() === input.email.trim().toLowerCase()), 'Another account already uses this e-mail.');
  }
}
