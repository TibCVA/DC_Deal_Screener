-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ANALYST', 'VIEWER');
CREATE TYPE "DealType" AS ENUM ('GREENFIELD', 'BROWNFIELD');
CREATE TYPE "ScoreStatus" AS ENUM ('VERIFIED', 'PARTIAL', 'UNKNOWN');

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Organization" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Membership" (
    "id" TEXT PRIMARY KEY,
    "role" "Role" NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "membership_user_org_unique" UNIQUE ("userId", "organizationId"),
    CONSTRAINT "membership_user_fk" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "membership_org_fk" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Fund" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "thesis" JSONB NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "fund_org_fk" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Deal" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "type" "DealType" NOT NULL,
    "fundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "deal_fund_fk" FOREIGN KEY ("fundId") REFERENCES "Fund" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "DealDocument" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP DEFAULT now(),
    CONSTRAINT "doc_deal_fk" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "CountryPack" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL UNIQUE,
    "allowedDomains" TEXT[] NOT NULL,
    "goldSources" JSONB NOT NULL,
    "artefacts" JSONB NOT NULL,
    "scoringOverrides" JSONB,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "country_pack_org_fk" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "AnalysisRun" (
    "id" TEXT PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "executedById" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "scorecard" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "createdAt" TIMESTAMP DEFAULT now(),
    CONSTRAINT "run_deal_fk" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE CASCADE,
    CONSTRAINT "run_user_fk" FOREIGN KEY ("executedById") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT PRIMARY KEY,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP DEFAULT now(),
    CONSTRAINT "audit_user_fk" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL,
    CONSTRAINT "audit_org_fk" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL
);
