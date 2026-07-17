-- CreateEnum
CREATE TYPE "ReviewFeedback" AS ENUM ('thumbs_up', 'thumbs_down');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN "learnerFeedback" "ReviewFeedback";
