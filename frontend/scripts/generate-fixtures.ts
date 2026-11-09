/**
 * Generates the mock "server data" (public/assets/data/applications/applications.json and
 * public/assets/data/auth/users.json) using the SAME domain code the app runs
 * (rule trees, commonrules port, fees, approval levels, renewal periods), so seeded data is
 * exactly what the wizard would compute. Every submitted application is validated with the
 * submission validation and the script fails if a seeded application would not be submittable.
 *
 *   npm run fixtures
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeDelegationLevel, computeFee } from '../src/app/core/domain/application-rules';
import { blockBuiltUp, fireLiftsReqd, refugeAreaRequired, reqdOpenSpace, reqdEscapeWidthValue, maxOccuCount, maxTravelDistance } from '../src/app/core/domain/commonrules';
import { carryProvidedToProposed, carryRequiredToProposed, computeBlockFfe } from '../src/app/core/domain/ffe';
import { ValidationContext, validateApplication } from '../src/app/core/domain/validation';
import { parseLegacyDate } from '../src/app/core/domain/dates';
import { processStep } from '../src/app/core/domain/application-factory';
import { WorkflowContext, activeTasks, currentTasks, decide, findDefinition, startRun, submitTask, declarationLevel } from '../src/app/core/domain/workflow';
import type {
  Application,
  Block,
  DelegationRule,
  DistrictFireStations,
  District,
  Equipment,
  EscapeRules,
  FeeConfig,
  FfeRuleSet,
  Floor,
  RenewalRule,
  RuleTree,
  UserAccount,
  DeptRole,
  SlaConfig,
  WorkflowDefinition,
  WorkflowOutcome,
} from '../src/app/core/models';

const DATA = join(__dirname, '..', 'public', 'assets', 'data');
const read = <T>(rel: string): T => JSON.parse(readFileSync(join(DATA, rel), 'utf8')) as T;

const equipments = read<Equipment[]>('lookups/equipments.json');
const districts = read<District[]>('lookups/districts.json');
const stations = read<DistrictFireStations[]>('lookups/fire-stations.json');
const feeConfig = read<FeeConfig>('config/fee-config.json');
const delegationRules = read<DelegationRule[]>('config/delegation-rules.json');
const renewalRules = read<RenewalRule[]>('config/renewal-rules.json');
const escapeRules = read<EscapeRules>('lookups/escape-rules.json');
const occupancyConditions = read<{ checklist_id: number; item_desc: string }[]>('lookups/occupancy-conditions.json');
const ffeRules: FfeRuleSet = {
  equipment: Object.fromEntries(
    readdirSync(join(DATA, 'rules', 'ffe')).map((f) => [Number(f.replace('.json', '')), read<RuleTree>(`rules/ffe/${f}`)]),
  ),
  ffeType: read<RuleTree>('rules/ffe-type.json'),
  otherNotes: read<RuleTree>('rules/other-notes.json'),
  riserWidth: read<RuleTree>('rules/riser-width.json'),
};
const ctx: ValidationContext = {
  applicationTypes: read('lookups/application-types.json'),
  buildTypes: read('lookups/build-types.json'),
  partyRoles: read('lookups/party-roles.json'),
  documentRequirements: read('lookups/document-requirements.json'),
  escapeRules,
  heightLimits: read<RuleTree>('rules/height-limits.json'),
  feeConfig,
};

const station = (district: number, idx = 0) => stations.find((d) => Number(d.id) === district)!.stations[idx].id;
const distName = (id: number) => districts.find((d) => d.id === id)!.desc;

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

type FloorSpec = [type: string, name: string, area: number, occ: string, occupants: number, seats?: number];

function floors(spec: FloorSpec[]): Floor[] {
  return spec.map(([flr_type, flr_name, built_area, occ_type, occ_c_app, seats_num], i) => ({
    floor_id: i + 1,
    flr_type,
    flr_name,
    built_area,
    occ_type,
    occ_c_app,
    seats_num: seats_num ?? 0,
  }));
}

interface BlockOpts {
  id: number;
  name: string;
  type: string;
  stype: string;
  height: number;
  floors: FloorSpec[];
  permissible?: number;
  frontRoad?: number;
  /** override proposed open space (all sides), otherwise required + 1 m */
  ospace?: number;
  beds?: string;
}

