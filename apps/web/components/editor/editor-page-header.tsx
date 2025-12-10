"use client";

import { useState, useCallback } from "react";
import { EditorCover } from "./editor-cover";
import { EditorTitle } from "./editor-title";
import { EditorToolbar } from "./editor-toolbar";
import { EmojiPicker } from "./emoji-picker";
import { CoverPickerDialog } from "./cover-picker-dialog";

interface EditorPageHeaderProps {
  initialTitle?: string;
  initialIcon?: string | null;
  initialCover?: string | null;
  onTitleChange?: (title: string) => void;
  onIconChange?: (icon: string | null) => void;
  onCoverChange?: (cover: string | null) => void;
}

export function EditorPageHeader({
  initialTitle = "",
  initialIcon = null,
  initialCover = null,
  onTitleChange,
  onIconChange,
  onCoverChange,
}: EditorPageHeaderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [cover, setCover] = useState<string | null>(initialCover);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  const handleAddIcon = useCallback(
    (emoji: string) => {
      setIcon(emoji);
      onIconChange?.(emoji);
    },
    [onIconChange]
  );

  const handleRemoveIcon = useCallback(() => {
    setIcon(null);
    onIconChange?.(null);
  }, [onIconChange]);

  const handleAddCover = useCallback(() => {
    setShowCoverPicker(true);
  }, []);

  const handleChangeCover = useCallback(() => {
    setShowCoverPicker(true);
  }, []);

  const handleSelectCover = useCallback(
    (newCover: string) => {
      setCover(newCover);
      onCoverChange?.(newCover);
    },
    [onCoverChange]
  );

  const handleRemoveCover = useCallback(() => {
    setCover(null);
    onCoverChange?.(null);
  }, [onCoverChange]);

  return (
    <div className="w-full">
      {/* 封面图片 */}
      <EditorCover
        coverUrl={cover}
        onChangeCover={handleChangeCover}
        onRemoveCover={handleRemoveCover}
      />

      {/* 内容区域 */}
      <div className="max-w-4xl mx-auto px-6">
        {/* 图标区域 - 有封面时显示在封面下方偏移位置 */}
        {icon && (
          <div className={cover ? "-mt-10 mb-4 relative z-10" : "mt-8 mb-4"}>
            <EmojiPicker onEmojiSelect={handleAddIcon}>
              <button
                type="button"
                className="text-6xl hover:opacity-80 transition-opacity cursor-pointer"
                title="点击更换图标"
              >
                {icon}
              </button>
            </EmojiPicker>
          </div>
        )}

        {/* 工具栏 - hover时显示 */}
        <div className={`group ${!icon && !cover ? "mt-8" : "mt-2"}`}>
          <EditorToolbar
            visible={true}
            hasIcon={!!icon}
            hasCover={!!cover}
            onAddIcon={handleAddIcon}
            onAddCover={handleAddCover}
          />
        </div>

        {/* 标题输入 */}
        <div className="mt-2 mb-4">
          <EditorTitle value={title} onChange={handleTitleChange} />
        </div>
      </div>

      {/* 封面选择对话框 */}
      <CoverPickerDialog
        open={showCoverPicker}
        onOpenChange={setShowCoverPicker}
        onSelectCover={handleSelectCover}
      />
    </div>
  );
}
