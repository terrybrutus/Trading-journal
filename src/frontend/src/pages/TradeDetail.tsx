import { MediaType } from "@/backend";
import { AnnotationCanvas } from "@/components/AnnotationCanvas";
import { type AudioRecap, AudioRecorder } from "@/components/AudioRecorder";
import { MediaGallery } from "@/components/MediaGallery";
import { ShareLinkButton } from "@/components/ShareLinkButton";
import { TradeForm, type TradeFormValues } from "@/components/TradeForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAddAudioRecapToTrade,
  useDeleteTrade,
  useGetTrade,
  useListAudioRecapsForTrade,
  useListMediaForTrade,
  useUpdateTrade,
} from "@/hooks";
import { directionLabel, emotionLabel, originLabel } from "@/lib/labels";
import { thesisLabels } from "@/lib/thesis";
import {
  loadConfig,
  useInternetIdentity,
} from "@caffeineai/core-infrastructure";
import { StorageClient } from "@caffeineai/object-storage";
import { HttpAgent } from "@icp-sdk/core/agent";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function pnlTone(v: number) {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-muted-foreground";
}

function useStorageClient() {
  const { identity } = useInternetIdentity();
  return async () => {
    const config = await loadConfig();
    const agent = identity
      ? HttpAgent.createSync({ identity })
      : HttpAgent.createSync({});
    return new StorageClient(
      config.bucket_name,
      config.storage_gateway_url,
      config.backend_canister_id,
      config.project_id,
      agent,
    );
  };
}