function block(o: BlockOpts, app: { appl_type: string; appl_mode: string; plot_area: number }): Block {
  const b: Block = {
    block_id: o.id,
    sl_no: o.id,
    block_name: o.name,
    block_type: 'N',
    site_type: o.type,
    site_stype: o.stype,
    is_mixed: false,
    is_multiplex: false,
    is_miniplex: false,
    beds: o.beds ?? (o.type === 'ins' ? 'Y' : ''),
    height: o.height,
    permissible_height: o.permissible ?? o.height,
    road_wide: false,
    roadwidening: ['N', 'E', 'S', 'W'].map((d) => ({ rw_direc: d, rw_reqd: 0 })),
    xfer_sbak: false,
    front_dir: 'E',
    sides: [
      { bside_id: 1, direc: 'N', ptype: 'R', pname: 'Side Road', width: 9 },
      { bside_id: 2, direc: 'E', ptype: 'R', pname: 'Main Road', width: o.frontRoad ?? 18 },
      { bside_id: 3, direc: 'S', ptype: 'B', pname: 'Adjacent Plot', width: 0 },
      { bside_id: 4, direc: 'W', ptype: 'B', pname: 'Adjacent Building', width: 0 },
    ],
    floors: floors(o.floors),
    ospaces: ['N', 'E', 'S', 'W'].map((d, i) => ({ ospace_id: i + 1, direc: d, proposed: 0, projection: 0.6 })),
    escapes: [],
    exits: [{ exit_id: 1, ename: 'Main Gate', width: 6, awidth: o.frontRoad ?? 18, direc: 'E' }],
    doors: [{ door_id: 1, desc: 'Main entrance lobby door', width: o.type === 'asm' ? 2.4 : 1.5, location: 'E' }],
    lifts: [],
    refuges: [],
    carparks: [],
    ta_dist: 22,
    ta_dead: 5,
    hrclear: 5.5,
    ffe: { items: [], notes: [], agree_reqt: true },
  };
  // open spaces: required + 1 m (or the given value)
  for (const os of b.ospaces) {
    const reqd = reqdOpenSpace(b, os.direc, app.plot_area, app.appl_type, app.appl_mode);
    os.proposed = o.ospace ?? Math.max(0, reqd) + 1;
  }
  // staircases sized to the rules
  const maxOcc = maxOccuCount(b);
  const widthI = Math.max(reqdEscapeWidthValue('I', b.site_type, b.site_stype, maxOcc), 1.5);
  const widthE = Math.max(reqdEscapeWidthValue('E', b.site_type, b.site_stype, maxOcc), 1.5);
  const maxLoadWidth = Math.max(0, ...b.floors.map((f) => Math.floor((f.occ_c_app * 18) / 1000)));
  const stairWidth = Math.max(widthI, Math.ceil(maxLoadWidth / 2 + 0.5));
  b.escapes = [
    { escape_id: 1, etype: 'I', desc: 'Internal Staircase 1', width: stairWidth, location: 'E' },
    { escape_id: 2, etype: 'E', desc: 'External Staircase 1', width: Math.max(widthE, stairWidth), location: 'W' },
  ];
  if (b.site_type === 'ins') b.escapes.push({ escape_id: 3, etype: 'R', desc: 'Ramp', width: 2.4, location: 'N' });
  b.ta_dist = Math.min(22, maxTravelDistance(b, escapeRules));
  const lifts = fireLiftsReqd(b);
  b.lifts = Array.from({ length: lifts }, (_, i) => ({ lift_id: i + 1, ltype: 'F', lname: `Fire Lift ${i + 1}`, capacity: 680 }));
  if (b.height > escapeRules.refuge_min_height) {
    const floorId = b.floors[Math.max(0, b.floors.length - 2)].floor_id;
    b.refuges = [{ refuge_id: 1, floor_id: floorId, area: refugeAreaRequired(b, floorId, escapeRules.refuge_area_per_person, escapeRules.refuge_min_area) + 5 }];
  }
  return b;
}

const PARTY_NAMES = ['S. Architects & Associates', 'Structura Consultants', 'VoltLine Electricals', 'SafeGuard Fire Systems'];
const ROLES = ['Architect', 'Structural Engineer', 'Electrical Contractor', 'Fire Safety Systems Contractor'];
const LICENSES = ['CA/2010/4532', 'SE/2012/1187', 'EC/2015/0771', 'FS/2016/0305'];
const PHONES = ['8888888888', '9998889997', '9111111111', '9222222222'];

function parties(builder: string, mobile: string, email: string) {
  return [
    { sl_no: 1, role_name: 'Builder', party_name: builder, phone_number: mobile, email, license_no: 'BLD/2014/0012' },
    ...ROLES.map((role, i) => ({ sl_no: i + 2, role_name: role, party_name: PARTY_NAMES[i], phone_number: PHONES[i], email: `contact${i + 1}@example.com`, license_no: LICENSES[i] })),
  ];
}

const DOC_LABELS: Record<string, string> = {
  ChallanCopy: 'Scanned Copy of Challan',
  Undertaking: 'Undertaking on Rs. 100 Stamp Paper',
  BankGuarantee: '15% Bank Guarantee for 5 years',
  SelfDeclaration: 'Self Declaration',
  FFEEstimate: 'Estimate towards provision of required fire safety systems',
  ProNOC: 'Scanned Copy of the Provisional NOC',
  MunicipalDoc: 'Municipality Approved Document (Building Permission / Completion)',
  OcNOC: 'Scanned Copy of the Occupancy NOC',
  Declaration: 'Signed Self-Declaration for Renewal',
  SitePlan: 'Site Plan',
  SectionPlan: 'Section Plan',
  ElevationPlan: 'Elevation Plan',
  FloorPlan: 'Floor Plan',
};

