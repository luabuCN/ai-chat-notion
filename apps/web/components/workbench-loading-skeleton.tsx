"use client";

import { motion } from "framer-motion";

const dotVariants = {
  initial: { opacity: 0.35, y: 0 },
  animate: (index: number) => ({
    opacity: [0.35, 1, 0.35],
    y: [0, -3, 0],
    transition: {
      duration: 1.1,
      repeat: Number.POSITIVE_INFINITY,
      ease: "easeInOut",
      delay: index * 0.14,
    },
  }),
};

export function WorkbenchLoadingSkeleton() {
  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="relative flex min-h-[calc(100dvh-1px)] w-full flex-col bg-background"
      initial={{ opacity: 0 }}
      role="status"
      aria-busy="true"
      aria-live="polite"
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <span className="sr-only">正在加载页面</span>

      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-zinc-300/80 to-transparent dark:via-zinc-600/60"
        animate={{ opacity: [0.25, 0.85, 0.25] }}
        transition={{
          duration: 1.6,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
        <div aria-hidden className="flex items-center gap-2">
          {[0, 1, 2].map((index) => (
            <motion.span
              key={index}
              className="size-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400"
              custom={index}
              variants={dotVariants}
              initial="initial"
              animate="animate"
            />
          ))}
        </div>
        <motion.p
          animate={{ opacity: [0.55, 1, 0.55] }}
          className="text-sm font-medium text-zinc-800 dark:text-zinc-200"
          transition={{
            duration: 1.6,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          加载中
        </motion.p>
      </div>
    </motion.div>
  );
}
