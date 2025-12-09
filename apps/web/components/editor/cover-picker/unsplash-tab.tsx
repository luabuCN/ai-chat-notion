"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";

interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    small: string;
  };
  user: {
    name: string;
  };
}

interface UnsplashTabProps {
  onSelectCover: (url: string) => void;
  onClose: () => void;
}

function PhotoSkeleton() {
  return (
    <div className="relative aspect-video rounded-lg overflow-hidden bg-muted animate-pulse" />
  );
}

export function UnsplashTab({ onSelectCover, onClose }: UnsplashTabProps) {
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/unsplash?query=${encodeURIComponent(query)}&page=1&per_page=12`
      );
      if (!response.ok) throw new Error("Failed to fetch");
      const data = await response.json();
      setPhotos(data.results || []);
    } catch (error) {
      toast.error("加载图片失败");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="搜索图片..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSearch();
        }}
        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <PhotoSkeleton key={i} />
          ))}
        </div>
      ) : !hasSearched ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">
            输入关键词搜索 Unsplash 图片
          </p>
        </div>
      ) : photos.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-muted-foreground">未找到相关图片</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {photos.map((photo) => {
            const handleSelect = () => {
              onSelectCover(photo.urls.raw);
              setTimeout(() => onClose(), 0);
            };

            return (
              <button
                key={photo.id}
                type="button"
                className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all group"
                onClick={handleSelect}
              >
                <Image
                  src={photo.urls.small}
                  alt={`Photo by ${photo.user.name}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  作者 {photo.user.name}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
