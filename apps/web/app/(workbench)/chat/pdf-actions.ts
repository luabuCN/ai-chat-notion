export {
  useDocumentImportUpload,
} from "@/lib/document-import/import-actions";

import { useDocumentImportUpload } from "@/lib/document-import/import-actions";

/** @deprecated Use `useDocumentImportUpload` */
export function usePdfUpload({ workspaceSlug }: { workspaceSlug?: string }) {
  const { handleDocumentImportUpload } = useDocumentImportUpload({ workspaceSlug });
  return { handlePdfUpload: handleDocumentImportUpload };
}
