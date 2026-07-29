import { useUniversalMicContext } from "@/hooks/useUniversalMic";
import { cn } from "@/lib/utils";
import { Loader2, Mic } from "lucide-react";

/**
 * Universal floating mic button.
 *
 * Mounted once in the Layout. The button is only visible when a form page
 * has registered a field sink (via `registerFieldSink`), so it stays out of
 * the way on Dashboard/Analytics/etc. Clicking toggles recording; while
 * recording, a second click stops and triggers transcription + AI routing.
 *
 * Uses the `.mic-btn*` design tokens from index.css for idle/recording/
 * processing states.
 */
export function UniversalMic() {
  const { status, enabled, toggle, error, reset } = useUniversalMicContext();

  if (!enabled) return null;

  const recording = status === "recording";
  const processing = status === "processing";

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {error && (
        <div
          role="alert"
          className="bg-card text-card-foreground border-destructive/40 max-w-xs rounded-md border p-3 text-xs shadow-elevated animate-fade-in"
        >
          <div className="flex items-start gap-2">
            <span className="text-destructive flex-1">{error}</span>
            <button
              type="button"
              data-ocid="mic.error_dismiss"
              onClick={reset}
              className="text-muted-foreground hover:text-foreground transition-smooth shrink-0"
              aria-label="Dismiss voice error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        data-ocid="mic.toggle"
        onClick={toggle}
        disabled={processing}
        aria-label={
          recording
            ? "Stop recording and route to fields"
            : processing
              ? "Processing voice"
              : "Start voice capture"
        }
        aria-pressed={recording}
        className={cn(
          "mic-btn size-14 shadow-mic-float",
          recording && "mic-btn-recording shadow-mic-recording",
          processing && "mic-btn-processing",
          processing && "cursor-progress",
        )}
      >
        {processing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : recording ? (
          <span className="mic-dot-recording" aria-hidden="true" />
        ) : (
          <Mic className="size-5" />
        )}
      </button>

      <span
        className={cn(
          "bg-card/80 text-muted-foreground border-border rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider backdrop-blur-sm",
          recording && "text-primary border-primary/40",
          processing && "text-warning border-warning/40",
        )}
      >
        {recording
          ? "Recording — tap to stop"
          : processing
            ? "Routing…"
            : "Voice"}
      </span>
    </div>
  );
}
