import type { AppUsage } from "../usage";

export type User = {
  id: string;
  email: string;
  password: string | null;
};

export type Chat = {
  id: string;
  createdAt: Date;
  title: string;
  userId: string;
  workspaceId: string | null;
  lastContext: AppUsage | null;
};

export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: unknown;
  attachments: unknown;
  createdAt: Date;
};

export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type Document = {
  id: string;
  createdAt: Date;
  title: string;
  content: string | null;
  kind: string;
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId: string;
  createdAt: Date;
};

export type Stream = {
  id: string;
  chatId: string;
  createdAt: Date;
};

export type EditorDocument = {
  id: string;
  title: string;
  content: string | null;
  userId: string;
  workspaceId: string | null;
  parentDocumentId: string | null;
  icon: string | null;
  coverImage: string | null;
  coverImageType: string | null;
  coverImagePosition: number | null;
  isPublished: boolean;
  isFavorite: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: Date;
};

export type WorkspaceWithMemberCount = Workspace & {
  _count: { members: number };
};