function docsFor(app: Application, general: string[], date: string) {
  const codes = [...general];
  if (app.appl_type === 'P' || app.appl_type === 'O') {
    for (const b of app.blocks) {
      codes.push(`SitePlan:${b.block_id}`, `SectionPlan:${b.block_id}`, `ElevationPlan:${b.block_id}`);
      for (const f of b.floors) codes.push(`FloorPlan:${b.block_id}:${f.floor_id}`);
    }
  }
  return codes.map((code, i) => {
    const [base, blockId, floorId] = code.split(':');
    const blk = app.blocks.find((b) => String(b.block_id) === blockId);
    const flr = blk?.floors.find((f) => String(f.floor_id) === floorId);
    const category = DOC_LABELS[base] + (flr ? ` — ${flr.flr_name} (${blk!.block_name})` : blk ? ` (${blk.block_name})` : '');
    return { doc_id: i + 1, code, file_name: `${base.toLowerCase()}${blockId ? '-' + blockId : ''}${floorId ? '-' + floorId : ''}.pdf`, category, uploaded_on: date, size: 180000 + i * 4096 };
  });
}

interface AppSpec {
  id: number;
  number: string;
  type: 'P' | 'O' | 'R' | 'D';
  mode: string;
  owner: string;
  site: string;
  addr: string;
  district: number;
  stationIdx?: number;
  builder: string;
  mobile: string;
  email: string;
  plot: number;
  perimeter: number;
  lic: [string, string];
  blocks: Omit<BlockOpts, 'id'>[];
  status: number;
  applied: string;
  final?: string;
  revision?: number;
  reviewer?: string;
  parentId?: number;
  childId?: number;
  pay?: 'online' | 'challan';
  refNo?: string;
  lastInspect?: string;
  mcapprove?: string;
  providedRatio?: number;
  deptfiles?: Application['deptfiles'];
  docs?: string[];
  lastModified?: string;
  feedback?: Application['feedback'];
}

const P_DOCS = ['SelfDeclaration', 'Undertaking', 'BankGuarantee', 'FFEEstimate'];

function makeApp(s: AppSpec): Application {
  const app: Application = {
    appl_id: s.id,
    appl_number: s.number,
    appl_type: s.type,
    appl_mode: s.mode,
    revision: s.revision ?? 1,
    owner: s.owner,
    site_name: s.site,
    site_addr: s.addr,
    district: s.district,
    dist_name: distName(s.district),
    firestation: station(s.district, s.stationIdx ?? 0),
    corr_addr: s.addr,
    plot_area: s.plot,
    perimeter: s.perimeter,
    lic_auth: s.lic[0],
    lic_addr: s.lic[1],
    build_name: s.builder,
    build_landline: '',
    build_mobile: s.mobile,
    build_email: s.email,
    build_aadhar: '',
    ref_no: s.refNo ?? '',
    last_inspect_date: s.lastInspect ?? '',
    applied_date: s.applied,
    final_date: s.final ?? '',
    last_modified: s.lastModified ?? s.final ?? s.applied,
    status_id: s.status as Application['status_id'],
    delegation_level: 'DFO',
    reviewer: s.reviewer ?? '',
    loc_lat: 0,
    loc_lng: 0,
    host_name: null,
    parent_id: s.parentId ?? 0,
    child_id: s.childId ?? 0,
    declaration_accepted: s.status > 1,
    mcapprove_date: s.mcapprove ?? '',
    conditions: [],
    parties: s.type === 'D' ? [] : parties(s.builder, s.mobile, s.email),
    blocks: [],
    deptfiles: s.deptfiles ?? [],
    documents: [],
    processLog: [],
    payment: { mode: null, amount: 0, status: 'pending', challan_num: '', challan_date: '', challan_bnk: '', challan_brch: '', txn_ref: '', paid_on: '' },
    feedback: s.feedback,
  };
  app.blocks = s.blocks.map((b, i) => block({ ...b, id: i + 1 }, app));
  for (const b of app.blocks) {
    b.ffe = computeBlockFfe(b, app.plot_area, app.perimeter, ffeRules, equipments, { items: [], notes: [], agree_reqt: s.status > 1 });
    if (s.type === 'O' || s.type === 'R') {
      const ratio = s.providedRatio ?? 1;
      for (const item of b.ffe.items) {
        const fill = (c: { reqt: number | string | null; prop: number | string | null; prov: number | null }) => {
          c.prop = c.reqt;
          c.prov = typeof c.reqt === 'number' ? Math.floor(c.reqt * ratio) : c.reqt !== null ? 1 : null;
        };
        if (item.level === 'F') Object.values(item.floors).forEach(fill);
        else fill(item.block);
      }
    }
  }
  app.delegation_level = computeDelegationLevel(app, delegationRules);
  // Fee as computed on the day of application (penalty years of an Occupancy without PNOC depend on it).
  const fee = computeFee(app, feeConfig, parseLegacyDate(s.applied) ?? new Date(2026, 0, 1));
  app.payment.amount = fee.total;
  if (s.pay === 'online') {
    Object.assign(app.payment, { mode: 'online', status: 'paid', txn_ref: `TXN${s.id}0017`, paid_on: s.applied });
  } else if (s.pay === 'challan') {
    Object.assign(app.payment, { mode: 'challan', status: 'paid', challan_num: `CH${String(s.id * 97).padStart(5, '0')}`, challan_date: s.applied, challan_bnk: 'State Bank of India', challan_brch: 'Main Branch', paid_on: s.applied });
  }
  app.documents = docsFor(app, [...(s.docs ?? []), ...(s.pay === 'challan' ? ['ChallanCopy'] : [])], s.applied);
  if (s.type === 'O' && s.mode !== 'N') {
    app.conditions = occupancyConditions.map((c) => ({ ...c, selected: s.status > 1 ? true : null }));
  }
  if (s.type === 'D') app.noc_level = 'DFO';
  return app;
}

