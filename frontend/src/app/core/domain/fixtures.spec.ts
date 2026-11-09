import { fixture } from '../../../testing/fixture-backend';
import { Application, ApplicationType, BuildType, DeptRole, District, DistrictFireStations, Equipment, FormDef, SlaConfig, UserAccount, WorkflowDefinition } from '../models';
import { currentTasks, slaProblems, workflowSetProblems } from './workflow';

/** Guards the JSON "server data" against drift from the TypeScript model and business rules. */
describe('fixture consistency', () => {
  const apps = fixture<Application[]>('assets/data/applications/applications.json');
  const users = fixture<UserAccount[]>('assets/data/auth/users.json');
  const types = fixture<ApplicationType[]>('assets/data/lookups/application-types.json');
  const buildTypes = fixture<BuildType[]>('assets/data/lookups/build-types.json');
  const districts = fixture<District[]>('assets/data/lookups/districts.json');
  const stations = fixture<DistrictFireStations[]>('assets/data/lookups/fire-stations.json');
  const equipments = fixture<Equipment[]>('assets/data/lookups/equipments.json');
  const deptRoles = fixture<DeptRole[]>('assets/data/lookups/dept-roles.json');
  const workflows = fixture<WorkflowDefinition[]>('assets/data/config/workflows.json');
  const forms = fixture<FormDef[]>('assets/data/config/forms.json');
  const sla = fixture<SlaConfig>('assets/data/config/sla.json');

  it('has no trace of the dropped Existing Building (E) application type', () => {
    expect(types.map((t) => t.code)).not.toContain('OE');
    expect(types.flatMap((t) => t.mode.map((m) => m.code))).not.toContain('E');
    expect(apps.some((a) => a.appl_mode === 'E')).toBe(false);
  });

  it('every application has unique id, a citizen owner, valid district, station and occupancy codes', () => {
    expect(new Set(apps.map((a) => a.appl_id)).size).toBe(apps.length);
    for (const a of apps) {
      expect(users.find((u) => u.username === a.owner)?.portal, `owner of ${a.appl_id}`).toBe('citizen');
      expect(districts.some((d) => d.id === a.district), `district of ${a.appl_id}`).toBe(true);
      const st = stations.find((s) => Number(s.id) === a.district)?.stations ?? [];
      expect(st.some((s) => s.id === a.firestation), `station of ${a.appl_id}`).toBe(true);
      expect(types.some((t) => t.code === a.appl_type)).toBe(true);
      for (const b of a.blocks) {
        const bt = buildTypes.find((t) => t.code === b.site_type);
        expect(bt?.sub.some((s) => s.code === b.site_stype), `sub-type of ${a.appl_id}/${b.block_name}`).toBe(true);
        for (const e of b.ffe.items) {
          expect(equipments.some((x) => x.id === e.equip_id)).toBe(true);
        }
      }
    }
  });

  it('parent/child links are symmetric', () => {
    for (const a of apps.filter((x) => x.child_id)) {
      expect(apps.find((c) => c.appl_id === a.child_id)?.parent_id).toBe(a.appl_id);
    }
  });

  it('submitted applications have a number, an applied date and a paid fee', () => {
    for (const a of apps.filter((x) => x.status_id > 1)) {
      expect(a.appl_number, String(a.appl_id)).toMatch(/^\d{10}$/);
      expect(a.applied_date).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{4}$/);
      expect(a.payment.status).toBe('paid');
    }
  });

  it('accounts have unique usernames; department users have an existing role and valid fire stations', () => {
    expect(new Set(users.map((u) => u.username)).size).toBe(users.length);
    const stationIds = new Set(stations.flatMap((d) => d.stations.map((s) => String(s.id))));
    for (const u of users.filter((x) => x.portal === 'dept')) {
      expect(deptRoles.some((r) => r.id === u.deptRoleId), u.username).toBe(true);
      expect(u.all_stations || (u.stations ?? []).length > 0, `${u.username} has no fire station`).toBe(true);
      for (const s of u.stations ?? []) expect(stationIds.has(s), `${u.username}: station ${s}`).toBe(true);
    }
  });

  it('the shipped workflows and SLA are valid (one workflow per type × level)', () => {
    expect(workflowSetProblems(workflows, deptRoles, forms)).toEqual([]);
    expect(slaProblems(sla, workflows)).toEqual([]);
  });

  it('every submitted application has a workflow run of its type × level, consistent with its status', () => {
    for (const a of apps.filter((x) => x.status_id > 1)) {
      const run = a.workflow;
      expect(run, `run of ${a.appl_id}`).toBeDefined();
      expect(run!.definition_id).toBe(`${a.appl_type}-${a.delegation_level}`);
      expect(run!.revision).toBe(a.revision);
      const open = currentTasks(run!).filter((t) => t.state === 'active');
      if (a.status_id >= 7) {
        expect(run!.completed_on, String(a.appl_id)).toBeTruthy();
        expect(open.length).toBe(0);
      } else {
        expect(run!.completed_on).toBeFalsy();
        expect(open.length, `open tasks of ${a.appl_id}`).toBeGreaterThan(0);
      }
      for (const t of run!.tasks.filter((x) => x.assignee)) {
        const u = users.find((x) => x.username === t.assignee);
        expect(u?.deptRoleId, `${a.appl_id} task ${t.task_id}`).toBe(t.role_id);
      }
    }
  });
});
