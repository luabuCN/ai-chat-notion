"use client";

interface GalleryTabProps {
  onSelectCover: (url: string) => void;
  onClose: () => void;
}

// Notion 风格的纯色和渐变
const PRESET_COLORS = [
  { name: "红色", value: "#e16259" },
  { name: "黄色", value: "#dfab01" },
  { name: "蓝色", value: "#0b6e99" },
  { name: "米色", value: "#f6e9dc" },
  {
    name: "渐变粉",
    value: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
  },
  {
    name: "渐变红",
    value: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  },
  {
    name: "渐变橙",
    value: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  },
  {
    name: "渐变蓝",
    value: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  },
  {
    name: "渐变青",
    value: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
  },
  {
    name: "渐变紫",
    value: "linear-gradient(135deg, #d299c2 0%, #fef9d7 100%)",
  },
];

export function GalleryTab({ onSelectCover, onClose }: GalleryTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">颜色和渐变</p>
      <div className="grid grid-cols-5 gap-2">
        {PRESET_COLORS.map((color, index) => (
          <button
            key={index}
            type="button"
            className="aspect-[4/3] rounded-md hover:opacity-80 transition-opacity"
            style={{ background: color.value }}
            onClick={() => {
              onSelectCover(color.value);
              onClose();
            }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
}
