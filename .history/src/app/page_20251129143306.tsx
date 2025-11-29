"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import PromptBubble from "@/components/ui/prompt-bubble";
import HomeSidebar from "@/components/sidebar/home-sidebar";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const router = useRouter();

  const setSuggestion = (v: string) => {
    setPrompt(v);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center relative">
      <SidebarDrawer />

      <div className="w-full max-w-2xl px-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Zap className="w-7 h-7 text-black" />
          <h1
            className="text-5xl font-semibold tracking-tight text-black"
            style={{
              fontFamily: "Inter, SF Pro Display, system-ui, -apple-system, sans-serif",
            }}
          >
            Flash Flow
          </h1>
        </div>
        <p className="text-zinc-600 text-base text-center tracking-wide">No chat , just work .</p>

        <div className="mt-10">
          <PromptBubble
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => {
              if (!prompt.trim()) return;
              router.push(`/builder?initialPrompt=${encodeURIComponent(prompt)}`);
            }}
            placeholder="告诉我们你要做什么…"
          />
        </div>

        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <button
            className="px-4 py-2 rounded-full bg-gray-50 text-gray-600 text-xs tracking-wide hover:bg-gray-100"
            onClick={() => setSuggestion("我需要一个将英文翻译为中文的flow")}
          >
            我需要一个将英文翻译为中文的flow
          </button>
          <button
            className="px-4 py-2 rounded-full bg-gray-50 text-gray-600 text-xs tracking-wide hover:bg-gray-100"
            onClick={() => setSuggestion("我想要清洗表格中的脏数据")}
          >
            我想要清洗表格中的脏数据
          </button>
          <button
            className="px-4 py-2 rounded-full bg-gray-50 text-gray-600 text-xs tracking-wide hover:bg-gray-100"
            onClick={() => setSuggestion("我想聊天")}
          >
            我想聊天
          </button>
        </div>
      </div>
    </div>
  );
}
