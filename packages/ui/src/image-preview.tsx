"use client";

import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

export { PhotoView } from "react-photo-view";

type ToolbarProps = NonNullable<
  React.ComponentProps<typeof PhotoProvider>["toolbarRender"]
> extends (props: infer P) => React.ReactNode
  ? P
  : never;

const defaultToolbarRender = ({
  scale,
  onScale,
  rotate,
  onRotate,
}: ToolbarProps) => (
  <div className="flex items-center gap-5 pr-4">
    <ZoomIn
      className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white"
      onClick={() => onScale(scale + 0.5)}
    />
    <ZoomOut
      className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white"
      onClick={() => onScale(scale - 0.5)}
    />
    <RotateCw
      className="size-5 cursor-pointer text-white/70 transition-colors hover:text-white"
      onClick={() => onRotate(rotate + 90)}
    />
  </div>
);

type ImagePreviewProps = Omit<
  React.ComponentProps<typeof PhotoProvider>,
  "toolbarRender"
> & {
  /** 单图模式：传入 src 时，children 为触发元素 */
  src?: string;
  /** 自定义工具栏，会追加在默认（放大/缩小/旋转）之后 */
  toolbarRender?: (props: ToolbarProps) => React.ReactNode;
};

/**
 * 图片预览，默认带放大、缩小、旋转。
 * - src 有值：单图模式，children 为触发元素
 * - src 无值：多图模式，children 为 PhotoView 列表
 */
export function ImagePreview({
  src,
  toolbarRender,
  children,
  ...rest
}: ImagePreviewProps) {
  return (
    <PhotoProvider
      {...rest}
      toolbarRender={(props) => (
        <>
          {defaultToolbarRender(props)}
          {toolbarRender?.(props)}
        </>
      )}
    >
      {src ? (
        <PhotoView src={src}>{children as React.ReactElement}</PhotoView>
      ) : (
        children
      )}
    </PhotoProvider>
  );
}
