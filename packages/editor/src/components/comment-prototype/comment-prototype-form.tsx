import { AtSignIcon, CornerDownLeftIcon } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { cn } from "../../lib/utils";

const inputShell =
  "rounded-2xl border-0 bg-background px-3 py-2 text-foreground shadow-[0_8px_30px_-6px_rgb(0_0_0/0.14)] ring-0 dark:shadow-[0_10px_36px_-8px_rgb(0_0_0/0.55)]";

type CommentPrototypeFormProps = {
  className?: string;
};

/** 选区气泡与边距评论共用的占位输入（无边框卡片，只靠阴影托起） */
export function CommentPrototypeForm({ className }: CommentPrototypeFormProps) {
  return (
    <div className={cn("w-[min(20rem,calc(100vw-2rem))]", className)}>
      <div className={cn("flex items-center gap-0.5", inputShell)}>
        <Input
          className="h-8 flex-1 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0"
          placeholder="Add comment..."
          aria-label="评论内容（原型占位）"
        />
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="size-7 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
          aria-label="提及用户（占位）"
        >
          <AtSignIcon className="size-4 stroke-[1.25]" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="size-7 shrink-0 text-muted-foreground/80 hover:text-muted-foreground"
          aria-label="提交评论（占位）"
        >
          <CornerDownLeftIcon className="size-4 stroke-[1.25]" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