// ---------------------------------------------------------------------------
// Seed applications
// ---------------------------------------------------------------------------

const GVMC: [string, string] = ['Commissioner, Greater Visakhapatnam Municipal Corporation', 'GVMC Head Office, Asilmetta, Visakhapatnam'];
const VMC: [string, string] = ['Commissioner, Vijayawada Municipal Corporation', 'VMC Office, MG Road, Vijayawada'];
const GMC: [string, string] = ['Commissioner, Guntur Municipal Corporation', 'GMC Office, Guntur'];
const SKL: [string, string] = ['Commissioner, Srikakulam Municipality', 'Municipal Office, Srikakulam'];

const PADMA_BLOCKS: Omit<BlockOpts, 'id'>[] = [
  { name: 'Block A', type: 'res', stype: 'A4', height: 24, permissible: 24, floors: [['B', 'Cellar', 1800, 'PAR', 0], ['S', 'Stilt', 1800, 'PAR', 0], ['F', '1st Floor', 1600, 'RES', 128], ['F', '2nd Floor', 1600, 'RES', 128], ['F', '3rd Floor', 1600, 'RES', 128], ['F', '4th Floor', 1600, 'RES', 128], ['F', '5th Floor', 1600, 'RES', 128], ['F', '6th Floor', 1600, 'RES', 128], ['F', '7th Floor', 1600, 'RES', 128]] },
  { name: 'Club House', type: 'asm', stype: 'D5', height: 7, permissible: 7, floors: [['G', 'Ground', 600, 'ASM5', 300], ['F', '1st Floor', 450, 'ASM4', 250]] },
];

