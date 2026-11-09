/**
 * ============================================================================
 *  CENTRAL API CATALOG
 * ============================================================================
 * This is the ONLY file in the application that is allowed to know the
 * on-disk location of a JSON "API" fixture. Every feature service asks for
 * data via `ApiClient.get(API_ENDPOINTS.someId)` / `.mutate(...)` — never by
 * hardcoding an asset path or calling HttpClient directly.
 *
 * Each entry also records the *legacy* ASP.NET RPC endpoint it replaces, for
 * traceability back to the original AngularJS application (see
 * docs/03-api-catalog.md for the full narrative mapping).
 *
 * `asset` paths may contain `:param` placeholders (e.g. `:id`) which
 * `ApiClient` substitutes from the params passed at call time.
 * ============================================================================
 */

export type HttpMethodKind = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiEndpoint {
  /** Stable key — also used as the record key in API_ENDPOINTS. */
  id: string;
  /** Human readable description, surfaced in the /dev/data explorer. */
  description: string;
  method: HttpMethodKind;
  /** Path under `assets/`, may contain `:param` placeholders. */
  asset: string;
  /** True when the asset is a JSON array / list resource. */
  collection?: boolean;
  /** True when calls against this endpoint should go through the mock
   *  write-simulation (localStorage) layer rather than being a pure read
   *  of the static seed file. */
  mutates?: boolean;
  /** The original legacy ASP.NET endpoint this replaces (traceability). */
  legacy: string;
}

function endpoint(e: ApiEndpoint): ApiEndpoint {
  return e;
}

