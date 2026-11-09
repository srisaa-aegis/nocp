import { PortalRole } from '../app/core/models';

/** Seeds a mock session before AuthService is instantiated (it restores from sessionStorage). */
export function seedSession(username: string, portal: PortalRole, deptRoleId?: string, displayName = username): void {
  sessionStorage.setItem(
    'noc.session',
    JSON.stringify({ username, displayName, portal, deptRoleId, loggedInAt: new Date().toISOString() }),
  );
}

export function resetBrowserState(): void {
  localStorage.clear();
  sessionStorage.clear();
}
