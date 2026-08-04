import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  loadConfig,
  useInternetIdentity,
} from "@caffeineai/core-infrastructure";
import { StorageClient } from "@caffeineai/object-storage";
import { HttpAgent } from "@icp-sdk/core/agent";
import { useEffect, useRef, useState } from "react";

export interface AudioRecap {
  audioStorageKey: string;
  transcript: string;
  durationSecs: number;
}

export interface AudioRecorderProps {
  onRecap?: (recap: AudioRecap) => void | Promise<void>;
}

type RecorderState =
  | "idle"
  | "recording"
  | "recorded"
  | "uploading"
  | "review"
  | "saving"
  | "done";

export function AudioRecorder({ onRecap }: AudioRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMeta, setAudioMeta] = useState<{
    filename: string;
    contentType: string;
  } | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [audioStorageKey, setAudioStorageKey] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { identity } = useInternetIdentity();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      for (const t of streamRef.current?.getTracks() ?? []) t.stop();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  function setLocalAudioUrl(url: string) {
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
  }

  async function start() {
    setError(null);
    setTranscript("");
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioMeta(null);
    setAudioStorageKey(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      mr.onstop = () => {
        const contentType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: contentType });
        setLocalAudioUrl(URL.createObjectURL(blob));
        setAudioMeta({
          filename: `voice-note-${Date.now()}.webm`,
          contentType,
        });
        setState("recorded");
      };
      mr.start();
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch (_e) {
      setError("Microphone access denied or unavailable.");
      setState("idle");
    }
  }

  function stop() {
    mediaRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    for (const t of streamRef.current?.getTracks() ?? []) t.stop();
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setTranscript("");
    setAudioStorageKey(null);
    setElapsed(0);
    setLocalAudioUrl(URL.createObjectURL(file));
    setAudioMeta({
      filename: file.name || `voice-note-${Date.now()}`,
      contentType: file.type || "audio/mpeg",
    });
    setState("recorded");
  }

  async function uploadAudio() {
    if (!audioUrl) return;
    setState("uploading");
    setError(null);
    try {
      const blob = await fetch(audioUrl).then((r) => r.blob());
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const config = await loadConfig();
      const agent = identity
        ? HttpAgent.createSync({ identity })
        : HttpAgent.createSync({});
      const client = new StorageClient(
        config.bucket_name,
        config.storage_gateway_url,
        config.backend_canister_id,
        config.project_id,
        agent,
      );
      const key = await client.putFile(
        bytes,
        undefined,
        audioMeta?.contentType || blob.type || "audio/webm",
        audioMeta?.filename || `voice-note-${Date.now()}.webm`,
      );
      setAudioStorageKey(key.hash);
      setState("review");
    } catch (_e) {
      setError("Upload failed. Please retry.");
      setState("recorded");
    }
  }

  async function saveRecap() {
    if (!audioStorageKey) return;
    setState("saving");
    setError(null);
    try {
      if (onRecap) {
        await onRecap({
          audioStorageKey,
          transcript: transcript.trim(),
          durationSecs: elapsed,
        });
      }
      setState("done");
    } catch (_e) {
      setError("Failed to save voice note. Please retry.");
      setState("review");
    }
  }

  function reset() {
    setState("idle");
    setElapsed(0);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioMeta(null);
    setTranscript("");
    setAudioStorageKey(null);
    setError(null);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium tracking-tight">
          Voice note
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              state === "recording"
                ? "animate-pulse bg-rose-500"
                : state === "done"
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/40"
            }`}
          />
          <span className="font-mono text-sm tabular-nums">
            {mm}:{ss}
          </span>
          <div className="ml-auto flex gap-2">
            {state === "idle" && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.webm"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                <Button type="button" size="sm" onClick={start}>
                  Record
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Upload
                </Button>
              </>
            )}
            {state === "recording" && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={stop}
              >
                Stop
              </Button>
            )}
            {(state === "recorded" || state === "uploading") && (
              <Button
                type="button"
                size="sm"
                onClick={uploadAudio}
                disabled={state === "uploading"}
              >
                {state === "uploading" ? "Uploading..." : "Upload audio"}
              </Button>
            )}
            {(state === "review" || state === "saving") && (
              <Button
                type="button"
                size="sm"
                onClick={saveRecap}
                disabled={state === "saving"}
              >
                {state === "saving" ? "Saving..." : "Save voice note"}
              </Button>
            )}
            {state === "done" && (
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                New voice note
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        {audioUrl && state !== "recording" && (
          // biome-ignore lint/a11y/useMediaCaption: audio is a trade voice note with optional text notes
          <audio controls src={audioUrl} className="w-full" />
        )}

        {state === "review" && (
          <div className="space-y-1.5">
            <Label htmlFor="transcript">
              Transcript or notes{" "}
              <span className="text-xs font-normal text-muted-foreground">
                - optional
              </span>
            </Label>
            <Textarea
              id="transcript"
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste a transcript, summarize the audio, or leave blank and keep the audio as the source."
            />
            <p className="text-xs text-muted-foreground">
              The audio is saved to this trade. Text can be added now or later.
            </p>
          </div>
        )}

        {state === "done" && transcript && (
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Transcript or notes
            </span>
            <p className="whitespace-pre-wrap rounded-md border border-border/60 bg-muted/30 p-3 text-sm leading-relaxed">
              {transcript}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
