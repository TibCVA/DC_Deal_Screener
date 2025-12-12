-- AlterTable
ALTER TABLE "Deal" ADD COLUMN "openaiVectorStoreId" TEXT;

-- AlterTable
ALTER TABLE "DealDocument" ADD COLUMN "openaiFileId" TEXT,
    ADD COLUMN "openaiStatus" TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN "sha256" TEXT,
    ADD COLUMN "originalFileSize" INTEGER,
    ADD COLUMN "originalExt" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Deal_openaiVectorStoreId_key" ON "Deal"("openaiVectorStoreId");

-- CreateIndex
CREATE UNIQUE INDEX "DealDocument_openaiFileId_key" ON "DealDocument"("openaiFileId");