export function TradeDetail() {
  const { tradeId } = useParams({ strict: false }) as { tradeId: string };
  const navigate = useNavigate();
  const tradeQuery = useGetTrade(tradeId ? BigInt(tradeId) : undefined);
  const mediaQuery = useListMediaForTrade(
    tradeId ? BigInt(tradeId) : undefined,
  );
  const recapsQuery = useListAudioRecapsForTrade(
    tradeId ? BigInt(tradeId) : undefined,
  );
  const addRecap = useAddAudioRecapToTrade();
  const updateTrade = useUpdateTrade();
  const deleteTrade = useDeleteTrade();

  const [annotateUrl, setAnnotateUrl] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [annotateResolved, setAnnotateResolved] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const getClient = useStorageClient();

  const trade = tradeQuery.data;
  const media = mediaQuery.data ?? [];
  const recaps = recapsQuery.data ?? [];

  const firstImage = useMemo(
    () => media.find((m) => m.mediaType === MediaType.screenshot) ?? null,
    [media],
  );

  // Resolve gateway URLs for voice-note storage keys.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = recaps.filter(
        (r) => r.audioStorageKey && !audioUrls[r.audioStorageKey],
      );
      if (missing.length === 0) return;
      const client = await getClient();
      const resolved: Record<string, string> = {};
      for (const r of missing) {
        try {
          resolved[r.audioStorageKey] = await client.getDirectURL(
            r.audioStorageKey,
          );
        } catch {
          // fall back to raw key if gateway resolution fails
          resolved[r.audioStorageKey] = r.audioStorageKey;
        }
      }
      if (!cancelled && Object.keys(resolved).length > 0) {
        setAudioUrls((prev) => ({ ...prev, ...resolved }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recaps, audioUrls, getClient]);

  // Resolve the first image storage key to a gateway URL when annotation opens.
  useEffect(() => {
    if (!annotateUrl) {
      setAnnotateResolved(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const client = await getClient();
        const resolved = await client.getDirectURL(annotateUrl);
        if (!cancelled) setAnnotateResolved(resolved);
      } catch {
        // fall back to raw key if gateway resolution fails
        if (!cancelled) setAnnotateResolved(annotateUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [annotateUrl, getClient]);

  async function handleRecap(recap: AudioRecap) {
    if (!tradeId) return;
    try {
      await addRecap.mutateAsync({
        tradeId: BigInt(tradeId),
        recap: {
          audioStorageKey: recap.audioStorageKey,
          transcript: recap.transcript,
          durationSecs: BigInt(recap.durationSecs),
        },
      });
      toast("Audio recap saved");
    } catch (_e) {
      toast("Failed to save recap");
    }
  }

  async function handleEditSubmit(values: TradeFormValues) {
    if (!tradeId) return;
    try {
      await updateTrade.mutateAsync({
        tradeId: BigInt(tradeId),
        updates: {
          exitPrice: values.exitPrice ? Number(values.exitPrice) : undefined,
          realizedPnl: values.outcome ? Number(values.outcome) : undefined,
          outcomeReasoning: values.notes || undefined,
          confidenceRating: BigInt(values.confidence),
        },
      });
      toast.success("Trade updated");
      setEditOpen(false);
      await tradeQuery.refetch();
    } catch (_e) {
      toast.error("Failed to update trade");
    }
  }

  async function handleDelete() {
    if (!tradeId) return;
    setDeleting(true);
    try {
      await deleteTrade.mutateAsync(BigInt(tradeId));
      toast.success("Trade deleted");
      navigate({ to: "/journal" });
    } catch (_e) {
      toast.error("Failed to delete trade");
      setDeleting(false);
    }
  }

  if (tradeQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading trade…
      </div>
    );
  }
  if (!trade) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Trade not found.</p>
        <Link to="/" className="text-sm text-sky-400 hover:text-sky-300">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  const pnl = Number(trade.realizedPnl ?? 0);
  const labels = thesisLabels(trade.direction);
  const shareUrl =
    trade.shareableUrl && trade.shareableUrl.trim().length > 0
      ? trade.shareableUrl
      : `/trades/${trade.id.toString()}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Dashboard
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {trade.symbol}
            </h1>
            <Badge
              variant="outline"
              className={`font-mono text-[10px] uppercase ${
                trade.direction === "long"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-rose-500/10 text-rose-300"
              }`}
            >
              {directionLabel(trade.direction)}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Confidence {Number(trade.confidenceRating ?? 0)} ·{" "}
            {originLabel(trade.tradeOrigin)} ·{" "}
            {emotionLabel(trade.preSessionEmotion.state)}
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Realized PnL
            </p>
            <p
              className={`font-mono text-2xl font-semibold tabular-nums ${pnlTone(pnl)}`}
            >
              {pnl >= 0 ? "+" : ""}
              {pnl.toFixed(2)}
            </p>
          </div>
          <ShareLinkButton
            url={shareUrl}
            label={`Copy share link for ${trade.symbol}`}
            className="self-start"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
            data-ocid="trade.edit_button"
          >
            <Pencil className="h-4 w-4" />
            <span className="sr-only">Edit trade</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            data-ocid="trade.delete_button"
            aria-label="Delete trade"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete trade</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium tracking-tight">
              Thesis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {labels.thesis}
              </span>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                {trade.preTradeThesis.thesis}
              </p>
            </div>
            {trade.preTradeThesis.counterReasons &&
              trade.preTradeThesis.counterReasons.length > 0 && (
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {labels.counterShort}
                  </span>
                  <ul className="mt-1 space-y-1 text-sm">
                    {trade.preTradeThesis.counterReasons.map((r, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: ordered list, index is meaningful
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span>{r.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            {trade.outcomeReasoning && (
              <div>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Notes
                </span>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                  {trade.outcomeReasoning}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium tracking-tight">
              Execution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 font-mono text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry</span>
              <span>{Number(trade.entryPrice ?? 0).toFixed(2)}</span>
            </div>
            {trade.exitPrice !== undefined && trade.exitPrice !== null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exit</span>
                <span>{Number(trade.exitPrice).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Size</span>
              <span>{Number(trade.positionSize ?? 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <MediaGallery tradeId={trade.id.toString()} media={media} />

      {firstImage && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              Annotate
            </h2>
            {annotateUrl ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAnnotateUrl(null)}
              >
                Hide
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAnnotateUrl(firstImage.storageKey)}
              >
                Annotate first image
              </Button>
            )}
          </div>
          {annotateUrl && annotateResolved && (
            <AnnotationCanvas imageUrl={annotateResolved} />
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Voice notes
        </h2>
        <AudioRecorder onRecap={handleRecap} />
        {recaps.length > 0 && (
          <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium tracking-tight">
                Saved voice notes ({recaps.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recaps.map((r) => (
                <div
                  key={r.id}
                  className="space-y-1.5 rounded-md border border-border/40 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">
                      {Number(r.durationSecs).toFixed(0)}s
                    </span>
                    {r.audioStorageKey && (
                      // biome-ignore lint/a11y/useMediaCaption: recorded recap with separate transcript
                      <audio
                        controls
                        src={audioUrls[r.audioStorageKey] ?? r.audioStorageKey}
                        className="h-8 w-full max-w-xs"
                      />
                    )}
                  </div>
                  {r.transcript && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {r.transcript}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit trade</DialogTitle>
          </DialogHeader>
          <TradeForm
            initialTrade={trade}
            onSubmit={handleEditSubmit}
            submitting={updateTrade.isPending}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trade?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              data-ocid="trade.confirm_delete_button"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
