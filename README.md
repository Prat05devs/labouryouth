# Labour Youth
Local workforce staffing, initially in Dehradun. One mobile app connects clients needing staff and workers seeking work, supported by an operations team. Phase 1 is the first release of the final extensible system.

## Governing specification
Start with [Product scope](docs/PRODUCT_SCOPE.md), [build checklist](docs/PHASE1_CHECKLIST.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md). Then read [architecture](docs/ARCHITECTURE.md), [flows](docs/LLD_FLOWS.md), [data model](docs/DATA_MODEL.md), [API](docs/API_CONTRACT.md), [state machines](docs/STATE_MACHINES.md), [decisions](docs/DECISIONS.md), [release runbook](docs/RELEASE.md) and [roadmap](docs/FUTURE_ROADMAP.md).

## Repository
- `apps/mobile`: React Native + Expo Router, Client/Worker modes, en/hi.
- `apps/api`: FastAPI, SQLAlchemy, Alembic, domain services, PostgreSQL/PostGIS.
- `apps/web`: Next.js marketing landing and protected operations dashboard.
- `packages/contracts`: generated OpenAPI contract; no duplicated business rules.

## Local setup and commands (target interface)
Node 24 LTS, Python 3.12+, Docker with Compose. Copy `.env.example` to `.env`, generate local secrets and set database credentials. Never commit `.env`. Install pinned dependencies using the committed lockfiles when available.

```sh
docker compose up -d db
cd apps/api
uv sync
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

From repository root, separate terminals:
```sh
npm install
npm run dev:web
npm run dev:mobile
npm run build:web
npm run typecheck
cd apps/api && uv run pytest
```
These are the intended interface; consult implementation status before assuming a command or capability exists. API `/api/v1`, OpenAPI `/openapi.json`, development docs `/docs`. A physical phone needs a reachable LAN/HTTPS API URL, not its own localhost. Local Docker credentials are development-only.

## Configuration
`.env.example` is the configuration inventory: DB, JWT/session/reset settings, allowed web origins, private storage, email, location/time limits, smart links and EAS identifiers. Only `EXPO_PUBLIC_*` and explicitly public web config enter client bundles. All timestamps are UTC; UI uses local display. All amounts are integer paise (INR initially).

## Tonight definition of done
The real Client → verified Worker → Admin operating loop must pass the exact checklist, migrations on PostGIS, ownership/role tests, competing accept tests, geo rejection/manual review tests, notification/ledger deduplication and device smoke checks. iOS source/config and successful EAS store build plus internal TestFlight submission are separate gates. No placeholder, mock success or documentation-only feature counts as shipped. See RELEASE.md for external prerequisites.
