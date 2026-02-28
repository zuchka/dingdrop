-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Org" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Org_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgMember" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endpoint" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultReplayUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookRequest" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "query" JSONB,
    "headers" JSONB NOT NULL,
    "bodyRaw" BYTEA NOT NULL,
    "bodyText" TEXT,
    "bodyJson" JSONB,
    "contentType" TEXT,
    "sourceIp" TEXT,
    "userAgent" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayAttempt" (
    "id" TEXT NOT NULL,
    "webhookRequestId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "requestHeaders" JSONB NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "ok" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Org_slug_key" ON "Org"("slug");

-- CreateIndex
CREATE INDEX "Org_createdAt_idx" ON "Org"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMember_orgId_userId_key" ON "OrgMember"("orgId", "userId");

-- CreateIndex
CREATE INDEX "OrgMember_userId_idx" ON "OrgMember"("userId");

-- CreateIndex
CREATE INDEX "OrgMember_orgId_role_idx" ON "OrgMember"("orgId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_key_key" ON "Endpoint"("key");

-- CreateIndex
CREATE INDEX "Endpoint_orgId_idx" ON "Endpoint"("orgId");

-- CreateIndex
CREATE INDEX "Endpoint_orgId_createdAt_idx" ON "Endpoint"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Endpoint_orgId_name_key" ON "Endpoint"("orgId", "name");

-- CreateIndex
CREATE INDEX "WebhookRequest_endpointId_receivedAt_idx" ON "WebhookRequest"("endpointId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "WebhookRequest_endpointId_method_receivedAt_idx" ON "WebhookRequest"("endpointId", "method", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "ReplayAttempt_webhookRequestId_createdAt_idx" ON "ReplayAttempt"("webhookRequestId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ReplayAttempt_ok_createdAt_idx" ON "ReplayAttempt"("ok", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endpoint" ADD CONSTRAINT "Endpoint_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookRequest" ADD CONSTRAINT "WebhookRequest_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "Endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplayAttempt" ADD CONSTRAINT "ReplayAttempt_webhookRequestId_fkey" FOREIGN KEY ("webhookRequestId") REFERENCES "WebhookRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
