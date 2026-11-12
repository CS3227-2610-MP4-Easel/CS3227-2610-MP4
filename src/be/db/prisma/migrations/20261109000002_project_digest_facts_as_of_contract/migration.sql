BEGIN;

ALTER TABLE "project_digests" ALTER COLUMN "facts_as_of" SET NOT NULL;

COMMIT;
