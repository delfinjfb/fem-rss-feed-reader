/*
  Warnings:

  - Added the required column `sortDate` to the `Item` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Item_feedId_publishedAt_idx";

-- DropIndex
DROP INDEX "Item_publishedAt_idx";

-- AlterTable
ALTER TABLE "Feed" ADD COLUMN     "previousUrl" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "sortDate" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Feed_previousUrl_idx" ON "Feed"("previousUrl");

-- CreateIndex
CREATE INDEX "Item_feedId_sortDate_id_idx" ON "Item"("feedId", "sortDate" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Item_sortDate_id_idx" ON "Item"("sortDate" DESC, "id" DESC);
