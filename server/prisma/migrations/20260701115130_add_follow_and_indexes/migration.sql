/*
  Warnings:

  - You are about to drop the column `avatarUrl` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "avatarUrl";

-- CreateIndex
CREATE INDEX "Comment_gameId_idx" ON "Comment"("gameId");

-- CreateIndex
CREATE INDEX "Comment_reviewId_idx" ON "Comment"("reviewId");

-- CreateIndex
CREATE INDEX "Comment_pyramidId_idx" ON "Comment"("pyramidId");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Game_homeTeamId_idx" ON "Game"("homeTeamId");

-- CreateIndex
CREATE INDEX "Game_awayTeamId_idx" ON "Game"("awayTeamId");

-- CreateIndex
CREATE INDEX "Game_season_idx" ON "Game"("season");

-- CreateIndex
CREATE INDEX "GameReview_gameId_idx" ON "GameReview"("gameId");

-- CreateIndex
CREATE INDEX "GameStat_playerId_idx" ON "GameStat"("playerId");

-- CreateIndex
CREATE INDEX "GoatPyramidPlayer_pyramidId_idx" ON "GoatPyramidPlayer"("pyramidId");

-- CreateIndex
CREATE INDEX "GoatPyramidPlayer_playerId_idx" ON "GoatPyramidPlayer"("playerId");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "ReviewLike_reviewId_idx" ON "ReviewLike"("reviewId");
