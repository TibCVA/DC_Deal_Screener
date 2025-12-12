-- Add marketResearchIncluded flag to track when official context was requested
ALTER TABLE "AnalysisRun" ADD COLUMN "marketResearchIncluded" BOOLEAN NOT NULL DEFAULT false;
