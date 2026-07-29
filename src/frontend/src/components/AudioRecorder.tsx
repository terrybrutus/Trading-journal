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
  const [transcript, setTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [audioStorageKey, setAudioStorageKey] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { identity } = useInternetIdentity();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      for (const t of streamRef.current?.getTracks() ?? []) t.stop();
    };
  }, []);

  async function start() {
    setError(null);
    setTranscript("");
    setAudioUrl(null);
    setAudioStorageKey(null);
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
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
      const filename = `recap-${Date.now()}.webm`;
      const key = await client.putFile(
        bytes,
        undefined,
        "audio/webm",
        filename,
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
    const trimmed = transcript.trim();
    if (trimmed.length === 0) {
      setError("Please enter a transcript before saving.");
      return;
    }
    setState("saving");
    setError(null);
    try {
      if (onRecap) {
        await onRecap({
          audioStorageKey,
          transcript: trimmed,
          durationSecs: elapsed,
        });
      }
      setState("done");
    } catch (_e) {
      setError("Failed to save recap. Please retry.");
      setState("review");
    }
  }

  function reset() {
    setState("idle");
    setElapsed(0);
    setAudioUrl(null);
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
          Audio Recap
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
              <Button type="button" size="sm" onClick={start}>
                Record
              </Button>
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
                {state === "uploading" ? "Uploading…" : "Upload audio"}
              </Button>
            )}
            {(state === "review" || state === "saving") && (
              <Button
                type="button"
                size="sm"
                onClick={saveRecap}
                disabled={state === "saving" || transcript.trim().length === 0}
              >
                {state === "saving" ? "Saving…" : "Save recap"}
              </Button>
            )}
            {state === "done" && (
              <Button type="button" size="sm" variant="ghost" onClick={reset}>
                New recording
              </Button>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}

        {audioUrl && state !== "recording" && (
          // biome-ignore lint/a11y/useMediaCaption: audio is a recorded recap with separate transcript
          <audio controls src={audioUrl} className="w-full" />
        )}

        {state === "review" && (
          <div className="space-y-1.5">
            <Label htmlFor="transcript">
              Transcript{" "}
              <span className="text-xs font-normal text-muted-foreground">
                — type or paste what was said in the recording
              </span>
            </Label>
            <Textarea
              id="transcript"
              rows={5}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Enter the transcript of your audio recap…"
            />
            <p className="text-xs text-muted-foreground">
              The transcript is saved with the audio so you can search and
              review it later.
            </p>
          </div>
        )}

        {state === "done" && transcript && (
          <div className="space-y-1.5">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Transcript
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
