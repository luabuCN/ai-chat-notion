"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CollaborativeUser {
  name: string;
  color: string;
  avatar?: string;
}

interface CollaborationContextType {
  connectedUsers: CollaborativeUser[];
  setConnectedUsers: (users: CollaborativeUser[]) => void;
}

const CollaborationContext = createContext<
  CollaborationContextType | undefined
>(undefined);

export function CollaborationProvider({ children }: { children: ReactNode }) {
  const [connectedUsers, setConnectedUsers] = useState<CollaborativeUser[]>([]);

  return (
    <CollaborationContext.Provider value={{ connectedUsers, setConnectedUsers }}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration() {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error(
      "useCollaboration must be used within a CollaborationProvider"
    );
  }
  return context;
}

