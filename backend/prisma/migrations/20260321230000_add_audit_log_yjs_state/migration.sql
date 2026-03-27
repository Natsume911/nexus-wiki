-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'MOVE', 'RESTORE', 'LOGIN', 'PERMISSION_GRANT', 'PERMISSION_REVOKE', 'PERMISSION_CHANGE', 'EXPORT', 'IMPORT', 'BACKUP', 'ROLE_CHANGE', 'REINDEX');

-- CreateEnum
CREATE TYPE "AuditResourceType" AS ENUM ('PAGE', 'SPACE', 'USER', 'COMMENT', 'PERMISSION', 'ATTACHMENT', 'TEMPLATE', 'TAG', 'INLINE_COMMENT', 'SYSTEM');

-- AlterTable
ALTER TABLE "pages" ADD COLUMN "yjs_state" BYTEA;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "user_email" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource_type" "AuditResourceType" NOT NULL,
    "resource_id" TEXT,
    "resource_title" TEXT,
    "space_id" TEXT,
    "changes" JSONB,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "audit_logs"("user_id", "timestamp");
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");
CREATE INDEX "audit_logs_space_id_timestamp_idx" ON "audit_logs"("space_id", "timestamp");