const specs: AppSpec[] = [
  { id: 101, number: '2016080001', type: 'P', mode: '', owner: 'citizen1', site: 'Padma Rekha Apartments', addr: 'Plot 1, 2 & 3, Rajeevnagar, Visakhapatnam', district: 3, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 6000, perimeter: 320, lic: GVMC, blocks: PADMA_BLOCKS, status: 7, applied: '01-Aug-2016', final: '28-Sep-2016', childId: 102, reviewer: 'DG Office (HQ)', pay: 'challan', docs: P_DOCS, feedback: { rating: 4, remarks: 'Quick processing; inspection was well coordinated.', rated_on: '05-Oct-2016' },
  },
  { id: 102, number: '2017030007', type: 'O', mode: 'O', refNo: '2016080001', owner: 'citizen1', site: 'Padma Rekha Apartments', addr: 'Plot 1, 2 & 3, Rajeevnagar, Visakhapatnam', district: 3, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 6000, perimeter: 320, lic: GVMC, blocks: PADMA_BLOCKS, status: 2, applied: '02-Mar-2017', parentId: 101, reviewer: 'SFO - Visakhapatnam', pay: 'online', docs: ['ProNOC', 'MunicipalDoc'],
    deptfiles: [{ fileid: 1, appid: 102, processid: 1, file_name: 'CompletionCertificate', file_desc: 'Municipal Completion Certificate', status: 'R', citizen_comment: '', requested_by: 'SFO - Visakhapatnam', requested_on: '05-Mar-2017' }],
  },
  { id: 103, number: '2016070012', type: 'P', mode: '', owner: 'citizen1', site: 'Yashoda Paradise', addr: 'Opp Vijaya Bank, Benz Circle, Vijayawada', district: 6, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 5000, perimeter: 300, lic: VMC,
    blocks: [{ name: 'Tower 1', type: 'res', stype: 'A4', height: 27, permissible: 27, floors: [['S', 'Stilt', 1200, 'PAR', 0], ['F', '1st Floor', 1200, 'RES', 96], ['F', '2nd Floor', 1200, 'RES', 96], ['F', '3rd Floor', 1200, 'RES', 96], ['F', '4th Floor', 1200, 'RES', 96], ['F', '5th Floor', 1200, 'RES', 96], ['F', '6th Floor', 1200, 'RES', 96], ['F', '7th Floor', 1200, 'RES', 96], ['F', '8th Floor', 1200, 'RES', 96]], ospace: 4 }],
    status: 9, applied: '01-Jul-2016', final: '19-Aug-2016', reviewer: 'DG Office (HQ)', pay: 'challan', docs: P_DOCS, feedback: { rating: 2, remarks: 'The reason for rejection was clear but took long.', rated_on: '25-Aug-2016' },
  },
  { id: 104, number: '', type: 'P', mode: '', owner: 'citizen1', site: 'So So So House', addr: 'Main Road, Madhapur, Vijayawada', district: 6, stationIdx: 1, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 1800, perimeter: 0, lic: ['', ''],
    blocks: [{ name: 'Block A', type: 'biz', stype: 'E1', height: 16, permissible: 16, floors: [['G', 'Ground', 700, 'BIZ', 70], ['F', '1st Floor', 700, 'BIZ', 70], ['F', '2nd Floor', 700, 'BIZ', 70], ['F', '3rd Floor', 700, 'BIZ', 70], ['F', '4th Floor', 700, 'BIZ', 70]] }],
    status: 1, applied: '', lastModified: '14-Jun-2023' },
  { id: 105, number: '2018020044', type: 'O', mode: 'M', refNo: 'PNOC/RC/2016/1142', owner: 'citizen1', site: 'Green Valley Mall', addr: 'NH-16 Service Road, Vijayawada', district: 6, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 12000, perimeter: 460, lic: VMC,
    blocks: [{ name: 'Mall Block', type: 'mer', stype: 'F1', height: 14.5, permissible: 14.5, floors: [['G', 'Ground', 4000, 'MER1', 1300], ['F', '1st Floor', 3800, 'MER2', 630], ['F', '2nd Floor', 3600, 'ASM5', 1500]] }],
    status: 8, applied: '14-Feb-2018', final: '02-Mar-2018', revision: 2, reviewer: 'RFO - Krishna', pay: 'online', providedRatio: 0.8, docs: ['MunicipalDoc'],
    deptfiles: [{ fileid: 2, appid: 105, processid: 3, file_name: 'RevisedUndertaking', file_desc: 'Revised undertaking addressing RFO remarks', status: 'R', citizen_comment: '', requested_by: 'RFO - Krishna', requested_on: '02-Mar-2018' }],
  },
  { id: 106, number: '2021010099', type: 'R', mode: 'M', owner: 'citizen1', site: 'Lotus Residency', addr: 'Beach Road, Visakhapatnam', district: 3, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 8000, perimeter: 380, lic: GVMC,
    blocks: [{ name: 'Tower A', type: 'res', stype: 'A4', height: 30, floors: [['S', 'Stilt', 2000, 'PAR', 0], ['F', '1st Floor', 2000, 'RES', 160], ['F', '2nd Floor', 2000, 'RES', 160], ['F', '3rd Floor', 2000, 'RES', 160], ['F', '4th Floor', 2000, 'RES', 160], ['F', '5th Floor', 2000, 'RES', 160], ['F', '6th Floor', 2000, 'RES', 160], ['F', '7th Floor', 2000, 'RES', 160], ['F', '8th Floor', 2000, 'RES', 160], ['F', '9th Floor', 2000, 'RES', 160]] }],
    status: 6, applied: '10-Jan-2021', reviewer: 'DG Office (HQ)', pay: 'challan', refNo: 'ONOC/2015/0441', docs: ['OcNOC'],
  },
  { id: 107, number: '2022050032', type: 'D', mode: 'M', owner: 'citizen1', site: 'Sunrise Towers', addr: 'Tank Bund Road, Guntur', district: 7, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 3000, perimeter: 220, lic: GMC, blocks: [], status: 7, applied: '05-May-2022', final: '18-May-2022', reviewer: 'DFO - Guntur', pay: 'challan', refNo: 'ONOC/2019/1187', lastInspect: '12-Apr-2022', docs: ['Declaration'],
  },
  { id: 108, number: '2023110018', type: 'P', mode: '', owner: 'citizen1', site: 'Metro Business Park', addr: 'Ring Road, Srikakulam', district: 1, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 2200, perimeter: 190, lic: SKL,
    blocks: [{ name: 'Block A', type: 'biz', stype: 'E2', height: 12, permissible: 12, floors: [['G', 'Ground', 650, 'BIZ', 65], ['F', '1st Floor', 650, 'BIZ', 65], ['F', '2nd Floor', 650, 'BIZ', 65], ['F', '3rd Floor', 650, 'BIZ', 65]] }],
    status: 3, applied: '20-Nov-2023', reviewer: 'RFO - Srikakulam', pay: 'challan', docs: P_DOCS,
  },
  { id: 109, number: '2024010055', type: 'P', mode: '', owner: 'citizen2', site: 'Harbor View Residency', addr: 'Port Road, Visakhapatnam', district: 3, stationIdx: 1, builder: 'Any One Goes Pvt Ltd', mobile: '9112223344', email: 'builder2@example.com', plot: 7000, perimeter: 340, lic: GVMC,
    blocks: [{ name: 'Tower 1', type: 'res', stype: 'A4', height: 33, permissible: 33, floors: [['B', 'Cellar', 2200, 'PAR', 0], ['S', 'Stilt', 2000, 'PAR', 0], ['F', '1st Floor', 1800, 'RES', 144], ['F', '2nd Floor', 1800, 'RES', 144], ['F', '3rd Floor', 1800, 'RES', 144], ['F', '4th Floor', 1800, 'RES', 144], ['F', '5th Floor', 1800, 'RES', 144], ['F', '6th Floor', 1800, 'RES', 144], ['F', '7th Floor', 1800, 'RES', 144], ['F', '8th Floor', 1800, 'RES', 144], ['F', '9th Floor', 1800, 'RES', 144], ['F', '10th Floor', 1800, 'RES', 144]] }],
    status: 4, applied: '15-Jan-2024', reviewer: 'DFS (HQ)', pay: 'online', docs: P_DOCS,
  },
  { id: 110, number: '2026100071', type: 'O', mode: 'M', refNo: 'PNOC/RC/2022/0377', owner: 'citizen3', site: 'Coastal Trade Centre', addr: 'Seaport Junction, Visakhapatnam', district: 3, builder: 'Coastal Developers', mobile: '9223344556', email: 'coastal.dev@example.com', plot: 6500, perimeter: 330, lic: GVMC,
    blocks: [{ name: 'Main Block', type: 'biz', stype: 'E1', height: 20, floors: [['G', 'Ground', 1400, 'BIZ', 140], ['F', '1st Floor', 1400, 'BIZ', 140], ['F', '2nd Floor', 1400, 'BIZ', 140], ['F', '3rd Floor', 1400, 'BIZ', 140], ['F', '4th Floor', 1400, 'BIZ', 140], ['F', '5th Floor', 1400, 'BIZ', 140]] }],
    status: 5, applied: '12-Oct-2026', reviewer: 'DFS (HQ)', pay: 'online', docs: ['MunicipalDoc'],
  },
  { id: 111, number: '2019060023', type: 'O', mode: 'N', owner: 'citizen1', site: 'Lakeview Hospital', addr: 'Kanuru Main Road, Vijayawada', district: 6, stationIdx: 2, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 3500, perimeter: 240, lic: VMC,
    blocks: [{ name: 'Hospital Block', type: 'ins', stype: 'C1', height: 14, beds: 'Y', floors: [['G', 'Ground', 800, 'INS1', 80], ['F', '1st Floor', 800, 'INS2', 53], ['F', '2nd Floor', 800, 'INS2', 53], ['F', '3rd Floor', 750, 'INS2', 50]] }],
    status: 7, applied: '11-Jun-2019', final: '30-Jul-2019', childId: 114, reviewer: 'RFO - Krishna', pay: 'online', mcapprove: '15-Mar-2017', docs: ['MunicipalDoc'], feedback: undefined,
  },
  { id: 114, number: '2022070009', type: 'R', mode: 'O', owner: 'citizen1', site: 'Lakeview Hospital', addr: 'Kanuru Main Road, Vijayawada', district: 6, stationIdx: 2, builder: 'Mantri Constructions', mobile: '9999999999', email: 'builder1@example.com', plot: 3500, perimeter: 240, lic: VMC,
    blocks: [{ name: 'Hospital Block', type: 'ins', stype: 'C1', height: 14, beds: 'Y', floors: [['G', 'Ground', 800, 'INS1', 80], ['F', '1st Floor', 800, 'INS2', 53], ['F', '2nd Floor', 800, 'INS2', 53], ['F', '3rd Floor', 750, 'INS2', 50]] }],
    status: 7, applied: '01-Jul-2022', final: '28-Jul-2022', parentId: 111, refNo: '2019060023', reviewer: 'RFO - Krishna', pay: 'challan', docs: ['OcNOC'], feedback: { rating: 5, remarks: 'Renewal was processed within the promised time.', rated_on: '02-Aug-2022' },
  },
  { id: 112, number: '', type: 'O', mode: 'N', owner: 'citizen2', site: 'Unnamed Plot - Draft', addr: 'Survey No. 44, Gajuwaka, Visakhapatnam', district: 3, builder: 'Any One Goes Pvt Ltd', mobile: '9112223344', email: 'builder2@example.com', plot: 0, perimeter: 0, lic: ['', ''], blocks: [], status: 1, applied: '', lastModified: '02-Jan-2023' },
  { id: 113, number: '', type: 'P', mode: '', owner: 'citizen3', site: 'Test Application - Do Not Use', addr: 'Test Address', district: 1, builder: 'Coastal Developers', mobile: '9223344556', email: 'coastal.dev@example.com', plot: 0, perimeter: 0, lic: ['', ''], blocks: [], status: 1, applied: '', lastModified: '18-Mar-2022' },
];


