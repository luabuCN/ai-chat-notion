import { Editor } from "@tiptap/core";
import { defaultExtensions } from "../tiptap/default-extensions";
import { DocumentLink } from "../tiptap/extensions/document-link";
import { AttachmentUploadPlaceholder } from "../tiptap/extensions/attachment-upload-placeholder/attachment-upload-placeholder";
import { ImageUploadPlaceholder } from "../tiptap/extensions/image-upload-placeholder/image-upload-placeholder";

export function createImportEditorExtensions() {
  return [
    ...defaultExtensions,
    ImageUploadPlaceholder.configure({}),
    AttachmentUploadPlaceholder.configure({}),
    DocumentLink.configure({ navigate: null }),
  ];
}

export function createImportEditor() {
  return new Editor({
    extensions: createImportEditorExtensions(),
    editable: false,
  });
}
