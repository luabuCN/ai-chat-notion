import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

function AnimatedText({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      animate="visible"
      className={className}
      initial="hidden"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.045,
            delayChildren: delay,
          },
        },
      }}
    >
      {Array.from(text).map((char, index) => (
        <motion.span
          className="inline-block"
          key={`${char}-${index}`}
          variants={{
            hidden: { opacity: 0, y: 14, scale: 0.96 },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                type: "spring",
                stiffness: 420,
                damping: 24,
              },
            },
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.div>
  );
}

function getTimeGreetingKey(): "greetingMorning" | "greetingAfternoon" | "greetingEvening" {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "greetingMorning";
  if (hour >= 12 && hour < 18) return "greetingAfternoon";
  return "greetingEvening";
}

export const Greeting = () => {
  const t = useTranslations("Chat");
  const [periodKey, setPeriodKey] = useState(getTimeGreetingKey);

  useEffect(() => {
    const interval = setInterval(() => {
      setPeriodKey((prev) => {
        const next = getTimeGreetingKey();
        return next !== prev ? next : prev;
      });
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const greetingText = t("greeting", { time: t(periodKey) });

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-col px-4 text-center md:px-8"
      key="overview"
    >
      <AnimatedText
        className="font-semibold text-xl text-zinc-700 md:text-2xl dark:text-zinc-300"
        delay={0.15}
        text={greetingText}
      />
    </div>
  );
};