// ---------------------------------------------------------------------------
// Department workflow runs (Phase 3) — played with the engine itself, so queues, history and
// certificates are consistent with what the department portal does.
// ---------------------------------------------------------------------------
const workflows = read<WorkflowDefinition[]>('config/workflows.json');
const sla = read<SlaConfig>('config/sla.json');
const wctx: WorkflowContext = { users: read<UserAccount[]>('auth/users.json'), roles: read<DeptRole[]>('lookups/dept-roles.json') };
const at = (d: string) => parseLegacyDate(d)!;

type Step = [taskKey: string, date: string, remark: string, recommendation?: 'Y' | 'N'];
interface Script {
  steps: Step[];
  decision?: { outcome: WorkflowOutcome; date: string; remark: string };
}
const HQ_OK = (d: Record<string, string>): Step[] => [
  ['section', d.section, 'Applicant, plans, fees and bank guarantee verified. No deficiency.'],
  ['inspection', d.inspection, 'Site inspected along with the committee; measurements verified.', 'Y'],
  ['committee', d.inspection, 'I agree with the report submitted by the Chairman of the Inspection Committee.'],
];
const scripts: Record<number, Script> = {
  101: {
    steps: [
      ...HQ_OK({ section: '05-Aug-2016', inspection: '20-Aug-2016' }),
      ['rfo', '26-Aug-2016', 'Open spaces, staircases and fire fighting installations are as per NBC. Recommended.', 'Y'],
      ['adfs', '02-Sep-2016', 'Recommended for approval.', 'Y'],
      ['dfscd', '06-Sep-2016', 'Agree with the ADFS.', 'Y'],
      ['dfs', '10-Sep-2016', 'Concurred with ADFS recommendation.', 'Y'],
    ],
    decision: { outcome: 'approve', date: '28-Sep-2016', remark: '1. Provide signage and emergency lighting for the refuge areas.\n2. Submit the hydraulic test certificate of the wet riser system at the time of applying for Occupancy.' },
  },
  102: { steps: [['section', '05-Mar-2017', 'Documents verified; Municipal Completion Certificate to be obtained.']] },
  103: {
    steps: [
      ['section', '05-Jul-2016', 'Documents and fees verified.'],
      ['inspection', '22-Jul-2016', 'Open space deficiency observed on all sides.', 'N'],
      ['committee', '22-Jul-2016', 'I agree with the report submitted by the Chairman of the Inspection Committee.'],
      ['rfo', '29-Jul-2016', 'The mandatory open space of 9 m is not provided. Not recommended.', 'N'],
      ['adfs', '05-Aug-2016', 'Setback violation confirmed; recommend rejection.', 'N'],
      ['dfscd', '09-Aug-2016', 'Agree with the ADFS.', 'N'],
      ['dfs', '12-Aug-2016', 'Recommend rejection.', 'N'],
    ],
    decision: { outcome: 'reject', date: '19-Aug-2016', remark: 'Rejected: the mandatory open space of 9 m is not provided on the North, South and West sides (4 m proposed).' },
  },
  105: {
    steps: [
      ['inspection', '21-Feb-2018', 'Fire safety systems provided on only 80% of the requirement.', 'N'],
      ['dfo', '25-Feb-2018', 'Sprinkler and detection coverage incomplete. Not recommended.', 'N'],
    ],
    decision: { outcome: 'return', date: '02-Mar-2018', remark: 'Returned: complete the sprinkler and detection coverage and resubmit with a revised undertaking.' },
  },
  106: {
    steps: [
      ...HQ_OK({ section: '14-Jan-2021', inspection: '22-Jan-2021' }),
      ['rfo', '26-Jan-2021', 'Fire-fighting equipment tested and found satisfactory.', 'Y'],
      ['adfs', '28-Jan-2021', 'Recommended for renewal.', 'Y'],
      ['dfscd', '01-Feb-2021', 'Forwarded for final approval.', 'Y'],
    ],
  },
  107: { steps: [], decision: { outcome: 'approve', date: '18-May-2022', remark: 'Declaration accepted on record.' } },
  108: { steps: [['inspection', '05-Dec-2023', 'Site visit completed; report submitted.', 'Y']] },
  109: {
    steps: [
      ...HQ_OK({ section: '18-Jan-2024', inspection: '30-Jan-2024' }),
      ['rfo', '02-Feb-2024', 'Recommended.', 'Y'],
      ['adfs', '08-Feb-2024', 'Note prepared; recommend approval.', 'Y'],
    ],
  },
  110: {
    steps: [
      ...HQ_OK({ section: '15-Oct-2026', inspection: '24-Oct-2026' }),
      ['rfo', '27-Oct-2026', 'Recommended.', 'Y'],
      ['adfs', '30-Oct-2026', 'Reviewed.', 'Y'],
      ['dfscd', '04-Nov-2026', 'Concurred.', 'Y'],
    ],
  },
  111: {
    steps: [
      ['inspection', '28-Jun-2019', 'All fire safety systems installed and tested.', 'Y'],
      ['dfo', '05-Jul-2019', 'Recommended for issue of the Occupancy NOC.', 'Y'],
    ],
    decision: { outcome: 'approve', date: '30-Jul-2019', remark: '-Nil-' },
  },
  114: {
    steps: [
      ['inspection', '14-Jul-2022', 'Fire safety systems maintained in working condition.', 'Y'],
      ['dfo', '20-Jul-2022', 'Recommended for renewal.', 'Y'],
    ],
    decision: { outcome: 'approve', date: '28-Jul-2022', remark: '1. Replace the expired fire extinguishers on the 2nd floor.' },
  },
};

