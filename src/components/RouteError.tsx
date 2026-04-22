import { useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface RouteErrorProps {
  error: Error;
  reset: () => void;
}

/**
 * Shared per-route error UI. Use as `errorComponent` in createFileRoute.
 */
export function RouteError({ error, reset }: RouteErrorProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
      <div className="rounded-full bg-destructive/10 p-3 mb-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-base font-semibold">Something went wrong</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md break-words">{error.message}</p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Try again
      </Button>
    </div>
  );
}
