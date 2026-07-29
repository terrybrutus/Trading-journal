import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useGenerateApiToken,
  useHasApiToken,
  useRegenerateApiToken,
} from "@/hooks/useSettings";
import {
  OPENAI_API_KEY_STORAGE,
  VOICE_ROUTING_MODEL,
  getOpenAiApiKey,
  setOpenAiApiKey,
} from "@/lib/voiceRouting";
import { Check, ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";

const OPENAI_KEY_URL = "https://platform.openai.com/api-keys";

export function Settings() {
  // --- API token management (unchanged) ---
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: hasToken, isLoading: checkingToken } = useHasApiToken();
  const generate = useGenerateApiToken();
  const regenerate = useRegenerateApiToken();

  const token: string | undefined =
    generate.data ?? regenerate.data ?? undefined;

  const handleGenerate = () => {
    generate.mutate();
    setRevealed(true);
    setCopied(false);
  };

  const handleRegenerate = () => {
    regenerate.mutate();
    setRevealed(true);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const endpointUrl = `${window.location.origin}/api/capture`;

  // --- OpenAI API key (voice-to-field routing) ---
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getOpenAiApiKey();
    if (stored) setApiKey(stored);
  }, []);

  const handleSaveKey = () => {
    setKeyError(null);
    try {
      setOpenAiApiKey(apiKey);
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    } catch {
      setKeyError("Could not save the API key to this browser.");
    }
  };

  const handleClearKey = () => {
    setApiKey("");
    setKeyError(null);
    try {
      setOpenAiApiKey(null);
      setKeySaved(false);
    } catch {
      setKeyError("Could not clear the API key from this browser.");
    }
  };

  const hasStoredKey = (() => {
    try {
      return Boolean(window.localStorage.getItem(OPENAI_API_KEY_STORAGE));
    } catch {
      return false;
    }
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your Chrome extension API token, voice routing key, and capture
          endpoint.
        </p>
      </div>

      <Card data-ocid="settings.api_token.card">
        <CardHeader>
          <CardTitle>API Token</CardTitle>
          <CardDescription>
            Use this token to authenticate captures sent from your Chrome
            extension. Keep it private — anyone with this token can post
            captures to your journal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            {checkingToken ? (
              <span className="text-muted-foreground">Checking…</span>
            ) : hasToken ? (
              <span className="font-medium text-emerald-500">Token active</span>
            ) : (
              <span className="font-medium text-amber-500">
                No token issued
              </span>
            )}
          </div>

          {token && revealed ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={token}
                  className="font-mono text-xs"
                  aria-label="API token"
                  data-ocid="settings.api_token.input"
                />
                <Button
                  type="button"
                  onClick={handleCopy}
                  variant="secondary"
                  data-ocid="settings.api_token.copy_button"
                >
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy this token now. For security, it is only shown once after
                generation.
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              {hasToken ? (
                <Button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={regenerate.isPending}
                  data-ocid="settings.api_token.regenerate_button"
                >
                  {regenerate.isPending ? "Regenerating…" : "Regenerate token"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generate.isPending}
                  data-ocid="settings.api_token.generate_button"
                >
                  {generate.isPending ? "Generating…" : "Generate token"}
                </Button>
              )}
            </div>
          )}

          {(generate.isError || regenerate.isError) && (
            <p className="text-sm text-destructive">
              Failed to issue token. Please try again.
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-ocid="settings.openai_key.card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            OpenAI API Key
          </CardTitle>
          <CardDescription>
            Powers the universal mic&apos;s voice-to-field routing. Your spoken
            trade notes are transcribed with{" "}
            <code className="font-mono">whisper-1</code> and routed to{" "}
            <code className="font-mono">{VOICE_ROUTING_MODEL}</code> to extract
            trade-form fields. Use a free or low-cost OpenAI key. The key is
            stored only in this browser and never sent anywhere except OpenAI.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="openai-api-key"
              className="text-xs uppercase tracking-wide text-muted-foreground"
            >
              API key
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  id="openai-api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setKeySaved(false);
                    setKeyError(null);
                  }}
                  placeholder="sk-…"
                  className="font-mono text-xs pr-10"
                  autoComplete="off"
                  spellCheck={false}
                  data-ocid="settings.openai_key.input"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                  onClick={() => setShowKey((s) => !s)}
                  aria-label={showKey ? "Hide API key" : "Show API key"}
                  data-ocid="settings.openai_key.toggle_visibility_button"
                >
                  {showKey ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
              <Button
                type="button"
                onClick={handleSaveKey}
                disabled={apiKey.trim().length === 0}
                data-ocid="settings.openai_key.save_button"
              >
                {keySaved ? (
                  <>
                    <Check className="size-4" /> Saved
                  </>
                ) : (
                  "Save"
                )}
              </Button>
              {hasStoredKey && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClearKey}
                  data-ocid="settings.openai_key.clear_button"
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Don&apos;t have one?{" "}
              <a
                href={OPENAI_KEY_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Create a key at OpenAI
                <ExternalLink className="size-3" />
              </a>
              . The free tier is enough for occasional use.
            </p>
          </div>

          {keyError && (
            <p className="text-sm text-destructive" role="alert">
              {keyError}
            </p>
          )}

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Routing status:</span>
            {hasStoredKey ? (
              <span className="font-medium text-emerald-500">
                Key configured
              </span>
            ) : (
              <span className="font-medium text-amber-500">
                No key — voice routing unavailable
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-ocid="settings.extension.card">
        <CardHeader>
          <CardTitle>Chrome Extension</CardTitle>
          <CardDescription>
            A browser extension that lives on TradingView and turns a finished
            trade into a draft journal entry — automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              What it captures
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                A screenshot of your TradingView chart at the moment you log the
                trade.
              </li>
              <li>The ticker symbol shown on the chart.</li>
              <li>
                The trade direction, read from your buy or sell action (long or
                short).
              </li>
              <li>The entry price and exit price of the trade.</li>
              <li>The position size in shares or contracts.</li>
              <li>The realized profit or loss for the trade.</li>
              <li>Your post-trade reflection notes, if you add any.</li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              What it does
            </div>
            <p className="text-muted-foreground">
              When you trigger the extension on a TradingView chart, it gathers
              the details above and sends them to Bias Journal using your API
              token. Bias Journal creates a{" "}
              <span className="font-medium text-foreground">draft trade</span>{" "}
              pre-filled with the symbol, direction, prices, size, realized
              P&amp;L, and reflection notes. The draft is yours to review and
              edit before it becomes a permanent journal entry — nothing is
              committed until you save it.
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Repo location
            </div>
            <p className="text-muted-foreground">
              The unpacked extension source lives in{" "}
              <code className="font-mono">extension/</code> in this GitHub
              export. Load that folder in Chrome on Windows or macOS.
            </p>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Endpoint URL
            </div>
            <Input
              readOnly
              value={endpointUrl}
              className="font-mono text-xs"
              data-ocid="settings.extension.endpoint_input"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Method
            </div>
            <div className="font-mono text-xs">POST</div>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Headers
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
              {`Authorization: Bearer <your-api-token>
Content-Type: application/json`}
            </pre>
          </div>

          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Token format
            </div>
            <p className="text-xs text-muted-foreground">
              An opaque, URL-safe string issued by the backend. Treat it as a
              password. Regenerating the token invalidates the previous one
              immediately.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Settings;
