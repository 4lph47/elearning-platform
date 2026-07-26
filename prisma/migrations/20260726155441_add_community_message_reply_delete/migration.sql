-- Reply-to-message + soft delete for CommunityMessage (WhatsApp/Telegram-style chat actions)
ALTER TABLE "CommunityMessage" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CommunityMessage" ADD COLUMN "replyToId" TEXT;

ALTER TABLE "CommunityMessage"
  ADD CONSTRAINT "CommunityMessage_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "CommunityMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "CommunityMessage_replyToId_idx" ON "CommunityMessage"("replyToId");
