"use client";

import { PhotoProvider as ReactPhotoProvider } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

export function PhotoProvider({ children }: { children: React.ReactNode }) {
  return <ReactPhotoProvider>{children}</ReactPhotoProvider>;
}
