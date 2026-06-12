"use client";

import { createLibrary, useIsStreaming } from "@openuidev/react-lang";
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

type SectionItemNode = {
  props?: {
    value?: string;
    trigger?: string;
    content?: unknown;
  };
};

type SectionBlockProps = {
  props: {
    sections?: SectionItemNode[];
    isFoldable?: boolean;
  };
  renderNode: (node: unknown) => ReactNode;
};

function Separator({ className }: { className?: string }) {
  return (
    <div
      aria-orientation="horizontal"
      className={clsx("openui-separator", className)}
      role="separator"
    />
  );
}

function SectionV2({
  trigger,
  children,
}: {
  trigger: string;
  children: ReactNode;
}) {
  return (
    <div className="openui-section-v2">
      <div className="openui-section-v2-wrapper">
        <Separator />
        <div className="openui-section-v2-header">
          <div className="openui-section-v2-header-trigger">{trigger}</div>
        </div>
        <div className="openui-section-v2-content">{children}</div>
      </div>
    </div>
  );
}

function FoldableSectionTrigger({
  isOpen,
  text,
  onToggle,
}: {
  isOpen: boolean;
  text: string;
  onToggle: () => void;
}) {
  const state = isOpen ? "open" : "closed";

  return (
    <h3 className="openui-foldable-section-header" data-state={state}>
      <button
        aria-expanded={isOpen}
        className="openui-foldable-section-trigger"
        data-state={state}
        onClick={onToggle}
        type="button"
      >
        <div className="openui-foldable-section-trigger-content-wrapper">
          <Separator className="openui-foldable-section-trigger-content-separator" />
          <div className="openui-foldable-section-trigger-content-icon-button-wrapper">
            <span
              aria-hidden="true"
              className="openui-icon-button openui-icon-button-secondary openui-icon-button-3-extra-small openui-icon-button-square openui-foldable-section-trigger-content-icon-button"
            >
              <span className="openui-icon-button-icon">
                <ChevronRight className="openui-foldable-section-trigger-content-icon-button-icon" />
              </span>
            </span>
            <div className="openui-foldable-section-trigger-content-text">
              {text}
            </div>
          </div>
        </div>
      </button>
    </h3>
  );
}

function SafeSectionBlock({ props, renderNode }: SectionBlockProps) {
  const items = props.sections ?? [];
  const isFoldable = props.isFoldable !== false;
  const isStreaming = useIsStreaming();
  const firstItemValue = items[0]?.props?.value;
  const [openItems, setOpenItems] = useState<string[]>([]);
  const userSelected = useRef(false);
  const previousLengthRef = useRef(0);
  const previousIsStreaming = useRef(isStreaming);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    if (
      isStreaming &&
      items.length > previousLengthRef.current &&
      !userSelected.current
    ) {
      const lastValue = items.at(-1)?.props?.value;
      if (lastValue) {
        setOpenItems((previous) =>
          previous.includes(lastValue) ? previous : [...previous, lastValue]
        );
      }
    } else {
      setOpenItems((previous) =>
        previous.length === 0 && firstItemValue ? [firstItemValue] : previous
      );
    }

    previousLengthRef.current = items.length;
  }, [firstItemValue, isStreaming, items]);

  useEffect(() => {
    if (
      previousIsStreaming.current &&
      !isStreaming &&
      !userSelected.current &&
      items.length > 0
    ) {
      setOpenItems(firstItemValue ? [firstItemValue] : []);
    }

    previousIsStreaming.current = isStreaming;
  }, [firstItemValue, isStreaming, items.length]);

  const handleToggle = useCallback((value: string) => {
    userSelected.current = true;
    setOpenItems((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  }, []);

  if (!isFoldable) {
    return (
      <>
        {items.map((item, index) => (
          <SectionV2
            key={`${item?.props?.value ?? "section"}-${index}`}
            trigger={String(item?.props?.trigger ?? "")}
          >
            {renderNode(item?.props?.content)}
          </SectionV2>
        ))}
      </>
    );
  }

  return (
    <div className="openui-foldable-section-root" data-orientation="vertical">
      {items.map((item, index) => {
        const value = String(item?.props?.value ?? index);
        const isOpen = openItems.includes(value);
        const state = isOpen ? "open" : "closed";

        return (
          <div
            className="openui-foldable-section-item"
            data-state={state}
            key={`${value}-${index}`}
          >
            <FoldableSectionTrigger
              isOpen={isOpen}
              onToggle={() => handleToggle(value)}
              text={String(item?.props?.trigger ?? "")}
            />
            {isOpen ? (
              <div
                className="openui-foldable-section-content"
                data-state={state}
              >
                {renderNode(item?.props?.content)}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export const openuiSafeChatLibrary = createLibrary({
  componentGroups: openuiChatLibrary.componentGroups,
  components: Object.values({
    ...openuiChatLibrary.components,
    SectionBlock: {
      ...openuiChatLibrary.components.SectionBlock,
      component: SafeSectionBlock,
    },
  }),
  root: openuiChatLibrary.root,
});
