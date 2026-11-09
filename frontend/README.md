# NOC Portal — Angular Frontend (Phases 1 & 2)

This is the new Angular rewrite of the legacy AngularJS "Fire NOC Portal"
(see `../NOC-base` for the original app and `../docs` for the full
migration plan). It runs entirely against local JSON fixtures under
`public/assets/data/**` — **there is no real backend**, authentication, or
persistence beyond the browser's own `localStorage`/`sessionStorage`, by
design.

👉 Start with [`../docs/README.md`](../docs/README.md) for the functional
scope, domain model, API catalog and 3-phase migration plan this code
implements (Phases 1 and 2 of 3 so far).

## Requirements

- Node.js. The Angular CLI pinned here (`21.2.24`) needs **Node ^20.19 /
  ^22.12 / >=24**. (Angular's very latest `22.x` line requires Node
  `22.22.3+`; if your Node is older than that but still ≥ 22.12, this
  project's pinned `21.x` toolchain is what lets `npm install` succeed —
  see `docs/04-migration-plan.md` → "Toolchain note".)

## Getting started

```bash
npm install
npm start          # ng serve, http://localhost:4200
```

Log in with any of the seeded demo accounts shown as chips on the login
screen (all use password `demo`):

| Username | Portal | Notes |
|---|---|---|
| `citizen1` | Citizen | Mix of draft / submitted / approved / returned / rejected applications of every type |
| `citizen2`, `citizen3` | Citizen | Other citizens (their applications are not visible to citizen1) |
| `sai.constructions` | Citizen | **Deactivated** — login is refused |
| `dg.officer`, `dfs.officer`, `dfscd.officer`, `adfs.officer`, `section.hq` | Department (Head Office, all fire stations) | DG, DFS, DFS-CD, ADFS, Section — Head Office workflow tasks |
| `rfo.officer`, `rfo.southern` | Department | RFO Eastern (districts 1–6) / Southern (7–13) |
| `dfo.visakhapatnam`, `dfo.officer` (Krishna), `dfo.guntur`, `dfo.srikakulam` | Department | DFOs of their district's fire stations |
| `sfo.officer`, `sfo.krishna`, `sfo.guntur`, `sfo.srikakulam` | Department | SFOs of their fire station(s) |
| `monitor.hq` | Department | Monitoring (read-only): every file and the reports |
| `retired.officer` | Department | **Deactivated** |
| `admin` | Admin | Accounts (incl. officers' fire stations), application search & delete, **Rules & Fees**, **Workflows**, **SLA**, escalations, demo reset |

The officers of an application are the officers of each role associated with the fire station of the
property (see `docs/06-phase-3-design.md` §0).

## Scripts

```bash
npm start          # dev server with HMR
npm run build      # production build -> dist/noc-portal
npm test           # unit tests (Vitest, via `ng test`)
npm run lint       # ESLint (angular-eslint), including an architecture rule
                    # that forbids importing HttpClient outside core/api/**
npm run fixtures   # regenerate applications.json with the app's own domain code
                    # (fails if a seeded submitted application would not validate)
                    # and the test fixture index (src/testing/fixture-index.ts)
npx tsx scripts/generate-api-doc.ts   # print the API traceability matrix (docs/03)
```

## Project layout

```
public/assets/data/**        All "API" JSON fixtures (the mock backend's data)
src/app/core/api/            api-endpoints.ts catalog + ApiClient + mock write-simulation
src/app/core/auth/           Mock session service + route guards
src/app/core/accounts/       Accounts store operations (register, admin account management)
src/app/core/domain/         Pure business rules: rule engine, commonrules port, FFE, fees, approval
                             levels, renewal periods, validation, certificates, workflow engine,
                             reports, escalations…
src/app/core/lookups/        Master/reference data access
src/app/core/models/         Domain TypeScript interfaces
src/app/layout/              Per-portal chrome (auth/citizen/dept/admin shells)
src/app/features/            Routed feature screens, grouped by portal
src/app/shared/ui/           Small reusable UI kit (icon, badges, dialog, toasts, header, star rating)
src/app/shared/ffe/          Legacy FFE grid (summary + floor-wise) — edit, read-only and document variants
src/app/shared/application-sheet/  Whole application on one page (confirmation, detail, dept view)
src/app/shared/workflow/     Stage stepper + process-steps table of a workflow run
src/app/shared/charts/       Dependency-free SVG bar chart (reports)
src/app/shared/certificates/ Legal documents: final_noc_16 / final_noc_o / final_noc_r / rejection / OccCert
src/styles/                  Design tokens + shared SCSS (buttons, forms, layout)
src/testing/                 Test helpers: fixture-backed HTTP, session seeding (not in the app build)
scripts/                     Fixture generator, fixture index generator, API doc generator (tsx)
```

See [`../docs/05-architecture.md`](../docs/05-architecture.md) for the
full rationale.

## The API catalog (single source of truth for all JSON access)

Every piece of data the app reads or writes goes through
[`src/app/core/api/api-endpoints.ts`](src/app/core/api/api-endpoints.ts).
It is a flat map of logical operation → `{ method, asset path, legacy
endpoint it replaces, ... }`. Feature services call
`ApiClient.get(API_ENDPOINTS.xyz)` / `.save(...)` / `.upsertInCollection(...)`
— nothing else is allowed to import `HttpClient` directly (enforced by
`eslint.config.js`).

Endpoints flagged `mutates: true` are transparently backed by
`MockPersistenceService`, which lazily copies the JSON seed into
`localStorage` on first read and serves/updates that working copy
thereafter — this is how "Delete draft", "Send Escalations", etc. feel
like real writes and survive a page reload without any server.

## What's implemented vs. planned

See [`../docs/04-migration-plan.md`](../docs/04-migration-plan.md) for details.

- ✅ **Phase 1** — shell, design system, routing, mock auth & guards, citizen dashboard,
  department role-based queues & search, admin workbench.
  - ✅ CR-1: "Existing Building (Pilot)" application type removed completely.
  - ✅ CR-2: Admin management of citizen accounts (modify, change password, deactivate) and
    department users (add, modify, reset password, deactivate); registration creates real
    (mock) accounts; deactivated accounts cannot log in.
  - ✅ CR-3: Admin stale grid replaced by application **Search & Delete**.
- ✅ **Phase 2** — citizen application lifecycle for Provisional, Occupancy, Renewal and
  Declaration: legacy **Save** (site name + address only) vs **Submit** (full validation →
  problem list or single-page confirmation → submit); free navigation with always-visible
  validation; **block-wise flow** (Block Details → Floors → Means of Escape → Fire Fighting
  Equipment → Plans, one block at a time, as the legacy editpnoc_1…4); blocks/floors/surroundings/open spaces (commonrules G.O.Ms.No.119)/means of
  escape; **FFE from the legacy rule trees** in the legacy floor-wise grid; documents (metadata
  only); simulated online payment / bank challan; revise; carry forward; department document
  requests; **legal formats** of the NOCs, renewal certificate, display certificate and
  rejection letter; **rating**; **change password** and logout in the user menu (all portals); Admin **Rules & Fees**
  (fees, approval levels, renewal periods).
- ✅ **Phase 3** — department workflow, fully implemented:
  - **3a** — admin-configurable workflows (one per application type × approval level: stages of
    parallel tasks, roles, forms, permissions, decision outcomes; validation, flow preview, officer
    simulator, versions), **SLA & Escalations** page, officers' **fire-station association** and
    hand-over of open tasks on deactivation; submission starts the workflow; department dashboard
    **My tasks / Monitoring** with SLA badges; citizen progress stepper.
  - **3b** — the processing page: the officer's own note / report form inline (**Section Note**,
    **Inspection Report** per block with a computed recommendation, **Committee Member
    Concurrence**, **RFO Note**, a generic **questionnaire** renderer for the ADFS / DFS-CD / DFS /
    DFO notes) with Save draft / Submit; **Send back** to the previous stage; the issuing
    authority's **Bypass** / **Change officer** on any pending task; **Request a document**,
    **Upload a department document**, **Send SMS**, **Change fire station** (Submitted only,
    re-resolves every officer), **Update the licensing authority** (final stage only); the **Final
    Decision** with outcome buttons restricted by the processing SLA, the mandatory signed copy and
    a **live preview** of the exact NOC / letter the citizen will receive, built from the same
    Phase 2 certificate components. Decisions reach the citizen side immediately (status, NOC,
    validity, rejection / return letter, Revise → a new run).
  - **3c** — the ten **reports** (pendency DG dashboard with charts, statistics, consolidated,
    applications, overdue, SMS, feedback, challan, district-wise, level-wise) with filters, print and
    CSV; search opens the department view; SLA-based **escalations** with preview.

## Manual QA

Scripted click-throughs:
[`../docs/phase-1-manual-test-script.md`](../docs/phase-1-manual-test-script.md),
[`../docs/phase-2-manual-test-script.md`](../docs/phase-2-manual-test-script.md) and
[`../docs/phase-3-manual-test-script.md`](../docs/phase-3-manual-test-script.md) (sections A–G).
