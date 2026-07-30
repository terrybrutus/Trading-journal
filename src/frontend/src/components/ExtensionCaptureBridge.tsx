import { createActor } from "@/backend";
import { Direction, MediaType } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type ExtensionCaptureMessage = {
  source?: string;
  type?: string;
  capture?: {
    captureId?: string;
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

type ExtensionCapturePayload = NonNullable<ExtensionCaptureMessage["capture"]>;

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
  const [pendingCapture, setPendingCapture] =
    useState<ExtensionCapturePayload | null>(null);
  const pendingSinceRef = useRef<number>(0);
  const inFlightCaptureIdsRef = useRef<Set<string>>(new Set());
  const processedCaptureIdsRef = useRef<Set<string>>(new Set());

  const reportResult = useCallback((result: Record<string, unknown>) => {
    window.postMessage(
      {
        source: "quantum-caffeine-app",
        type: "QUANTUM_EXTENSION_CAPTURE_RESULT",
        result,
      },
      window.location.origin,
    );
  }, []);

  const importCapture = useCallback(
    async (capture: ExtensionCapturePayload) => {
      if (!actor) return false;
      const captureId = cleanText(capture.captureId);
      if (captureId && processedCaptureIdsRef.current.has(captureId)) {
        reportResult({
          ok: true,
          duplicate: true,
          captureId,
        });
        return true;
      }
      if (captureId && inFlightCaptureIdsRef.current.has(captureId)) {
        return false;
      }
      if (!capture.token) {
        toast.error("Extension capture missing API token");
        reportResult({
          ok: false,
          error: "Extension capture missing API token.",
        });
        return true;
      }

      try {
        if (captureId) inFlightCaptureIdsRef.current.add(captureId);
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
        if (captureId) processedCaptureIdsRef.current.add(captureId);
        toast.success(`Extension draft created: trade ${result.tradeId}`);
        reportResult({
              ok: true,
              captureId,
              tradeId: result.tradeId.toString(),
          mediaId: result.mediaId.toString(),
          wasDraftCreated: result.wasDraftCreated,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown import error";
        toast.error(`Extension import failed: ${message}`);
        reportResult({
          ok: false,
          captureId,
          error: message,
        });
      } finally {
        if (captureId) inFlightCaptureIdsRef.current.delete(captureId);
      }
      return true;
    },
    [actor, queryClient, reportResult],
  );

  useEffect(() => {
    async function handleMessage(event: MessageEvent<ExtensionCaptureMessage>) {
      if (event.source !== window) return;
      if (event.data?.source !== "quantum-extension") return;
      if (event.data?.type !== "QUANTUM_EXTENSION_CAPTURE") return;

      const capture = event.data.capture || {};
      pendingSinceRef.current = Date.now();
      setPendingCapture(capture);
      toast("Extension capture received. Waiting for Caffeine backend...");
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!pendingCapture) return;
    let cancelled = false;
    const captureToImport = pendingCapture;

    async function tryImport() {
      const imported = await importCapture(captureToImport);
      if (cancelled) return;
      if (imported) {
        setPendingCapture(null);
        return;
      }
      if (Date.now() - pendingSinceRef.current > 45000) {
        reportResult({
          ok: false,
          error:
            "Caffeine backend was not ready after 45 seconds. Confirm you are signed in, then click Send to Caffeine again.",
        });
        setPendingCapture(null);
      }
    }

    tryImport();
    const interval = window.setInterval(tryImport, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [importCapture, pendingCapture, reportResult]);

  return null;
}
