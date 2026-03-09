import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ChatRole = "user" | "assistant";

type ChatTurn = {
  role: ChatRole;
  content: string;
};

function getRagApiBases(): string[] {
  const env = (import.meta as any).env || {};

  // Prefer an explicit Python/FastAPI base if provided.
  // (Many parts of this repo also use VITE_API_URL for the Node backend.)
  const preferred =
    env.VITE_RAG_API_URL ||
    env.VITE_PY_API_URL ||
    env.VITE_FASTAPI_URL ||
    "";

  const generic = env.VITE_API_URL || env.VITE_API_BASE || "";

  // Always keep a stable local FastAPI fallback.
  const fallback = "http://127.0.0.1:8000";

  const bases = [preferred, generic, fallback]
    .map((s: string) => String(s || "").trim())
    .filter(Boolean)
    .map((s: string) => s.replace(/\/$/, ""));

  // De-dupe
  return Array.from(new Set(bases));
}

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const endpoints = useMemo(
    () => getRagApiBases().map((b) => `${b}/rag/chat`),
    []
  );

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => endRef.current?.scrollIntoView({ block: "end" }), 0);
    return () => window.clearTimeout(t);
  }, [open, turns.length]);

  const send = async () => {
    const message = draft.trim();
    if (!message || sending) return;

    setDraft("");
    setSending(true);

    const nextTurns = [...turns, { role: "user", content: message } as ChatTurn];
    setTurns(nextTurns);

    try {
      const postOnce = async (url: string) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: nextTurns,
            client_context: { pathname: window.location.pathname },
          }),
        });

        // Many servers return an HTML error page; keep it readable.
        const contentType = res.headers.get("content-type") || "";
        const raw = await res.text();

        if (!res.ok) {
          const trimmed = raw?.trim?.() || "";
          throw new Error(trimmed || `HTTP ${res.status}`);
        }

        if (!contentType.includes("application/json")) {
          const trimmed = raw?.trim?.() || "";
          throw new Error(
            trimmed
              ? `Unexpected response (not JSON): ${trimmed}`
              : "Unexpected response (not JSON)"
          );
        }

        return JSON.parse(raw);
      };

      let data: any = null;
      let lastErr: any = null;
      for (const url of endpoints) {
        try {
          data = await postOnce(url);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
        }
      }
      if (!data) throw lastErr || new Error("Chat request failed");

      const reply = String(data?.response || "").trim();

      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            reply ||
            "I didn’t get a response back. Please try again.",
        },
      ]);
    } catch (e: any) {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Chatbot is unavailable right now. " +
            (e?.message ? `(${e.message})` : ""),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <TooltipProvider>
      {/* Floating button */}
      <div className="fixed bottom-5 right-5 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="h-12 w-12 rounded-full p-0 shadow-lg"
              aria-label={open ? "Close chatbot" : "Open chatbot"}
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">RFPilot Assistant</TooltipContent>
        </Tooltip>
      </div>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)]">
          <Card className="border-border/60 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  RFPilot Assistant
                </div>
                <div className="text-xs text-muted-foreground">
                  Ask about RFPs, SKUs, pricing, proposals, or app usage.
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[360px]">
              <div className="px-3 py-3 space-y-3">
                {turns.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Try: “What does the pricing page show?” or “Summarize the current RFP.”
                  </div>
                ) : (
                  turns.map((t, idx) => {
                    const isUser = t.role === "user";
                    return (
                      <div
                        key={idx}
                        className={
                          "flex " + (isUser ? "justify-end" : "justify-start")
                        }
                      >
                        <div
                          className={
                            "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap " +
                            (isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground")
                          }
                        >
                          {t.content}
                        </div>
                      </div>
                    );
                  })
                )}
                {sending && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-muted text-muted-foreground">
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border/60 p-3">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask a question…"
                  disabled={sending}
                />
                <Button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="shrink-0"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </TooltipProvider>
  );
}