export const API_ENDPOINTS = {
  // ---------------------------------------------------------------------
  // Lookups / master data (all read-only)
  // ---------------------------------------------------------------------
  lookupApplicationTypes: endpoint({
    id: 'lookupApplicationTypes',
    description: 'Application type catalog (Provisional/Occupancy/Renewal/Declaration) incl. FFE column modes',
    method: 'GET',
    asset: 'assets/data/lookups/application-types.json',
    collection: true,
    legacy: 'apis/ApplTypes.txt',
  }),
  lookupBuildTypes: endpoint({
    id: 'lookupBuildTypes',
    description: 'Building occupancy/use type catalog with height limits',
    method: 'GET',
    asset: 'assets/data/lookups/build-types.json',
    collection: true,
    legacy: 'apis/BuildTypes.txt',
  }),
  lookupDirections: endpoint({
    id: 'lookupDirections',
    description: 'Compass directions',
    method: 'GET',
    asset: 'assets/data/lookups/directions.json',
    collection: true,
    legacy: 'apis/Directions.txt',
  }),
  lookupDistricts: endpoint({
    id: 'lookupDistricts',
    description: 'District master list',
    method: 'GET',
    asset: 'assets/data/lookups/districts.json',
    collection: true,
    legacy: 'apis/Districts.txt',
  }),
  lookupFireStations: endpoint({
    id: 'lookupFireStations',
    description: 'Fire stations grouped by district',
    method: 'GET',
    asset: 'assets/data/lookups/fire-stations.json',
    collection: true,
    legacy: 'apis/FireStations.txt',
  }),
  lookupHazards: endpoint({
    id: 'lookupHazards',
    description: 'Hazard / activity classification list',
    method: 'GET',
    asset: 'assets/data/lookups/hazards.json',
    collection: true,
    legacy: 'apis/Hazards.txt',
  }),
  lookupMappedCodes: endpoint({
    id: 'lookupMappedCodes',
    description: 'DTCP <-> NBC activity code mapping',
    method: 'GET',
    asset: 'assets/data/lookups/mapped-codes.json',
    collection: true,
    legacy: 'apis/MappedCodes.txt',
  }),
  lookupEquipments: endpoint({
    id: 'lookupEquipments',
    description: 'Fire fighting equipment catalog',
    method: 'GET',
    asset: 'assets/data/lookups/equipments.json',
    collection: true,
    legacy: 'apis/Equipments.txt',
  }),
  lookupFfeNotes: endpoint({
    id: 'lookupFfeNotes',
    description: 'Explanatory footnotes for FFE requirement tables',
    method: 'GET',
    asset: 'assets/data/lookups/ffe-notes.json',
    legacy: 'apis/FFE_Notes.txt',
  }),
  lookupStatuses: endpoint({
    id: 'lookupStatuses',
    description: 'Canonical application lifecycle statuses (1-9)',
    method: 'GET',
    asset: 'assets/data/lookups/statuses.json',
    collection: true,
    legacy: 'apis/Statuses.txt',
  }),
  lookupDeptRoles: endpoint({
    id: 'lookupDeptRoles',
    description: 'Department role catalog (legacy role ids) with the typical jurisdiction of each role',
    method: 'GET',
    asset: 'assets/data/lookups/dept-roles.json',
    collection: true,
    legacy: '(server-side roles table)',
  }),
  lookupRegions: endpoint({
    id: 'lookupRegions',
    description: 'Regions (RFO jurisdictions): districts of the Eastern and Southern regions',
    method: 'GET',
    asset: 'assets/data/lookups/regions.json',
    collection: true,
    legacy: '(server-side: RFO-ER / RFO-SR users)',
  }),
  lookupPartyRoles: endpoint({
    id: 'lookupPartyRoles',
    description: 'Technical party roles and which application types require them',
    method: 'GET',
    asset: 'assets/data/lookups/party-roles.json',
    collection: true,
    legacy: 'apis/newappl.txt parties[]',
  }),
  lookupBlockOptions: endpoint({
    id: 'lookupBlockOptions',
    description: 'Floor types, floor occupancies, escape types, side property types',
    method: 'GET',
    asset: 'assets/data/lookups/block-options.json',
    legacy: '(hardcoded in editpnoc_1.html)',
  }),
  lookupDocumentRequirements: endpoint({
    id: 'lookupDocumentRequirements',
    description: 'Required documents & plans per application type',
    method: 'GET',
    asset: 'assets/data/lookups/document-requirements.json',
    legacy: 'editpnoc.html / editonoc.html / editrnoc.html / editdnoc.html upload sections',
  }),

  lookupEscapeRules: endpoint({
    id: 'lookupEscapeRules',
    description: 'Travel distance, exit, head-room, projection and refuge limits',
    method: 'GET',
    asset: 'assets/data/lookups/escape-rules.json',
    legacy: 'editpnoc_2.html + commonrules.js (Table 5)',
  }),
  lookupNocTerms: endpoint({
    id: 'lookupNocTerms',
    description: 'Conditions printed on NOCs (verbatim legal text per type / delegation level)',
    method: 'GET',
    asset: 'assets/data/lookups/noc-terms.json',
    legacy: 'modules/dept/partials/noc_terms*.html',
  }),
  lookupNbcTable7: endpoint({
    id: 'lookupNbcTable7',
    description: 'NBC Part 4 Table 7 — minimum requirements for fire fighting installations (reference shown with the FFE grid)',
    method: 'GET',
    asset: 'assets/data/lookups/nbc-table7.json',
    legacy: 'modules/common/partials/table23.html',
  }),
  lookupUndertakings: endpoint({
    id: 'lookupUndertakings',
    description: 'Undertakings the applicant ticks on the final confirmation page, per application type',
    method: 'GET',
    asset: 'assets/data/lookups/undertakings.json',
    legacy: 'modules/citizen/partials/confirmpnoc.html / confirmonoc.html / confirmrnoc.html',
  }),
  lookupOccupancyConditions: endpoint({
    id: 'lookupOccupancyConditions',
    description: 'Provisional NOC conditions to confirm when applying for Occupancy',
    method: 'GET',
    asset: 'assets/data/lookups/occupancy-conditions.json',
    collection: true,
    legacy: 'confirmpconditions.html / saveconditions.aspx',
  }),

  // ---------------------------------------------------------------------
  // Rule trees (verbatim from NOC-base/uploads/rules, read-only)
  // ---------------------------------------------------------------------
  rulesFfeEquipment: endpoint({
    id: 'rulesFfeEquipment',
    description: 'FFE decision tree for one equipment id (:id = Equipments.txt id)',
    method: 'GET',
    asset: 'assets/data/rules/ffe/:id.json',
    legacy: 'uploads/rules/{id}.rule (calculateffe.aspx / floorwise_ffe.aspx)',
  }),
  rulesFfeType: endpoint({
    id: 'rulesFfeType',
    description: 'Fire extinguisher type decision tree (note key)',
    method: 'GET',
    asset: 'assets/data/rules/ffe-type.json',
    legacy: 'uploads/rules/ffe_type.rule',
  }),
  rulesOtherNotes: endpoint({
    id: 'rulesOtherNotes',
    description: 'Block-level FFE notes decision tree',
    method: 'GET',
    asset: 'assets/data/rules/other-notes.json',
    legacy: 'uploads/rules/other_notes.rule',
  }),
  rulesRiserWidth: endpoint({
    id: 'rulesRiserWidth',
    description: 'Wet riser / down comer size decision tree',
    method: 'GET',
    asset: 'assets/data/rules/riser-width.json',
    legacy: 'uploads/rules/riser_width.rule',
  }),
  rulesHeightLimits: endpoint({
    id: 'rulesHeightLimits',
    description: 'Maximum permissible height by occupancy decision tree',
    method: 'GET',
    asset: 'assets/data/rules/height-limits.json',
    legacy: 'uploads/rules/validations/height.rule',
  }),

  // ---------------------------------------------------------------------
  // Admin-configurable business rules (mutable config stores)
  // ---------------------------------------------------------------------
  configFees: endpoint({
    id: 'configFees',
    description: 'Fee rates per sq.m, penalties, declaration fee and portal charges',
    method: 'GET',
    asset: 'assets/data/config/fee-config.json',
    mutates: true,
    legacy: '(server-side challan_amt_reqd / PFInit.aspx)',
  }),
  adminSaveFees: endpoint({
    id: 'adminSaveFees',
    description: 'Admin: update fee configuration',
    method: 'PUT',
    asset: 'assets/data/config/fee-config.json',
    mutates: true,
    legacy: '(new) admin rules configuration',
  }),
  configDelegationRules: endpoint({
    id: 'configDelegationRules',
    description: 'Approval level (MSB/RFO/DFO) rules',
    method: 'GET',
    asset: 'assets/data/config/delegation-rules.json',
    collection: true,
    mutates: true,
    legacy: 'uploads/rules/validations/MSB.rule',
  }),
  adminSaveDelegationRules: endpoint({
    id: 'adminSaveDelegationRules',
    description: 'Admin: update approval level rules',
    method: 'PUT',
    asset: 'assets/data/config/delegation-rules.json',
    mutates: true,
    legacy: '(new) admin rules configuration',
  }),
  configRenewalRules: endpoint({
    id: 'configRenewalRules',
    description: 'Renewal periodicity rules',
    method: 'GET',
    asset: 'assets/data/config/renewal-rules.json',
    collection: true,
    mutates: true,
    legacy: 'uploads/rules/validations/declaration.rule + images/periodicityofrenewal.png',
  }),
  adminSaveRenewalRules: endpoint({
    id: 'adminSaveRenewalRules',
    description: 'Admin: update renewal periodicity rules',
    method: 'PUT',
    asset: 'assets/data/config/renewal-rules.json',
    mutates: true,
    legacy: '(new) admin rules configuration',
  }),

  // ---------------------------------------------------------------------
  // Accounts & auth (single mutable accounts store)
  // ---------------------------------------------------------------------
  accountsList: endpoint({
    id: 'accountsList',
    description: 'All login accounts (citizen, department, admin)',
    method: 'GET',
    asset: 'assets/data/auth/users.json',
    collection: true,
    mutates: true,
    legacy: 'modules/register/login.aspx + users.aspx',
  }),
  authRegister: endpoint({
    id: 'authRegister',
    description: 'Register a new citizen account',
    method: 'POST',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: 'modules/register/register.aspx',
  }),
  authForgotPassword: endpoint({
    id: 'authForgotPassword',
    description: 'Request a password reset by e-mail',
    method: 'POST',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: 'modules/register/forgotpwd.aspx',
  }),
  authChangePassword: endpoint({
    id: 'authChangePassword',
    description: 'Change the password of the logged-in user (self-service)',
    method: 'PUT',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: 'modules/register/changepass.aspx / dept chpwd',
  }),
  adminCitizenUpdate: endpoint({
    id: 'adminCitizenUpdate',
    description: 'Admin: modify a citizen account profile',
    method: 'PUT',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: '(new) admin account management',
  }),
  adminCitizenChangePassword: endpoint({
    id: 'adminCitizenChangePassword',
    description: 'Admin: set a new password for a citizen account',
    method: 'PUT',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: 'modules/register/changepass.aspx',
  }),
  adminAccountSetActive: endpoint({
    id: 'adminAccountSetActive',
    description: 'Admin: deactivate / reactivate any citizen or department account',
    method: 'PUT',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: '(new) admin account management',
  }),
  adminDeptUserCreate: endpoint({
    id: 'adminDeptUserCreate',
    description: 'Admin: add a department user',
    method: 'POST',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: '(new) admin account management',
  }),
  adminDeptUserUpdate: endpoint({
    id: 'adminDeptUserUpdate',
    description: 'Admin: modify a department user',
    method: 'PUT',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: '(new) admin account management',
  }),
  adminDeptUserResetPassword: endpoint({
    id: 'adminDeptUserResetPassword',
    description: 'Admin: reset a department user password (temporary password)',
    method: 'PUT',
    asset: 'assets/data/auth/users.json',
    mutates: true,
    legacy: '(new) admin account management',
  }),

  // ---------------------------------------------------------------------
  // Applications (single mutable store; citizen, dept and admin views are projections)
  // ---------------------------------------------------------------------
  citizenApplicationList: endpoint({
    id: 'citizenApplicationList',
    description: "Citizen's own applications",
    method: 'GET',
    asset: 'assets/data/applications/applications.json',
    collection: true,
    mutates: true,
    legacy: 'modules/citizen/applications.aspx',
  }),
  citizenApplicationDetail: endpoint({
    id: 'citizenApplicationDetail',
    description: 'Full application aggregate by id',
    method: 'GET',
    asset: 'assets/data/applications/applications.json',
    collection: true,
    mutates: true,
    legacy: 'modules/citizen/application.aspx',
  }),
  citizenApplicationCreate: endpoint({
    id: 'citizenApplicationCreate',
    description: 'Create a new draft application (any type)',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/newapplication.aspx / newdeclaration.aspx',
  }),
  citizenOccupancyFromProvisional: endpoint({
    id: 'citizenOccupancyFromProvisional',
    description: 'Create an Occupancy draft carried forward from an issued Provisional NOC',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/newonocappl.aspx',
  }),
  citizenRenewalFromOccupancy: endpoint({
    id: 'citizenRenewalFromOccupancy',
    description: 'Create a Renewal draft carried forward from an issued Occupancy NOC',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/NewRenewals.aspx',
  }),
  citizenApplicationUpdate: endpoint({
    id: 'citizenApplicationUpdate',
    description: 'Save a draft application incl. blocks/floors/FFE (legacy SaveApplication — only site name + address needed)',
    method: 'PUT',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/update_application.aspx + saveblockdetails.aspx + saveffe.aspx',
  }),
  citizenApplicationSubmit: endpoint({
    id: 'citizenApplicationSubmit',
    description: 'Submit a draft application to the department',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/submitapplication.aspx',
  }),
  citizenApplicationRevise: endpoint({
    id: 'citizenApplicationRevise',
    description: 'Reopen a returned/rejected application as a new revision',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/revise.aspx',
  }),
  citizenApplicationDelete: endpoint({
    id: 'citizenApplicationDelete',
    description: 'Delete a draft application',
    method: 'DELETE',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/delete_application.aspx',
  }),
  documentUpload: endpoint({
    id: 'documentUpload',
    description: 'Attach a document/plan (metadata only in this stub build)',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/uploaddocs.aspx / uploadplans.aspx',
  }),
  citizenRequestedDocUpload: endpoint({
    id: 'citizenRequestedDocUpload',
    description: 'Upload a document requested by the department',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/uploaddeptdocs.aspx / upload_request.aspx',
  }),
  paymentInitiate: endpoint({
    id: 'paymentInitiate',
    description: 'Online fee payment (simulated gateway)',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'PFInit.aspx / PaymentRequest.aspx / PaymentReturn.aspx',
  }),
  citizenFeedbackSave: endpoint({
    id: 'citizenFeedbackSave',
    description: 'Citizen rating / feedback on a completed application',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/citizen/savefeedback.aspx',
  }),
  deptFeedbackRatings: endpoint({
    id: 'deptFeedbackRatings',
    description: 'Average citizen rating (dept dashboard)',
    method: 'GET',
    asset: 'assets/data/applications/applications.json',
    collection: true,
    mutates: true,
    legacy: 'modules/dept/Feedback_AvgRating.aspx',
  }),
  deptQueue: endpoint({
    id: 'deptQueue',
    description: 'All submitted applications visible to department staff',
    method: 'GET',
    asset: 'assets/data/applications/applications.json',
    collection: true,
    mutates: true,
    legacy: 'modules/dept/applications.aspx',
  }),
  adminApplicationSearch: endpoint({
    id: 'adminApplicationSearch',
    description: 'Admin: search all applications (incl. drafts)',
    method: 'GET',
    asset: 'assets/data/applications/applications.json',
    collection: true,
    mutates: true,
    legacy: 'modules/dept/search.aspx + draftfiles.htm',
  }),
  adminApplicationDelete: endpoint({
    id: 'adminApplicationDelete',
    description: 'Admin: delete applications',
    method: 'DELETE',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/admin/deleteOldFiles.aspx',
  }),

  // ---------------------------------------------------------------------
  // Department workflow (Phase 3): admin configuration, runs, reports
  // ---------------------------------------------------------------------
  configWorkflows: endpoint({
    id: 'configWorkflows',
    description: 'Workflow per application type × approval level (stages, tasks, roles, forms, permissions)',
    method: 'GET',
    asset: 'assets/data/config/workflows.json',
    collection: true,
    mutates: true,
    legacy: '(server-side process steps — process_steps.aspx)',
  }),
  configWorkflowsDefault: endpoint({
    id: 'configWorkflowsDefault',
    description: 'Workflows as shipped (used by "Restore default")',
    method: 'GET',
    asset: 'assets/data/config/workflows.json',
    collection: true,
    legacy: '(new)',
  }),
  adminSaveWorkflows: endpoint({
    id: 'adminSaveWorkflows',
    description: 'Admin: save the workflows',
    method: 'PUT',
    asset: 'assets/data/config/workflows.json',
    collection: true,
    mutates: true,
    legacy: '(new) admin workflow configuration',
  }),
  configForms: endpoint({
    id: 'configForms',
    description: 'Note / report forms a workflow task can use',
    method: 'GET',
    asset: 'assets/data/config/forms.json',
    collection: true,
    legacy: 'modules/dept/partials/*_note*.html, dfo_report*.html, dgfs_note*.html',
  }),
  configSla: endpoint({
    id: 'configSla',
    description: 'SLA per workflow (per step, inspection, processing) and escalation recipients',
    method: 'GET',
    asset: 'assets/data/config/sla.json',
    mutates: true,
    legacy: '(new; legacy rtimeout / escalations.aspx)',
  }),
  adminSaveSla: endpoint({
    id: 'adminSaveSla',
    description: 'Admin: save the SLA and escalation settings',
    method: 'PUT',
    asset: 'assets/data/config/sla.json',
    mutates: true,
    legacy: '(new) admin SLA configuration',
  }),
  deptApplication: endpoint({
    id: 'deptApplication',
    description: 'Department: one application with its workflow run',
    method: 'GET',
    asset: 'assets/data/applications/applications.json',
    collection: true,
    mutates: true,
    legacy: 'modules/citizen/application.aspx + modules/dept/process_steps.aspx',
  }),
  deptTaskSave: endpoint({
    id: 'deptTaskSave',
    description: 'Department: save the note / report of a task as a draft',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/process_move.aspx?s=false',
  }),
  deptTaskSubmit: endpoint({
    id: 'deptTaskSubmit',
    description: 'Department: submit the note / report of a task',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/process_move.aspx?s=true',
  }),
  deptDecision: endpoint({
    id: 'deptDecision',
    description: 'Department: final decision of the issuing authority (with the signed NOC / letter)',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/process_move.aspx (final step) + uploaddocs.aspx (FinalDoc)',
  }),
  deptSendBack: endpoint({
    id: 'deptSendBack',
    description: 'Department: send the file back to the previous stage',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/sendback.aspx',
  }),
  deptSkipTask: endpoint({
    id: 'deptSkipTask',
    description: 'Department: the issuing authority bypasses an officer',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/process_move.aspx (Officer Bypassed)',
  }),
  deptReassignTask: endpoint({
    id: 'deptReassignTask',
    description: 'Department: the issuing authority changes the officer of a task',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/reassign.aspx',
  }),
  deptRequestDocuments: endpoint({
    id: 'deptRequestDocuments',
    description: 'Department: request a document from the applicant',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/uploaddeptdocs.aspx (request)',
  }),
  deptUploadDocument: endpoint({
    id: 'deptUploadDocument',
    description: 'Department: upload a document (e.g. inspection photographs)',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/uploaddeptdocs.aspx',
  }),
  deptSendSms: endpoint({
    id: 'deptSendSms',
    description: 'Department: send an SMS to the applicant (simulated)',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/sendsms.aspx',
  }),
  deptUpdateFireStation: endpoint({
    id: 'deptUpdateFireStation',
    description: 'Department: change the fire station of a file (Submitted only)',
    method: 'PUT',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/update_application.aspx (fire station)',
  }),
  deptUpdateLicensingAuthority: endpoint({
    id: 'deptUpdateLicensingAuthority',
    description: 'Department: update the licensing authority (final stage only)',
    method: 'PUT',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: 'modules/dept/update_application.aspx (licensing authority)',
  }),
  adminReassignTasks: endpoint({
    id: 'adminReassignTasks',
    description: 'Admin: move the open tasks of an officer to another officer',
    method: 'POST',
    asset: 'assets/data/applications/applications.json',
    mutates: true,
    legacy: '(new) — deactivation of an officer',
  }),
  deptReports: endpoint({
    id: 'deptReports',
    description: 'Department reports (pendency, statistics, consolidated, applications, overdue, SMS, feedback, challan, district, level-wise)',
    method: 'GET',
    asset: 'assets/data/applications/applications.json',
    collection: true,
    mutates: true,
    legacy: 'modules/dept/reports.aspx (Rpt_type 1-7) + reports/rpt_*.html',
  }),

  // ---------------------------------------------------------------------
  // Admin utilities
  // ---------------------------------------------------------------------
  adminSendEscalations: endpoint({
    id: 'adminSendEscalations',
    description: 'Escalation reminders for tasks / applications past their SLA',
    method: 'POST',
    asset: 'assets/data/admin/escalations.json',
    mutates: true,
    legacy: 'modules/admin/escalations.aspx',
  }),
} as const satisfies Record<string, ApiEndpoint>;

export type ApiEndpointId = keyof typeof API_ENDPOINTS;
