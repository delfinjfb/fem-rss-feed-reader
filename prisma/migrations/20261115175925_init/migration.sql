-- CreateEnum
CREATE TYPE "Layout" AS ENUM ('LIST', 'COMPACT', 'CARDS', 'SPLIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "layout" "Layout" NOT NULL DEFAULT 'LIST',
    "refreshMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastDigestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feed" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "siteUrl" TEXT,
    "description" TEXT,
    "iconUrl" TEXT,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "nextFetchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "author" TEXT,
    "imageUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "categoryId" TEXT,
    "customTitle" TEXT,
    "readBefore" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadState" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT true,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadState_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("userId","itemId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_url_key" ON "Feed"("url");

-- CreateIndex
CREATE INDEX "Item_feedId_publishedAt_idx" ON "Item"("feedId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "Item_publishedAt_idx" ON "Item"("publishedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Item_feedId_guid_key" ON "Item"("feedId", "guid");

-- CreateIndex
CREATE INDEX "Category_userId_position_idx" ON "Category"("userId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_name_key" ON "Category"("userId", "name");

-- CreateIndex
CREATE INDEX "Subscription_userId_categoryId_idx" ON "Subscription"("userId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_feedId_key" ON "Subscription"("userId", "feedId");

-- CreateIndex
CREATE INDEX "Bookmark_userId_createdAt_idx" ON "Bookmark"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadState" ADD CONSTRAINT "ReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadState" ADD CONSTRAINT "ReadState_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
