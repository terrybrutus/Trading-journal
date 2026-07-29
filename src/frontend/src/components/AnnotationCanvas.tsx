import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadConfig } from "@caffeineai/core-infrastructure";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { StorageClient } from "@caffeineai/object-storage";
import { HttpAgent } from "@icp-sdk/core/agent";
import { useCallback, useEffect, useRef, useState } from "react";

export interface AnnotationCanvasProps {
  imageUrl: string;
  onSave?: (annotatedStorageKey: string) => void | Promise<void>;
}

type Tool = "pen" | "rect" | "arrow" | "erase" | "text";

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
}

const COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#38bdf8",
  "#a78bfa",
  "#ffffff",
];

export function AnnotationCanvas({ imageUrl, onSave }: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [textEdit, setTextEdit] = useState<{
    x: number;
    y: number;
    value: string;
  } | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const { identity } = useInternetIdentity();

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const all = current ? [...strokes, current] : strokes;
    for (const s of all) {
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      if (s.tool === "pen" || s.tool === "erase") {
        if (s.tool === "erase") {
          ctx.globalCompositeOperation = "destination-out";
        } else {
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.beginPath();
        s.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      } else if (s.tool === "rect" && s.points.length >= 2) {
        const a = s.points[0];
        const b = s.points[s.points.length - 1];
        ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      } else if (s.tool === "arrow" && s.points.length >= 2) {
        const a = s.points[0];
        const b = s.points[s.points.length - 1];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const head = 12;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(
          b.x - head * Math.cos(angle - Math.PI / 6),
          b.y - head * Math.sin(angle - Math.PI / 6),
        );
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(
          b.x - head * Math.cos(angle + Math.PI / 6),
          b.y - head * Math.sin(angle + Math.PI / 6),
        );
        ctx.stroke();
      } else if (s.tool === "text" && s.text && s.points.length >= 1) {
        const fontSize = Math.max(14, s.width * 6);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(s.text, s.points[0].x, s.points[0].y);
      }
    }
  }, [strokes, current]);

  // Load image and size canvas
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxW = 900;
      const scale = Math.min(1, maxW / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      redraw();
    };
    img.src = imageUrl;
  }, [imageUrl, redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (tool === "text") {
      const p = pos(e);
      setTextEdit({ x: p.x, y: p.y, value: "" });
      return;
    }
    setDrawing(true);
    setCurrent({ tool, color, width, points: [pos(e)] });
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || !current) return;
    setCurrent({ ...current, points: [...current.points, pos(e)] });
  }

  function onUp() {
    if (!drawing || !current) return;
    setStrokes((s) => [...s, current]);
    setCurrent(null);
    setDrawing(false);
  }

  function undo() {
    setStrokes((s) => s.slice(0, -1));
  }

  function commitText() {
    if (!textEdit) return;
    const value = textEdit.value.trim();
    if (value) {
      setStrokes((s) => [
        ...s,
        {
          tool: "text",
          color,
          width,
          points: [{ x: textEdit.x, y: textEdit.y }],
          text: value,
        },
      ]);
    }
    setTextEdit(null);
  }

  useEffect(() => {
    if (textEdit && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [textEdit]);

  function clearAll() {
    setStrokes([]);
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploading(true);
    setSaved(false);
    try {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/png"),
      );
      if (!blob) throw new Error("Failed to render annotated image");
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
      const filename = `annotation-${Date.now()}.png`;
      const key = await client.putFile(bytes, undefined, "image/png", filename);
      setSaved(true);
      if (onSave) await onSave(key.hash);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium tracking-tight">
          Annotate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
            {(["pen", "rect", "arrow", "text", "erase"] as Tool[]).map((t) => (
              <Button
                key={t}
                type="button"
                size="sm"
                variant={tool === t ? "default" : "ghost"}
                onClick={() => setTool(t)}
                className="font-mono text-xs uppercase"
              >
                {t}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${
                  color === c ? "border-foreground" : "border-transparent"
                }`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
          <input
            type="range"
            min={1}
            max={12}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="h-1.5 w-24 accent-sky-500"
            aria-label="Stroke width"
          />
          <Button type="button" size="sm" variant="ghost" onClick={undo}>
            Undo
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            Clear
          </Button>
        </div>

        <div className="relative overflow-hidden rounded-md border border-border/60 bg-black/40">
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            className="block h-auto w-full touch-none"
          />
          {textEdit && (
            <input
              ref={textInputRef}
              type="text"
              value={textEdit.value}
              onChange={(e) =>
                setTextEdit({ ...textEdit, value: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitText();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setTextEdit(null);
                }
              }}
              onBlur={commitText}
              placeholder="Type text…"
              data-ocid="annotation.text_input"
              className="absolute rounded-sm border border-foreground/60 bg-background/90 px-1 py-0.5 text-sm text-foreground shadow-sm outline-none"
              style={{
                left: `${(textEdit.x / (canvasRef.current?.width ?? 1)) * 100}%`,
                top: `${(textEdit.y / (canvasRef.current?.height ?? 1)) * 100}%`,
                color,
                minWidth: "8rem",
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {saved
              ? "Saved to storage."
              : "Annotations overlay on the original image."}
          </span>
          <Button type="button" onClick={save} disabled={uploading}>
            {uploading ? "Uploading…" : "Save annotated image"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
