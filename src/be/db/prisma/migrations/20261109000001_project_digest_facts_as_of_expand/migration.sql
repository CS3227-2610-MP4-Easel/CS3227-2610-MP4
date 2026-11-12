BEGIN;

ALTER TABLE "project_digests" ADD COLUMN "facts_as_of" TIMESTAMPTZ;

DO $$
DECLARE
  invalid_ids TEXT;
BEGIN
  SELECT string_agg(id::text, ', ' ORDER BY id)
    INTO invalid_ids
    FROM "project_digests"
   WHERE jsonb_typeof(facts->'asOf') IS DISTINCT FROM 'string'
      OR facts->>'asOf' !~ 'T.*([Zz]|[+-][0-9]{2}:[0-9]{2})$'
      OR NOT pg_input_is_valid(facts->>'asOf', 'timestamptz');
  IF invalid_ids IS NOT NULL THEN
    RAISE EXCEPTION 'project_digests facts.asOf must be a valid instant; affected digest ids: %', invalid_ids;
  END IF;
END $$;

UPDATE "project_digests"
   SET "facts_as_of" = (facts->>'asOf')::timestamptz;

CREATE OR REPLACE FUNCTION "project_digests_facts_as_of_compat"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."facts_as_of" IS NULL THEN
    NEW."facts_as_of" := (NEW.facts->>'asOf')::timestamptz;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "project_digests_facts_as_of_compat_trigger"
BEFORE INSERT OR UPDATE OF facts, facts_as_of ON "project_digests"
FOR EACH ROW EXECUTE FUNCTION "project_digests_facts_as_of_compat"();

CREATE INDEX "project_digests_project_id_facts_as_of_created_at_id_idx"
  ON "project_digests" ("project_id", "facts_as_of" DESC, "created_at" DESC, "id" DESC);

COMMIT;
