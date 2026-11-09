# NOC Portal — AngularJS → Angular Migration

This repository contains:

| Path | What it is |
|---|---|
| [`NOC-base/`](./NOC-base) | The **original** AngularJS (1.x) application — Fire Department NOC portal for citizens/builders, department staff and admins. Kept as-is for reference. |
| [`docs/`](./docs) | The **migration plan**: functional scope, domain model, API catalog, 3-phase delivery plan, architecture, and per-phase manual QA scripts. **Start here.** |
| [`frontend/`](./frontend) | The **new Angular application** (Phases 1, 2 and 3 fully implemented), running entirely against local JSON fixtures — no backend, no real auth, no persistence beyond the browser. |

## Quick start (new frontend)

```bash
cd frontend
npm install
npm start
# open http://localhost:4200, pick a demo account chip on the login screen
```

See [`frontend/README.md`](./frontend/README.md) for details, and
[`docs/phase-1-manual-test-script.md`](./docs/phase-1-manual-test-script.md)
for a guided walkthrough of what's implemented so far.

## Why this structure

The brief asked for three things, mapped 1:1 onto this repo:

1. **"Define a scope / functionality and a UI migration plan, in 2-3
   phases, each with a verifiable deliverable."** → [`docs/01-functional-scope.md`](docs/01-functional-scope.md)
   through [`docs/04-migration-plan.md`](docs/04-migration-plan.md).
2. **"Create a shell for the project with an Angular frontend accessing
   JSON files directly but using a list of API points as a separate file
   thru which all the JSONs are accessed."** →
   [`frontend/src/app/core/api/api-endpoints.ts`](frontend/src/app/core/api/api-endpoints.ts)
   is that file; [`docs/03-api-catalog.md`](docs/03-api-catalog.md)
   documents every entry in it and how it maps back to the legacy
   `*.aspx` endpoints.
3. **A working, polished UI**, not just a diagram — Phase 1 (auth,
   dashboards, department queues, admin incl. account management and
   application search & delete), Phase 2 (the complete citizen
   application lifecycle) and Phase 3 (admin-configurable department
   workflows and SLAs, officer fire-station association, the full department
   processing page — note/report forms, final decision with a live NOC/letter
   preview, send back / bypass / reassign, document requests, SMS, fire
   station and licensing authority — department dashboards, reports and
   escalations) are all implemented, tested (389 automated tests) and
   visually verified end to end, citizen through department back to citizen.
