export type PortalRole = 'citizen' | 'dept' | 'admin';

/** Department sub-role id — matches the keys of RoleStatuses.txt / dept-roles.json. */
export type DeptRoleId = string;

/**
 * A login account (citizen, department user or admin), as held by the mock
 * accounts store (assets/data/auth/users.json). Passwords are stored in plain
 * text ONLY because this is a stub-data demo with no backend.
 */
export interface UserAccount {
  id: number;
  username: string;
  password: string;
  displayName: string;
  portal: PortalRole;
  email: string;
  mobile: string;
  active: boolean;
  created_on: string;
  /** Forces a password change prompt in a real system; informational here. */
  must_change_password?: boolean;

  // Citizen profile (legacy register.aspx fields)
  gender?: string;
  dob?: string;
  aadhar?: string;
  address?: string;

  // Department user attributes
  deptRoleId?: DeptRoleId;
  /** District of jurisdiction (0 / undefined = HQ / state-wide). */
  district?: number;
  /**
   * Fire stations the officer is associated with. The officers of an application's workflow are the
   * officers of each designation associated with the fire station under which the property comes.
   */
  stations?: string[];
  /** Associated with every fire station (Head Office officers). */
  all_stations?: boolean;
}

/** @deprecated kept as an alias for older code/tests — use UserAccount. */
export type SeedUser = UserAccount;

export interface Session {
  username: string;
  displayName: string;
  portal: PortalRole;
  deptRoleId?: DeptRoleId;
  loggedInAt: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  landing?: string;
  session?: Session;
}

export interface RegistrationRequest {
  name: string;
  mobile: string;
  email: string;
  gender: string;
  dob: string;
  aadhar: string;
  address: string;
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
  username?: string;
  /** Temporary password — in production this is sent by SMS, never shown. */
  temporaryPassword?: string;
}
