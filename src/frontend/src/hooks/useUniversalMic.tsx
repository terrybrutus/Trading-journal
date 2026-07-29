import {
  type AiFieldValues,
  routeTranscriptToFields,
} from "@/lib/voiceRouting";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Universal mic state machine.
 *
 * One mic controls the whole app. While the user is on a form page (New Trade
 * or Journal entry), the page registers a `setFieldValue` callback that
 * receives AI-routed values. The mic itself only owns recording, transcript
 * accumulation, and the routing call — it never knows which form is active.
 */
export type MicStatus = "idle" | "recording" | "processing";

export interface UniversalMicContextValue {
  status: MicStatus;
  /** Live transcript accumulated across the current recording session. */
  transcript: string;
  /** Last error message, if any. Cleared on the next recording start. */
  error: string | null;
  /** Whether the mic is currently mounted/active on a form page. */
  enabled: boolean;
  /** Start or stop recording. No-op when not enabled. */
  toggle: () => void;
  /** Clear transcript and error, returning to idle. */
  reset: () => void;
  /**
   * Called by form pages to receive AI-routed field values. The page owns
   * how each field is applied (e.g. marking it as AI-suggested but unconfirmed).
   */
  registerFieldSink: (sink: (values: AiFieldValues) => void) => void;
  /** Unregister the active field sink (e.g. on page unmount). */
  unregisterFieldSink: () => void;
}

const UniversalMicContext = createContext<UniversalMicContextValue | null>(
  null,
);

export function useUniversalMicContext(): UniversalMicContextValue {
  const ctx = useContext(UniversalMicContext);
  if (!ctx) {
    throw new Error(
      "useUniversalMicContext must be used inside <UniversalMicProvider>",
    );
  }
  return ctx;
}

interface ProviderProps {
  children: ReactNode;
}

export function UniversalMicProvider({ children }: ProviderProps) {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const sinkRef = useRef<((values: AiFieldValues) => void) | null>(null);

  // Tear down any active recording on unmount.
  useEffect(() => {
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
      mediaRef.current = null;
    };
  }, []);

  const registerFieldSink = useCallback(
    (sink: (values: AiFieldValues) => void) => {
      sinkRef.current = sink;
      setEnabled(true);
    },
    [],
  );

  const unregisterFieldSink = useCallback(() => {
    sinkRef.current = null;
    setEnabled(false);
    // If a recording is in flight, stop it cleanly.
    stopRecording();
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    setStatus("idle");
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    stopStream(streamRef.current);
    streamRef.current = null;
    mediaRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript("");
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stopStream(streamRef.current);
        streamRef.current = null;
        mediaRef.current = null;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setStatus("idle");
          setError("No audio captured. Check your microphone and retry.");
          return;
        }
        setStatus("processing");
        try {
          const text = await transcribeBlob(blob);
          const accumulated = transcript
            ? `${transcript}\n${text}`.trim()
            : text.trim();
          setTranscript(accumulated);
          const routed = await routeTranscriptToFields(accumulated);
          if (sinkRef.current) sinkRef.current(routed);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Voice routing failed.";
          setError(msg);
        } finally {
          setStatus("idle");
        }
      };
      mr.start();
      setStatus("recording");
    } catch {
      setError("Microphone access denied or unavailable.");
      setStatus("idle");
    }
  }, [transcript]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (status === "recording") {
      stopRecording();
    } else if (status === "idle") {
      void startRecording();
    }
    // No toggle while processing — wait for the routing call to finish.
  }, [enabled, status, startRecording, stopRecording]);

  const value = useMemo<UniversalMicContextValue>(
    () => ({
      status,
      transcript,
      error,
      enabled,
      toggle,
      reset,
      registerFieldSink,
      unregisterFieldSink,
    }),
    [
      status,
      transcript,
      error,
      enabled,
      toggle,
      reset,
      registerFieldSink,
      unregisterFieldSink,
    ],
  );

  return (
    <UniversalMicContext.Provider value={value}>
      {children}
    </UniversalMicContext.Provider>
  );
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
}

/**
 * Transcribe an audio blob using OpenAI's Whisper API (cheap, free-tier
 * friendly). Falls back to an empty string if no API key is configured so the
 * routing step still runs (and surfaces a clear error).
 */
async function transcribeBlob(blob: Blob): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key configured. Add one in Settings to use voice routing.",
    );
  }
  const form = new FormData();
  form.append("file", blob, "recording.webm");
  form.append("model", "whisper-1");
  form.append("response_format", "text");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Transcription failed (${res.status}). ${text.slice(0, 200)}`,
    );
  }
  const text = await res.text();
  return text.trim();
}

function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("quantum.openaiApiKey");
  } catch {
    return null;
  }
}
