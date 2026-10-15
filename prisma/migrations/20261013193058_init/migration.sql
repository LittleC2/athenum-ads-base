-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLIENT');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ATIVO', 'PAUSADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('LEAD_FORM', 'WHATSAPP', 'PURCHASE', 'LINK_CLICK');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('CAMPAIGN', 'ADSET', 'AD');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('RED', 'YELLOW', 'GREEN');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "DraftObjective" AS ENUM ('LEADS_FORM', 'LEADS_WHATSAPP', 'TRAFFIC');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT', 'REVIEW', 'UPLOADING', 'UPLOADED', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'APPROVED', 'EXECUTED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionSource" AS ENUM ('COPILOT', 'MANUAL');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "clientId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segment" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ATIVO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientBrief" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "offer" TEXT,
    "audience" TEXT,
    "tone" TEXT,
    "ticketCents" INTEGER,
    "closeRatePct" DOUBLE PRECISION,
    "restrictions" TEXT,
    "extra" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pageId" TEXT,
    "igUserId" TEXT,
    "resultType" "ResultType" NOT NULL DEFAULT 'LEAD_FORM',
    "monthlyBudgetCents" INTEGER,
    "targetCostCents" INTEGER,
    "maxDailyBudgetCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3),
    "backfilledAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaEntity" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "externalId" TEXT NOT NULL,
    "campaignId" TEXT,
    "adsetId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "objective" TEXT,
    "dailyBudgetCents" INTEGER,
    "thumbnailUrl" TEXT,
    "metaCreatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightDaily" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "level" "Level" NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "campaignId" TEXT,
    "adsetId" TEXT,
    "date" DATE NOT NULL,
    "spendCents" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "results" INTEGER NOT NULL DEFAULT 0,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "depth2" INTEGER NOT NULL DEFAULT 0,
    "actions" JSONB,

    CONSTRAINT "InsightDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "entityId" TEXT NOT NULL DEFAULT '',
    "entityName" TEXT,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "visibleToClient" BOOLEAN NOT NULL DEFAULT false,
    "clientTitle" TEXT,
    "clientDetail" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'SEMANAL',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "kpis" JSONB,
    "clientSummary" TEXT NOT NULL DEFAULT '',
    "internalAnalysis" TEXT NOT NULL DEFAULT '',
    "recommendations" JSONB,
    "generatedBy" TEXT NOT NULL DEFAULT 'template',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultFeedback" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "qualified" INTEGER,
    "sales" INTEGER,
    "revenueCents" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "metaImageHash" TEXT,
    "metaVideoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDraft" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" "DraftObjective" NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
    "spec" JSONB NOT NULL,
    "plannerNotes" TEXT,
    "metaCampaignId" TEXT,
    "metaState" JSONB,
    "lastError" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyVariant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "draftId" TEXT,
    "angle" TEXT NOT NULL,
    "primaryText" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "cta" TEXT,
    "status" "CopyStatus" NOT NULL DEFAULT 'SUGGESTED',
    "lintFlags" JSONB,
    "source" TEXT NOT NULL DEFAULT 'claude',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposedAction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "accountId" TEXT,
    "source" "ActionSource" NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "error" TEXT,
    "createdById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "clientId" TEXT,
    "accountId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "payload" JSONB,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_clientId_idx" ON "User"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ClientBrief_clientId_key" ON "ClientBrief"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_externalId_key" ON "AdAccount"("externalId");

-- CreateIndex
CREATE INDEX "AdAccount_clientId_idx" ON "AdAccount"("clientId");

-- CreateIndex
CREATE INDEX "MetaEntity_accountId_level_idx" ON "MetaEntity"("accountId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "MetaEntity_accountId_level_externalId_key" ON "MetaEntity"("accountId", "level", "externalId");

-- CreateIndex
CREATE INDEX "InsightDaily_accountId_level_date_idx" ON "InsightDaily"("accountId", "level", "date");

-- CreateIndex
CREATE INDEX "InsightDaily_accountId_campaignId_date_idx" ON "InsightDaily"("accountId", "campaignId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InsightDaily_accountId_level_entityId_date_key" ON "InsightDaily"("accountId", "level", "entityId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InsightCache_key_key" ON "InsightCache"("key");

-- CreateIndex
CREATE INDEX "Alert_accountId_status_idx" ON "Alert"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_accountId_kind_entityId_key" ON "Alert"("accountId", "kind", "entityId");

-- CreateIndex
CREATE INDEX "Report_clientId_status_idx" ON "Report"("clientId", "status");

-- CreateIndex
CREATE INDEX "ResultFeedback_clientId_periodStart_idx" ON "ResultFeedback"("clientId", "periodStart");

-- CreateIndex
CREATE INDEX "Asset_clientId_idx" ON "Asset"("clientId");

-- CreateIndex
CREATE INDEX "CampaignDraft_clientId_status_idx" ON "CampaignDraft"("clientId", "status");

-- CreateIndex
CREATE INDEX "CopyVariant_clientId_status_idx" ON "CopyVariant"("clientId", "status");

-- CreateIndex
CREATE INDEX "ProposedAction_status_createdAt_idx" ON "ProposedAction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ChatThread_userId_idx" ON "ChatThread"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_clientId_createdAt_idx" ON "AuditLog"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientBrief" ADD CONSTRAINT "ClientBrief_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetaEntity" ADD CONSTRAINT "MetaEntity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightDaily" ADD CONSTRAINT "InsightDaily_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultFeedback" ADD CONSTRAINT "ResultFeedback_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraft" ADD CONSTRAINT "CampaignDraft_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraft" ADD CONSTRAINT "CampaignDraft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyVariant" ADD CONSTRAINT "CopyVariant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyVariant" ADD CONSTRAINT "CopyVariant_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CampaignDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
