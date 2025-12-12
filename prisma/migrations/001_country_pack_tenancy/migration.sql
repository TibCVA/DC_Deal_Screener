-- Scope country packs to organizations
ALTER TABLE "CountryPack" DROP CONSTRAINT IF EXISTS "CountryPack_countryCode_key";
ALTER TABLE "CountryPack" DROP CONSTRAINT IF EXISTS "country_pack_org_fk";

-- Backfill missing organization references before enforcing NOT NULL
UPDATE "CountryPack"
SET "organizationId" = (
  SELECT "id" FROM "Organization" LIMIT 1
)
WHERE "organizationId" IS NULL;

ALTER TABLE "CountryPack"
  ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "CountryPack"
  ADD CONSTRAINT "CountryPack_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CountryPack_organizationId_countryCode_key" ON "CountryPack"("organizationId", "countryCode");
