# NOC Portal — API Catalog (legacy RPC → mock API)

The legacy backend is ASP.NET, called as RPC-style endpoints (`*.aspx?PARAM=value` for reads,
`POST` with form-encoded JSON for writes), always same-origin with `withCredentials`. There is
**no backend in this repository** — only flat JSON stubs in `apis/*.txt` that some legacy
controllers fetched directly during UI development.

The Angular application does not reimplement a backend. It defines one explicit **API
catalog** (`src/app/core/api/api-endpoints.ts`) that is the *only* place allowed to know a
JSON asset's URL. Every feature service calls the catalog, never `HttpClient` with a literal
path. This gives:

- One file that lists every API the frontend calls, like a real backend's route table.
- A seam for swapping the mock `ApiClient` for a real `HttpClient` backend without touching
  feature code.
- A place to simulate **writes** (create / update / delete / submit / transition) against an
  in-memory, `localStorage`-backed store seeded from the JSON fixtures.

## 1. Catalog shape

```ts
export interface ApiEndpoint {
  id: string;            // stable key, used everywhere in the app
  description: string;   // human-readable purpose
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  asset: string;         // path under /assets/data/** used to seed/read
  collection?: boolean;  // asset is an array / list resource
  mutates?: boolean;     // routed through the write simulation (localStorage)
  legacy: string;        // the original ASP.NET endpoint, for traceability
}
```

`API_ENDPOINTS` is a `Record<string, ApiEndpoint>`. Feature services call `ApiClient.get /
update / upsertInCollection / removeFromCollection / save` with an entry from it. ESLint
(`no-restricted-imports`) forbids importing `HttpClient` anywhere except
`core/api/api-client.service.ts` and `core/api/mock-persistence.service.ts`.

Several logical endpoints intentionally share one asset (for example every application
operation uses `applications/applications.json`). The catalog mirrors the legacy **API
surface** (one entry per RPC); the mock store mirrors its **database** (one table per
aggregate). Swapping in a real backend means changing `ApiClient`, not feature code.

## 2. Traceability matrix

Generated from `api-endpoints.ts` with `npx tsx scripts/generate-api-doc.ts`. If the catalog
changes, regenerate this section from that script's output so it cannot drift.

### Lookups / master data (all read-only)

| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |
|---|---|---|---|---|---|
| `lookupApplicationTypes` | GET | `lookups/application-types.json` | — | `apis/ApplTypes.txt` | Application type catalog (Provisional/Occupancy/Renewal/Declaration) incl. FFE column modes |
| `lookupBuildTypes` | GET | `lookups/build-types.json` | — | `apis/BuildTypes.txt` | Building occupancy/use type catalog with height limits |
| `lookupDirections` | GET | `lookups/directions.json` | — | `apis/Directions.txt` | Compass directions |
| `lookupDistricts` | GET | `lookups/districts.json` | — | `apis/Districts.txt` | District master list |
| `lookupFireStations` | GET | `lookups/fire-stations.json` | — | `apis/FireStations.txt` | Fire stations grouped by district |
| `lookupHazards` | GET | `lookups/hazards.json` | — | `apis/Hazards.txt` | Hazard / activity classification list |
| `lookupMappedCodes` | GET | `lookups/mapped-codes.json` | — | `apis/MappedCodes.txt` | DTCP <-> NBC activity code mapping |
| `lookupEquipments` | GET | `lookups/equipments.json` | — | `apis/Equipments.txt` | Fire fighting equipment catalog |
| `lookupFfeNotes` | GET | `lookups/ffe-notes.json` | — | `apis/FFE_Notes.txt` | Explanatory footnotes for FFE requirement tables |
| `lookupStatuses` | GET | `lookups/statuses.json` | — | `apis/Statuses.txt` | Canonical application lifecycle statuses (1-9) |
| `lookupDeptRoles` | GET | `lookups/dept-roles.json` | — | `(server-side roles table)` | Department role catalog (legacy role ids) with the typical jurisdiction of each role |
| `lookupRegions` | GET | `lookups/regions.json` | — | `(server-side: RFO-ER / RFO-SR users)` | Regions (RFO jurisdictions): districts of the Eastern and Southern regions |
| `lookupPartyRoles` | GET | `lookups/party-roles.json` | — | `apis/newappl.txt parties[]` | Technical party roles and which application types require them |
| `lookupBlockOptions` | GET | `lookups/block-options.json` | — | `(hardcoded in editpnoc_1.html)` | Floor types, floor occupancies, escape types, side property types |
| `lookupDocumentRequirements` | GET | `lookups/document-requirements.json` | — | `editpnoc.html / editonoc.html / editrnoc.html / editdnoc.html upload sections` | Required documents & plans per application type |
| `lookupEscapeRules` | GET | `lookups/escape-rules.json` | — | `editpnoc_2.html + commonrules.js (Table 5)` | Travel distance, exit, head-room, projection and refuge limits |
| `lookupNocTerms` | GET | `lookups/noc-terms.json` | — | `modules/dept/partials/noc_terms*.html` | Conditions printed on NOCs (verbatim legal text per type / delegation level) |
| `lookupNbcTable7` | GET | `lookups/nbc-table7.json` | — | `modules/common/partials/table23.html` | NBC Part 4 Table 7 — minimum requirements for fire fighting installations (reference shown with the FFE grid) |
| `lookupUndertakings` | GET | `lookups/undertakings.json` | — | `modules/citizen/partials/confirmpnoc.html / confirmonoc.html / confirmrnoc.html` | Undertakings the applicant ticks on the final confirmation page, per application type |
| `lookupOccupancyConditions` | GET | `lookups/occupancy-conditions.json` | — | `confirmpconditions.html / saveconditions.aspx` | Provisional NOC conditions to confirm when applying for Occupancy |

