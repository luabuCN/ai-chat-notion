import { cn } from "../../lib/utils";
import { CornerDownLeft } from "lucide-react";

interface ActionItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
}

export default function ActionItem({ icon, label, onClick }: ActionItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full min-w-[200px] items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none",
        "hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-500/10 dark:hover:text-violet-200",
        "focus:bg-violet-50 focus:text-violet-700 dark:focus:bg-violet-500/10 dark:focus:text-violet-200",
        "group relative text-left"
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onClick) {
          onClick();
        }
      }}
    >
      <span className="flex items-center gap-2 flex-1">
        {icon && <span>{icon}</span>}
        <span>{label}</span>
      </span>
      <CornerDownLeft
        className={cn(
          "h-4 w-4 text-muted-foreground dark:text-muted-foreground opacity-0 transition-opacity",
          "group-hover:opacity-100"
        )}
      />
    </button>
  );
}
