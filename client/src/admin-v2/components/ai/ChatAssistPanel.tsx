import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Send, Loader2, MessageSquare, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { chatAssist, ChatMessage } from "@/lib/aiService";

const SUGGESTIONS = [
  "Write a B2B description for 500ml round food container",
  "Suggest 5 category names for cleaning supplies",
  "Give a short tagline for biodegradable cutlery",
];

// Ad-hoc assistant panel — single conversation against aiService.chatAssist.
// Deliberately does not attach the product DB (see aiService note); it's a
// copy/idea helper for the owner, not a data-query tool.
export default function ChatAssistPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const reply = await chatAssist(next);
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Assistant unavailable");
      // Roll back the user message so they can retry cleanly.
      setMessages(messages);
      setInput(trimmed);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[560px]">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
        <MessageSquare className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-800">Assistant</h2>
        <span className="text-[11px] text-slate-400">
          copy &amp; idea helper
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Ask for product copy, category ideas, or phrasing. Try:
            </p>
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {m.role === "assistant" && (
                <div className="w-6 h-6 shrink-0 rounded-full bg-slate-100 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-slate-500" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-red-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
              {m.role === "user" && (
                <div className="w-6 h-6 shrink-0 rounded-full bg-red-100 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-red-600" />
                </div>
              )}
            </div>
          ))
        )}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask the assistant… (Enter to send, Shift+Enter for newline)"
            className="min-h-[44px] max-h-32 text-sm resize-none"
            disabled={sending}
          />
          <Button
            size="sm"
            disabled={sending || !input.trim()}
            onClick={() => send(input)}
            className="h-11 px-3 bg-red-600 hover:bg-red-700 text-white shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
