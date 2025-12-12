# DC Deal Screener

Evidence-first screening workspace for European data center deals. The app produces auditable evidence extraction, deterministic scorecards, and a next-checks list driven by fund thesis and country packs.

## Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind + shadcn-inspired components
- Prisma + PostgreSQL
- NextAuth (credentials) with organization roles (Admin/Analyst/Viewer)
- Local file storage by default (DigitalOcean Spaces ready via envs)
- Deterministic analysis engine (no hallucinations; UNKNOWN when evidence is missing)

## Getting started (development)
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy env template and edit values:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL, NEXTAUTH_SECRET, OPENAI_API_KEY, etc.
   ```
3. Apply migrations:
   ```bash
   pnpm prisma migrate dev
   ```
4. (Optional) load demo data for local testing only:
   ```bash
   pnpm seed:demo
   ```
5. Run the app:
   ```bash
   pnpm dev
   ```
6. On a fresh database, create the first admin either via the CLI (`pnpm bootstrap:admin` with BOOTSTRAP_* envs set) or by visiting `/onboarding` (only available when no users exist).

## Security
- Authentication and authorization are derived from the server-side NextAuth session; the client should never send `userId` to APIs or server actions.
- All access is scoped to the member's organization with role-based permissions (Admin/Analyst/Viewer).
- OpenAI API keys stay on the server: all ingestion and retrieval calls use the server-side SDK and never expose keys to the browser.

## Key features
- **Fund onboarding**: capture thesis, risk appetite, ESG/sovereignty constraints, required evidence level.
- **Deal creation**: country/city, green/brownfield, product type.
- **Evidence binder**: upload dataroom/email files; stored privately under `STORAGE_ROOT`.
- **Analysis run**:
  - Step A: deterministic evidence extraction with citations per document.
  - Step B: rules-based scoring tuned to thesis + country pack definitions.
  - Step C: summary, scorecard (Verified/Partial/Unknown), prioritized checklist.
- **Country packs**: editable per market (allowed domains, gold sources, artefact definitions, scoring overrides).
- **Audit log**: every analysis run is captured with metadata.
- **Export-ready IC pack**: download a server-rendered IC Pack PDF with evidence binder and optional market context.

## Storage
- Local: files saved under `STORAGE_ROOT` (default `./uploads`).
- DigitalOcean Spaces (recommended for production): set `SPACES_ENDPOINT`, `SPACES_REGION`, `SPACES_ACCESS_KEY`, `SPACES_SECRET_KEY`, `SPACES_BUCKET`. When these are present, uploads stream directly to Spaces and downloads stream back via the protected route.

## Production deployment (DigitalOcean App Platform)
1. Provision PostgreSQL and a Spaces bucket; set all env vars from `.env.example` (including `SPACES_*`).
2. Bootstrap the first admin once the database is empty using `pnpm bootstrap:admin` (set BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD, BOOTSTRAP_ORG_NAME) or navigate to `/onboarding` before any users exist.
3. Build command:
   ```bash
   pnpm install --frozen-lockfile && pnpm prisma migrate deploy && pnpm build
   ```
4. Run command:
   ```bash
   pnpm start
   ```
5. Do **not** run `prisma db seed` in production unless you intentionally want the demo data.

## Tests
- Unit/type/lint suite:
  ```bash
  pnpm check
  ```
- Optional OpenAI smoke test (requires OPENAI_API_KEY and `RUN_INTEGRATION_TESTS=1`):
  ```bash
  pnpm smoke:openai
  ```

## IC Pack PDF export
- Open a deal workspace, select a run, and click **Download IC Pack (PDF)**. The download is authorized server-side (organization members only, including Viewers).
- The PDF includes the executive summary, scorecard, checklist, Appendix A (evidence binder with snippet IDs, scores, metadata), and Appendix B (market context with URL citations) when research is included.

### Manual QA steps
1. Run an analysis on a deal (optionally include market research).
2. Open the desired run in the workspace and click **Download IC Pack (PDF)**.
3. Confirm the PDF downloads with the correct filename and opens with readable layout, scorecard, checklist, and appendix sections.
4. Verify evidence snippets list snippet IDs, file names, scores, and metadata; market context contains the disclaimer and plain-text URLs.
5. Sign in as a Viewer from another organization and confirm the download is blocked with 403.