### Rule trees (verbatim from NOC-base/uploads/rules, read-only)

| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |
|---|---|---|---|---|---|
| `rulesFfeEquipment` | GET | `rules/ffe/:id.json` | — | `uploads/rules/{id}.rule (calculateffe.aspx / floorwise_ffe.aspx)` | FFE decision tree for one equipment id (:id = Equipments.txt id) |
| `rulesFfeType` | GET | `rules/ffe-type.json` | — | `uploads/rules/ffe_type.rule` | Fire extinguisher type decision tree (note key) |
| `rulesOtherNotes` | GET | `rules/other-notes.json` | — | `uploads/rules/other_notes.rule` | Block-level FFE notes decision tree |
| `rulesRiserWidth` | GET | `rules/riser-width.json` | — | `uploads/rules/riser_width.rule` | Wet riser / down comer size decision tree |
| `rulesHeightLimits` | GET | `rules/height-limits.json` | — | `uploads/rules/validations/height.rule` | Maximum permissible height by occupancy decision tree |

### Admin-configurable business rules (mutable config stores)

| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |
|---|---|---|---|---|---|
| `configFees` | GET | `config/fee-config.json` | yes | `(server-side challan_amt_reqd / PFInit.aspx)` | Fee rates per sq.m, penalties, declaration fee and portal charges |
| `adminSaveFees` | PUT | `config/fee-config.json` | yes | `(new) admin rules configuration` | Admin: update fee configuration |
| `configDelegationRules` | GET | `config/delegation-rules.json` | yes | `uploads/rules/validations/MSB.rule` | Approval level (MSB/RFO/DFO) rules |
| `adminSaveDelegationRules` | PUT | `config/delegation-rules.json` | yes | `(new) admin rules configuration` | Admin: update approval level rules |
| `configRenewalRules` | GET | `config/renewal-rules.json` | yes | `uploads/rules/validations/declaration.rule + images/periodicityofrenewal.png` | Renewal periodicity rules |
| `adminSaveRenewalRules` | PUT | `config/renewal-rules.json` | yes | `(new) admin rules configuration` | Admin: update renewal periodicity rules |

### Accounts & auth (single mutable accounts store)

| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |
|---|---|---|---|---|---|
| `accountsList` | GET | `auth/users.json` | yes | `modules/register/login.aspx + users.aspx` | All login accounts (citizen, department, admin) |
| `authRegister` | POST | `auth/users.json` | yes | `modules/register/register.aspx` | Register a new citizen account |
| `authForgotPassword` | POST | `auth/users.json` | yes | `modules/register/forgotpwd.aspx` | Request a password reset by e-mail |
| `authChangePassword` | PUT | `auth/users.json` | yes | `modules/register/changepass.aspx / dept chpwd` | Change the password of the logged-in user (self-service) |
| `adminCitizenUpdate` | PUT | `auth/users.json` | yes | `(new) admin account management` | Admin: modify a citizen account profile |
| `adminCitizenChangePassword` | PUT | `auth/users.json` | yes | `modules/register/changepass.aspx` | Admin: set a new password for a citizen account |
| `adminAccountSetActive` | PUT | `auth/users.json` | yes | `(new) admin account management` | Admin: deactivate / reactivate any citizen or department account |
| `adminDeptUserCreate` | POST | `auth/users.json` | yes | `(new) admin account management` | Admin: add a department user |
| `adminDeptUserUpdate` | PUT | `auth/users.json` | yes | `(new) admin account management` | Admin: modify a department user |
| `adminDeptUserResetPassword` | PUT | `auth/users.json` | yes | `(new) admin account management` | Admin: reset a department user password (temporary password) |

