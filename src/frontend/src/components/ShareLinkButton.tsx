import { cn } from "@/lib/utils";
import { Check, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Copy-to-clipboard share button using the `.share-link-btn*` design tokens.
 *
 * Takes a URL, copies it to the clipboard on click, and shows a "Copied"
 * state (`.share-link-btn-copied`) for a few seconds before reverting. Used
 * in Journal list rows and TradeDetail to surface per-entry shareable links.
 */
export interface ShareLinkButtonProps {
  /** The URL to copy. When empty/blank the button renders disabled. */
  url: string | undefined | null;
  /** Optional accessible label; defaults to "Copy share link". */
  label?: string;
  /** Compact variant — icon only, no visible text. */
  compact?: boolean;
  /** Extra class names. */
  className?: string;
}

export function ShareLinkButton({
  url,
  label = "Copy share link",
  compact = false,
  className,
}: ShareLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const disabled = !url || url.trim().length === 0;

  async function onCopy() {
    if (disabled || !url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard may be blocked; leave button in default state.
    }
  }

  return (
    <button
      type="button"
      data-ocid="share.copy_link"
      onClick={onCopy}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "share-link-btn",
        copied && "share-link-btn-copied",
        disabled && "opacity-50 cursor-not-allowed",
        compact && "px-1.5 py-1.5",
        className,
      )}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Link2 className="size-3.5" aria-hidden="true" />
      )}
      {!compact && <span>{copied ? "Copied" : "Share"}</span>}
    </button>
  );
}
