import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Consistent empty-state card for tables/lists when filters return zero rows
 * or a list is genuinely empty.
 */
export function EmptyState({ icon: Icon = Inbox, title, hint, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-10 px-4 text-center ${className}`}>
      <div className="rounded-full bg-muted/60 p-3 mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