### Applications (single mutable store; citizen, dept and admin views are projections)

| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |
|---|---|---|---|---|---|
| `citizenApplicationList` | GET | `applications/applications.json` | yes | `modules/citizen/applications.aspx` | Citizen's own applications |
| `citizenApplicationDetail` | GET | `applications/applications.json` | yes | `modules/citizen/application.aspx` | Full application aggregate by id |
| `citizenApplicationCreate` | POST | `applications/applications.json` | yes | `modules/citizen/newapplication.aspx / newdeclaration.aspx` | Create a new draft application (any type) |
| `citizenOccupancyFromProvisional` | POST | `applications/applications.json` | yes | `modules/citizen/newonocappl.aspx` | Create an Occupancy draft carried forward from an issued Provisional NOC |
| `citizenRenewalFromOccupancy` | POST | `applications/applications.json` | yes | `modules/citizen/NewRenewals.aspx` | Create a Renewal draft carried forward from an issued Occupancy NOC |
| `citizenApplicationUpdate` | PUT | `applications/applications.json` | yes | `modules/citizen/update_application.aspx + saveblockdetails.aspx + saveffe.aspx` | Save a draft application incl. blocks/floors/FFE (legacy SaveApplication — only site name + address needed) |
| `citizenApplicationSubmit` | POST | `applications/applications.json` | yes | `modules/citizen/submitapplication.aspx` | Submit a draft application to the department |
| `citizenApplicationRevise` | POST | `applications/applications.json` | yes | `modules/citizen/revise.aspx` | Reopen a returned/rejected application as a new revision |
| `citizenApplicationDelete` | DELETE | `applications/applications.json` | yes | `modules/citizen/delete_application.aspx` | Delete a draft application |
| `documentUpload` | POST | `applications/applications.json` | yes | `modules/citizen/uploaddocs.aspx / uploadplans.aspx` | Attach a document/plan (metadata only in this stub build) |
| `citizenRequestedDocUpload` | POST | `applications/applications.json` | yes | `modules/dept/uploaddeptdocs.aspx / upload_request.aspx` | Upload a document requested by the department |
| `paymentInitiate` | POST | `applications/applications.json` | yes | `PFInit.aspx / PaymentRequest.aspx / PaymentReturn.aspx` | Online fee payment (simulated gateway) |
| `citizenFeedbackSave` | POST | `applications/applications.json` | yes | `modules/citizen/savefeedback.aspx` | Citizen rating / feedback on a completed application |
| `deptFeedbackRatings` | GET | `applications/applications.json` | yes | `modules/dept/Feedback_AvgRating.aspx` | Average citizen rating (dept dashboard) |
| `deptQueue` | GET | `applications/applications.json` | yes | `modules/dept/applications.aspx` | All submitted applications visible to department staff |
| `adminApplicationSearch` | GET | `applications/applications.json` | yes | `modules/dept/search.aspx + draftfiles.htm` | Admin: search all applications (incl. drafts) |
| `adminApplicationDelete` | DELETE | `applications/applications.json` | yes | `modules/admin/deleteOldFiles.aspx` | Admin: delete applications |

### Department workflow: configuration, tasks, decisions, reports

| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |
|---|---|---|---|---|---|
| `configWorkflows` | GET | `config/workflows.json` | yes | `(server-side process steps — process_steps.aspx)` | Workflow per application type × approval level (stages, tasks, roles, forms, permissions) |
| `configWorkflowsDefault` | GET | `config/workflows.json` | — | `(new)` | Workflows as shipped (used by "Restore default") |
| `adminSaveWorkflows` | PUT | `config/workflows.json` | yes | `(new) admin workflow configuration` | Admin: save the workflows |
| `configForms` | GET | `config/forms.json` | — | `modules/dept/partials/*_note*.html, dfo_report*.html, dgfs_note*.html` | Note / report forms a workflow task can use |
| `configSla` | GET | `config/sla.json` | yes | `(new; legacy rtimeout / escalations.aspx)` | SLA per workflow (per step, inspection, processing) and escalation recipients |
| `adminSaveSla` | PUT | `config/sla.json` | yes | `(new) admin SLA configuration` | Admin: save the SLA and escalation settings |
| `deptApplication` | GET | `applications/applications.json` | yes | `modules/citizen/application.aspx + modules/dept/process_steps.aspx` | Department: one application with its workflow run |
| `deptTaskSave` | POST | `applications/applications.json` | yes | `modules/dept/process_move.aspx?s=false` | Department: save the note / report of a task as a draft |
| `deptTaskSubmit` | POST | `applications/applications.json` | yes | `modules/dept/process_move.aspx?s=true` | Department: submit the note / report of a task |
| `deptDecision` | POST | `applications/applications.json` | yes | `modules/dept/process_move.aspx (final step) + uploaddocs.aspx (FinalDoc)` | Department: final decision of the issuing authority (with the signed NOC / letter) |
| `deptSendBack` | POST | `applications/applications.json` | yes | `modules/dept/sendback.aspx` | Department: send the file back to the previous stage |
| `deptSkipTask` | POST | `applications/applications.json` | yes | `modules/dept/process_move.aspx (Officer Bypassed)` | Department: the issuing authority bypasses an officer |
| `deptReassignTask` | POST | `applications/applications.json` | yes | `modules/dept/reassign.aspx` | Department: the issuing authority changes the officer of a task |
| `deptRequestDocuments` | POST | `applications/applications.json` | yes | `modules/dept/uploaddeptdocs.aspx (request)` | Department: request a document from the applicant |
| `deptUploadDocument` | POST | `applications/applications.json` | yes | `modules/dept/uploaddeptdocs.aspx` | Department: upload a document (e.g. inspection photographs) |
| `deptSendSms` | POST | `applications/applications.json` | yes | `modules/dept/sendsms.aspx` | Department: send an SMS to the applicant (simulated) |
| `deptUpdateFireStation` | PUT | `applications/applications.json` | yes | `modules/dept/update_application.aspx (fire station)` | Department: change the fire station of a file (Submitted only) |
| `deptUpdateLicensingAuthority` | PUT | `applications/applications.json` | yes | `modules/dept/update_application.aspx (licensing authority)` | Department: update the licensing authority (final stage only) |
| `adminReassignTasks` | POST | `applications/applications.json` | yes | `(new) — deactivation of an officer` | Admin: move the open tasks of an officer to another officer |
| `deptReports` | GET | `applications/applications.json` | yes | `modules/dept/reports.aspx (Rpt_type 1-7) + reports/rpt_*.html` | Department reports (pendency, statistics, consolidated, applications, overdue, SMS, feedback, challan, district, level-wise) |

### Admin utilities

| Catalog id | Method | Asset | Mock write? | Legacy endpoint | Purpose |
|---|---|---|---|---|---|
| `adminSendEscalations` | POST | `admin/escalations.json` | yes | `modules/admin/escalations.aspx` | Escalation reminders for tasks / applications past their SLA |

## 3. Mock write-simulation strategy

- **Reads** (`GET`, `mutates: false`) always resolve from the static JSON under
  `public/assets/data/**`, loaded with `HttpClient.get()`.
- **Writes** (`mutates: true`) go through `MockPersistenceService`:
  1. On first access the target collection is cloned from its JSON seed into an in-memory
     store and mirrored to `localStorage` under a namespaced key (`noc.mock.<asset>`).
  2. Later reads of that asset prefer the `localStorage` copy, so a citizen's new or edited
     application persists across reloads in the same browser.
  3. Writes (create / update / delete / transition) mutate the local copy and persist it
     back, returning an `Observable` of the result. The legacy `{ status: { success, error },
     data }` envelope is not reproduced: success is the next value, failure is an error with a
     user-presentable message.
  4. Writes are **transactions**: `ApiClient.update(endpoint, mutator)` runs a
     read-modify-write. A business-rule violation thrown inside the mutator (for example
     "Only draft applications can be edited", "This username is already taken") surfaces as an
     Observable error and nothing is persisted, like a server rejecting a request.
  5. Reads return deep copies, and concurrent first reads share a single seed request.
  6. **Reset demo data** (Admin workbench) clears every `noc.mock.*` key and reloads from the
     seeds, because there is no real backend to reset itself.
- The contract is the same whether a field is wired to the mock or, later, to a real
  backend. Only `ApiClient`'s implementation changes.
