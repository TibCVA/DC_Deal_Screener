# DC Deal Screener

Evidence-first screening workspace for European data center deals. The app produces auditable evidence extraction, deterministic scorecards, and a next-checks list driven by fund thesis and country packs.

## Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind + shadcn-inspired components
- Prisma + PostgreSQL
- NextAuth (credentials) with organization roles (Admin/Analyst/Viewer)
- Local file storage by default (DigitalOcean Spaces ready via envs)
- Deterministic analysis engine (no hallucinations; UNKNOWN when evidence is missing)

## Getting started
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy env template and edit values:
   ```bash
   cp .env.example .env
   # Update DATABASE_URL, NEXTAUTH_SECRET, etc.
   # Set OPENAI_API_KEY (server-side only) and optional OPENAI_MODEL
   ```
3. Apply the initial migration to PostgreSQL and seed demo data:
   ```bash
   pnpm prisma migrate deploy
   pnpm prisma db seed
   ```
4. Run the app:
   ```bash
   pnpm dev
   ```
5. Sign in with the seeded analyst account: `admin@example.com` / `password123`.

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
- **Export-ready IC pack**: use the scorecard + checklist views to assemble PDF (printing supported via browser print-to-PDF).

## Storage
- Local: files saved under `STORAGE_ROOT` (default `./uploads`).
- DigitalOcean Spaces: set `SPACES_ENDPOINT`, `SPACES_ACCESS_KEY`, `SPACES_SECRET_KEY`, `SPACES_BUCKET` and swap the storage helper to push to Spaces (kept server-side; never exposed to the browser).

## Tests
Run schema + integration checks:
```bash
pnpm test
```

## Deployment (DigitalOcean App Platform)
1. Provision PostgreSQL in DigitalOcean; grab the connection string for `DATABASE_URL`.
2. Create a Spaces bucket and set the storage env vars.
3. Set `NEXTAUTH_SECRET` to a strong random string.
4. Build command: `pnpm install --frozen-lockfile && pnpm prisma migrate deploy && pnpm prisma db seed && pnpm build`
5. Run command: `pnpm start`
6. Ensure `STORAGE_ROOT` points to a writable path (or use Spaces envs to offload storage).