function playWorkflow(app: Application, all: Application[]): Application {
  const script = scripts[app.appl_id];
  if (app.status_id < 2) return app;
  if (!script) throw new Error(`No workflow script for seeded application ${app.appl_id}`);
  const expected = app.status_id;
  const level = app.appl_type === 'D' ? declarationLevel(app, all) : app.delegation_level;
  app.delegation_level = level;
  const def = findDefinition(workflows, app.appl_type, level)!;
  let a = startRun(app, def, wctx, at(app.applied_date));
  a.processLog = [processStep(a, 'Submitted', 'Application submitted by the applicant.', { name: a.build_name, role: 'Applicant' }, at(app.applied_date))];
  for (const [key, date, remark, reco] of script.steps) {
    const task = activeTasks(a.workflow!).find((t) => t.task_key === key);
    if (!task) throw new Error(`${app.appl_id}: task "${key}" is not active on ${date}`);
    if (!task.assignee) throw new Error(`${app.appl_id}: task "${key}" has no officer`);
    a = submitTask(a, task.task_id, task.assignee, { remark, ...(reco ? { recommendation: reco } : {}) }, wctx, at(date));
  }
  if (script.decision) {
    const task = currentTasks(a.workflow!).find((t) => t.state === 'active' && t.task_key === 'decision')!;
    a = decide(a, task.task_id, task.assignee!, script.decision.outcome, { remark: script.decision.remark, signed_document: { file_name: `signed-${app.appl_number}.pdf` } }, wctx, sla, renewalRules, at(script.decision.date));
  }
  if (a.status_id !== expected) throw new Error(`${app.appl_id}: workflow ends at status ${a.status_id}, expected ${expected}`);
  a.last_modified = script.decision?.date ?? script.steps.at(-1)?.[1] ?? app.applied_date;
  return a;
}

