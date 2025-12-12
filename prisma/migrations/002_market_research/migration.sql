-- Add marketResearch JSON column to AnalysisRun to store official market research results
ALTER TABLE "AnalysisRun" ADD COLUMN IF NOT EXISTS "marketResearch" JSONB;
