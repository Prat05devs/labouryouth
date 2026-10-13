# Labour Youth
Local workforce staffing, initially in Dehradun. One mobile app connects clients needing staff and workers seeking work, supported by an operations team. Phase 1 is the first release of the final extensible system.

## Governing specification
Start with [Product scope](docs/PRODUCT_SCOPE.md), [build checklist](docs/PHASE1_CHECKLIST.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md). Then read [architecture](docs/ARCHITECTURE.md), [flows](docs/LLD_FLOWS.md), [data model](docs/DATA_MODEL.md), [API](docs/API_CONTRACT.md), [state machines](docs/STATE_MACHINES.md), [decisions](docs/DECISIONS.md), [release runbook](docs/RELEASE.md) and [roadmap](docs/FUTURE_ROADMAP.md).

## Repository
- `apps/mobile`: React Native + Expo Router, Client/Worker modes, en/hi.
- `apps/server`: the API. Node.js/Express (TypeScript) modular monolith, SQL migrations, integration tests on PostgreSQL/PostGIS (Decision 31). Hosted on Hostinger Cloud with Supabase; see [hosting](docs/API_HOSTING.md).
- `apps/api`: the retired FastAPI backend. Every route and test now exists in `apps/server`; the folder is kept only until the owner approves deleting it, and nothing runs it.
- `apps/web`: Next.js marketing landing and protected operations dashboard.
- `packages/contracts`: generated OpenAPI contract; no duplicated business rules.

## Local setup and commands (target interface)
Node 24 LTS (`nvm use 24`), Docker with Compose. Copy `.env.example` to `.env`, generate local secrets and set database credentials. Never commit `.env`. Install pinned dependencies using the committed lockfiles when available.

```sh
docker compose up -d db
cd apps/server
npm ci
npm run migrate          # applies migrations/*.sql
npm run seed             # Dehradun area, services, localities
npm run dev              # API on http://localhost:8000
npm run bootstrap-admin  # first operations admin, interactive
```

From repository root, separate terminals:
```sh
npm install
npm run dev:web
npm run dev:mobile
npm run build:web
npm run typecheck
npm run test:server      # needs the Docker database; never SQLite
```
These are the intended interface; consult implementation status before assuming a command or capability exists. API base path `/api/v1`; the contract is [API_CONTRACT.md](docs/API_CONTRACT.md). A physical phone needs a reachable LAN/HTTPS API URL, not its own localhost. Local Docker credentials are development-only.

## Configuration
`.env.example` is the configuration inventory: DB, JWT/session/reset settings, allowed web origins, private storage, email, location/time limits, smart links and EAS identifiers. Only `EXPO_PUBLIC_*` and explicitly public web config enter client bundles. All timestamps are UTC; UI uses local display. All amounts are integer paise (INR initially).

## Tonight definition of done
The real Client → verified Worker → Admin operating loop must pass the exact checklist, migrations on PostGIS, ownership/role tests, competing accept tests, geo rejection/manual review tests, notification/ledger deduplication and device smoke checks. iOS source/config and successful EAS store build plus internal TestFlight submission are separate gates. No placeholder, mock success or documentation-only feature counts as shipped. See RELEASE.md for external prerequisites.