const built = specs.map(makeApp);
const apps = built.map((a) => playWorkflow(a, built));

// Messages and department documents (legacy "Sent SMS" / "Documents" panels of fulledit2).
const seedSms: Record<number, { message: string; sent_by: string; sent_on: string }[]> = {
  102: [{ message: 'Please upload the Municipal Completion Certificate on the Fire NOC portal.', sent_by: 'Section Officer (HQ)', sent_on: '05-Mar-2017' }],
  109: [
    { message: 'Inspection of Harbor View Residency is scheduled on 29-Jan-2024 at 11:00.', sent_by: 'DFO - Visakhapatnam', sent_on: '25-Jan-2024' },
    { message: 'Your application has been reviewed by the ADFS and forwarded.', sent_by: 'ADFS (HQ)', sent_on: '08-Feb-2024' },
  ],
  105: [{ message: 'Your Occupancy NOC application has been returned with remarks. Please revise and resubmit.', sent_by: 'RFO - Eastern Region', sent_on: '02-Mar-2018' }],
};
// Applications received through the partner portals (legacy host_name: SDP / MAUD single-window portals).
const hosts: Record<number, 'SDP' | 'MAUD'> = { 108: 'MAUD', 111: 'SDP' };
for (const a of apps) {
  if (hosts[a.appl_id]) a.host_name = hosts[a.appl_id];
  a.sms = (seedSms[a.appl_id] ?? []).map((m, i) => ({ sms_id: i + 1, ...m }));
  a.dept_documents = a.appl_id === 109 ? [{ doc_id: 1, file_name: 'inspection-photos.pdf', description: 'Inspection photographs', uploaded_by: 'DFO - Visakhapatnam', uploaded_on: '30-Jan-2024' }] : [];
}

// Occupancy 102 keeps the Provisional NOC (101) values for the "as per PNOC" comparisons.
const p101 = apps.find((a) => a.appl_id === 101)!;
const o102 = apps.find((a) => a.appl_id === 102)!;
o102.blocks.forEach((b, i) => {
  const pb = p101.blocks[i];
  b.floors.forEach((f, j) => {
    f.parent_built_area = pb.floors[j].built_area;
    f.parent_occ_c_app = pb.floors[j].occ_c_app;
  });
  b.ospaces.forEach((o, j) => {
    o.parent_proposed = pb.ospaces[j].proposed;
    o.os_preqd = reqdOpenSpace(pb, o.direc, p101.plot_area, 'P', '');
  });
  const carried = carryRequiredToProposed(pb.ffe);
  for (const item of b.ffe.items) {
    const src = carried.items.find((x) => x.equip_id === item.equip_id);
    if (!src) continue;
    if (item.level === 'B') item.block.prop = src.block.prop;
    else for (const [fid, cell] of Object.entries(item.floors)) cell.prop = src.floors[fid]?.prop ?? cell.prop;
  }
});
void carryProvidedToProposed;

// ---------------------------------------------------------------------------
// Verify: every submitted application passes the submission validation (blocks/escapes/ffe).
// Documents are not checked for historical applications (older document requirements).
// ---------------------------------------------------------------------------
let problems = 0;
for (const app of apps.filter((a) => a.status_id > 1)) {
  const issues = validateApplication(app, { ...ctx, now: parseLegacyDate(app.applied_date) ?? undefined }).filter((i) => i.severity === 'error' && i.step !== 'documents' && !(app.appl_id === 103 && i.step === 'blocks'));
  for (const i of issues) {
    problems++;
    console.error(`#${app.appl_id} [${i.step}] ${i.field}: ${i.message}`);
  }
}
if (problems) {
  console.error(`${problems} validation problem(s) in seeded applications`);
  process.exit(1);
}

writeFileSync(join(DATA, 'applications', 'applications.json'), JSON.stringify(apps, null, 1) + '\n');

const users: UserAccount[] = JSON.parse(readFileSync(join(DATA, 'auth', 'users.json'), 'utf8'));
writeFileSync(join(DATA, 'auth', 'users.json'), JSON.stringify(users, null, 2) + '\n');

for (const a of apps) {
  console.log(
    a.appl_id,
    a.appl_type,
    a.appl_mode || '-',
    'status', a.status_id,
    a.delegation_level,
    'fee', a.payment.amount,
    'blocks', a.blocks.map((b) => `${b.block_name}:${blockBuiltUp(b)}sqm:${b.ffe.items.length}ffe`).join(' '),
    a.valid_to ? `valid_to ${a.valid_to}` : '',
  );
}
