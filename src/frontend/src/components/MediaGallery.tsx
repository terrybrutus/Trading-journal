import { type Media, MediaType } from "@/backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAddMediaToTrade, useDeleteMedia } from "@/hooks";
import {
  loadConfig,
  useInternetIdentity,
} from "@caffeineai/core-infrastructure";
import { StorageClient } from "@caffeineai/object-storage";
import { HttpAgent } from "@icp-sdk/core/agent";
import { useEffect, useRef, useState } from "react";

export interface MediaGalleryProps {
  tradeId: string;
  media: Media[];
}

function isVideo(type: MediaType) {
  return type === MediaType.videoClip;
}

function extForType(type: MediaType) {
  switch (type) {
    case MediaType.videoClip:
      return "mp4";
    case MediaType.gif:
      return "gif";
    default:
      return "png";
  }
}

function mediaTypeForContentType(contentType: string): MediaType {
  if (contentType.startsWith("video/")) return MediaType.videoClip;
  if (contentType === "image/gif") return MediaType.gif;
  return MediaType.screenshot;
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

export function MediaGallery({ tradeId, media }: MediaGalleryProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const addMedia = useAddMediaToTrade();
  const deleteMedia = useDeleteMedia();
  const getClient = useStorageClient();

  // Resolve gateway URLs for any media whose storage key isn't already mapped.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const missing = media.filter((m) => m.storageKey && !urls[m.storageKey]);
      if (missing.length === 0) return;
      const client = await getClient();
      const resolved: Record<string, string> = {};
      for (const m of missing) {
        try {
          resolved[m.storageKey] = await client.getDirectURL(m.storageKey);
        } catch {
          // fall back to raw key if gateway resolution fails
          resolved[m.storageKey] = m.storageKey;
        }
      }
      if (!cancelled && Object.keys(resolved).length > 0) {
        setUrls((prev) => ({ ...prev, ...resolved }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [media, urls, getClient]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const client = await getClient();
      for (const file of Array.from(files)) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const contentType = file.type || "application/octet-stream";
        const ext =
          file.name.split(".").pop() || extForType(MediaType.screenshot);
        const filename = `media-${tradeId}-${Date.now()}.${ext}`;
        const key = await client.putFile(
          bytes,
          undefined,
          contentType,
          filename,
        );
        await addMedia.mutateAsync({
          tradeId: BigInt(tradeId),
          media: {
            storageKey: key.hash,
            mediaType: mediaTypeForContentType(contentType),
          },
        });
      }
    } catch (_e) {
      setError("Upload failed. Please retry.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(m: Media) {
    try {
      await deleteMedia.mutateAsync({
        tradeId: BigInt(tradeId),
        mediaId: m.id,
      });
    } catch (_e) {
      setError("Delete failed.");
    }
  }

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium tracking-tight">
            Media
          </CardTitle>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/mp4,image/gif"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 text-xs text-rose-400">{error}</p>}
        {media.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground">
            No media attached yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {media.map((m) => {
              const src = urls[m.storageKey] ?? m.storageKey;
              return (
                <div
                  key={m.id}
                  className="group relative overflow-hidden rounded-md border border-border/60 bg-black/40"
                >
                  {isVideo(m.mediaType) ? (
                    <video
                      src={src}
                      className="aspect-square w-full object-cover"
                      muted
                      loop
                      controls
                    />
                  ) : (
                    <img
                      src={src}
                      alt={m.storageKey}
                      className="aspect-square w-full object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="truncate font-mono text-[10px] text-white/80">
                      {m.storageKey}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(m)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
