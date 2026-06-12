export {
  clearConvertTask,
  failConvertTask,
  finishConvertTask,
  getConvertTask,
  isConvertTaskPipelineBusy,
  isDocumentImportBusy,
  startConvertTask,
  subscribeConvertTask,
  updateConvertProgress,
  useConvertTask,
  useDocumentImportBusy,
  type ConvertStatus,
  type ConvertTask,
} from "@/lib/document-import/convert-store";

/** @deprecated Use `isDocumentImportBusy` */
export { isDocumentImportBusy as isPdfConversionBusy } from "@/lib/document-import/convert-store";

/** @deprecated Use `useDocumentImportBusy` */
export { useDocumentImportBusy as usePdfConversionBusy } from "@/lib/document-import/convert-store";
