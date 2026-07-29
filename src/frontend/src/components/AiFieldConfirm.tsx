import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

/**
 * Wraps a form field and shows the AI-suggested treatment when a value was
 * routed in by the universal mic but not yet accepted.
 *
 * Visual states:
 * - `aiSuggested && !confirmed` → `.ai-field` background + `.ai-badge` pill +
 *   an Accept button that promotes the field to `.ai-field-confirmed`.
 * - `confirmed` → `.ai-field-confirmed` (subtle primary left border, normal
 *   card background). The badge stays visible so the user has a record that
 *   the value came from voice.
 * - not AI-suggested → renders the child untouched.
 *
 * The wrapped field control is passed as `children` so this component stays
 * presentational. The parent owns the actual value and `onAccept` callback.
 */
export interface AiFieldConfirmProps {
  /** Whether the current value originated from AI voice routing. */
  aiSuggested: boolean;
  /** Whether the user has accepted the AI suggestion. */
  confirmed: boolean;
  /** Promote the AI suggestion to a confirmed value. */
  onAccept: () => void;
  /** Optional label for the AI badge; defaults to "AI". */
  badgeLabel?: string;
  /** Hide the Accept button (e.g. for read-only displays). */
  hideAccept?: boolean;
  /** Extra class names applied to the wrapper. */
  className?: string;
  /** The field control to wrap. */
  children: ReactNode;
}

export function AiFieldConfirm({
  aiSuggested,
  confirmed,
  onAccept,
  badgeLabel = "AI",
  hideAccept = false,
  className,
  children,
}: AiFieldConfirmProps) {
  const [popping, setPopping] = useState(false);

  // Trigger the confirm-pop animation when transitioning to confirmed.
  useEffect(() => {
    if (confirmed) {
      setPopping(true);
      const t = setTimeout(() => setPopping(false), 320);
      return () => clearTimeout(t);
    }
  }, [confirmed]);

  if (!aiSuggested) return <div className={className}>{children}</div>;

  return (
    <div
      className={cn(
        "rounded-md transition-smooth",
        confirmed ? "ai-field-confirmed" : "ai-field",
        popping && "animate-ai-confirm-pop",
        className,
      )}
    >
      <div className="flex items-start gap-2 p-2">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <span className="ai-badge" data-ocid="ai.badge">
            <Sparkles className="size-2.5" aria-hidden="true" />
            {badgeLabel}
          </span>
          {!confirmed && !hideAccept && (
            <button
              type="button"
              data-ocid="ai.accept_button"
              onClick={onAccept}
              className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex items-center gap-1 rounded-md border border-primary/30 px-2 py-0.5 text-[11px] font-medium transition-smooth"
            >
              <Check className="size-3" aria-hidden="true" />
              Accept
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
