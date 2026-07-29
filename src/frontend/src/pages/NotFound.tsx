import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <div
      data-ocid="not_found.page"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center animate-fade-in"
    >
      <div className="space-y-1">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          404
        </h2>
        <p className="text-muted-foreground text-sm">
          That page doesn’t exist in your journal.
        </p>
      </div>
      <Button asChild data-ocid="not_found.back_button">
        <Link to="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}
