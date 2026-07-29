import { createActor } from "@/backend";
import { Direction, MediaType } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

type ExtensionCaptureMessage = {
  source?: string;
  type?: string;
  capture?: {
    token?: string;
    symbol?: string | null;
    timeframe?: string | null;
    price?: number | null;
    direction?: string | null;
    entryPrice?: number | null;
    exitPrice?: number | null;
    size?: number | null;
    positionSize?: number | null;
    realizedPnl?: number | null;
    outcomeNotes?: string | null;
    reflectionNotes?: string | null;
    transcript?: string | null;
    mediaStorageKey?: string;
    screenshotDataUrl?: string;
    caption?: string | null;
    bucket?: string | null;
  };
};

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function cleanNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function directionFor(value: unknown): Direction | undefined {
  if (value === "long") return Direction.long_;
  if (value === "short") return Direction.short_;
  return undefined;
}

export function ExtensionCaptureBridge() {
  const { actor } = useActor(createActor);
  const queryClient = useQueryClient();

  useEffect(() => {
    async function handleMessage(event: MessageEvent<ExtensionCaptureMessage>) {
      if (event.source !== window) return;
      if (event.data?.source !== "quantum-extension") return;
      if (event.data?.type !== "QUANTUM_EXTENSION_CAPTURE") return;
      if (!actor) {
        window.postMessage(
          {
            source: "quantum-caffeine-app",
            type: "QUANTUM_EXTENSION_CAPTURE_RESULT",
            result: {
              ok: false,
              error: "Caffeine app is not signed in or backend actor is not ready.",
            },
          },
          window.location.origin,
        );
        return;
      }

      const capture = event.data.capture || {};
      if (!capture.token) {
        toast.error("Extension capture missing API token");
        return;
      }

      try {
        const notes = [
          cleanText(capture.outcomeNotes),
          cleanText(capture.reflectionNotes),
          cleanText(capture.transcript)
            ? `Transcript:\n${cleanText(capture.transcript)}`
            : undefined,
          cleanText(capture.bucket) ? `Bucket: ${cleanText(capture.bucket)}` : undefined,
        ].filter(Boolean);

        const result = await actor.receiveExtensionCapture({
          token: capture.token,
          symbol: cleanText(capture.symbol),
          timeframe: cleanText(capture.timeframe),
          price: cleanNumber(capture.price),
          mediaStorageKey:
            capture.mediaStorageKey || capture.screenshotDataUrl || "",
          mediaType: MediaType.screenshot,
          caption: cleanText(capture.caption) || cleanText(capture.bucket),
          direction: directionFor(capture.direction),
          entryPrice: cleanNumber(capture.entryPrice),
          exitPrice: cleanNumber(capture.exitPrice),
          size:
            cleanNumber(capture.size) ?? cleanNumber(capture.positionSize),
          realizedPnl: cleanNumber(capture.realizedPnl),
          outcomeNotes: notes.length > 0 ? notes.join("\n\n") : undefined,
        });

        await queryClient.invalidateQueries({ queryKey: ["trades"] });
        toast.success(`Extension draft created: trade ${result.tradeId}`);
        window.postMessage(
          {
            source: "quantum-caffeine-app",
            type: "QUANTUM_EXTENSION_CAPTURE_RESULT",
            result: {
              ok: true,
              tradeId: result.tradeId.toString(),
              mediaId: result.mediaId.toString(),
              wasDraftCreated: result.wasDraftCreated,
            },
          },
          window.location.origin,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown import error";
        toast.error(`Extension import failed: ${message}`);
        window.postMessage(
          {
            source: "quantum-caffeine-app",
            type: "QUANTUM_EXTENSION_CAPTURE_RESULT",
            result: {
              ok: false,
              error: message,
            },
          },
          window.location.origin,
        );
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [actor, queryClient]);

  return null;
}
