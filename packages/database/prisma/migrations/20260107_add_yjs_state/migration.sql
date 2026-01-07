-- AlterTable: Add yjsState column to EditorDocument for collaborative editing
ALTER TABLE "EditorDocument" ADD COLUMN "yjsState" BYTEA;

-- Comment explaining the purpose
COMMENT ON COLUMN "EditorDocument"."yjsState" IS 'Yjs collaborative editing state (binary format)';

