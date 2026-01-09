"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CollaborativeUser {
  name: string;
  color: string;
  avatar?: string;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "idle";

interface CollaborationContextType {
  connectedUsers: CollaborativeUser[];
  setConnectedUsers: (users: CollaborativeUser[]) => void;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
}

const CollaborationContext = createContext<
  CollaborationContextType | undefined
>(undefined);

export function CollaborationProvider({ children }: { children: ReactNode }) {
  const [connectedUsers, setConnectedUsers] = useState<CollaborativeUser[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");

  return (
    <CollaborationContext.Provider
      value={{
        connectedUsers,
        setConnectedUsers,
        connectionStatus,
        setConnectionStatus,
      }}
    >
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
