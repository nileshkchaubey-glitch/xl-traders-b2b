import { Sparkles } from "lucide-react";
import SmartPastePanel from "../components/ai/SmartPastePanel";
import ChatAssistPanel from "../components/ai/ChatAssistPanel";

export default function AiWorkspacePage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500" />
          <h1 className="text-xl font-bold text-slate-900">AI Workspace</h1>
        </div>
        <p className="text-slate-400 text-xs mt-0.5">
          Extract products from pasted text, and get quick copy/idea help.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <SmartPastePanel />
        <ChatAssistPanel />
      </div>
    </div>
  );
}
