"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Logo from "./Logo.png";
import PromptBubble from "@/components/ui/prompt-bubble";
import HomeSidebar, { SIDEBAR_WIDTH } from "@/components/sidebar/home-sidebar";
import { UserNav } from "@/components/auth/UserNav";
import { useAuthStore } from "@/store/authStore";
import { AuthDialog } from "@/components/auth/AuthDialog";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  // ✅ BUG FIX: Add authentication state check
  const { isAuthenticated } = useAuthStore();
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const setSuggestion = (v: string) => {
    setPrompt(v);
  };

  // 🧹 REFACTOR: Extract flow generation logic with auth guard
  const handleGenerateFlow = () => {
    // DEFENSIVE: Guard clause for empty prompt
    if (!prompt.trim()) return;

    // ✅ BUG FIX: Prevent unauthenticated users from generating flows
    if (!isAuthenticated) {
      setShowAuthDialog(true);
      return;
    }

    // Proceed with navigation if authenticated
    router.push(`/builder?initialPrompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="min-h-screen bg-white flex relative">
      {/* User Navigation */}
      <div className="fixed top-4 right-4 z-50">
        <UserNav />
      </div>

      {/* Persistent Sidebar */}
      <HomeSidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />

      {/* Main Content - Shifts right when sidebar is open */}
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-screen transition-all duration-300 ease-out py-10"
        style={{
          marginLeft: sidebarOpen ? SIDEBAR_WIDTH : 0,
        }}
      >
        <div className="w-full max-w-3xl px-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-3 mb-6 -translate-x-7">
            <Image src={Logo} alt="Flash Flow Logo" width={60} height={60} className="w-20 h-20" />
            <h1
              className="text-5xl font-semibold tracking-tight text-black"
              style={{
                fontFamily: "Inter, SF Pro Display, system-ui, -apple-system, sans-serif",
              }}
            >
              Flash Flow
            </h1>
          </div>
          <p className="text-zinc-700 text-lg text-center tracking-wide font-light">想要什么，就做什么</p>

          <div className="mt-10 w-full">
            <PromptBubble
              value={prompt}
              onChange={setPrompt}
              onSubmit={handleGenerateFlow}
              placeholder="请告诉我们你想要什么…"
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("请创建一个内容转化工作流：支持输入一篇长文章的内容或链接。第一步，提取文章中的核心观点和干货信息；第二步，将内容改写为小红书笔记风格，要求标题具有“爆款感”和吸引力，正文口语化并适当添加 Emoji 表情；第三步，根据内容自动生成 5 个相关的热门 Hashtag 标签。")}
            >
              将长文章改写为小红书文案
            </button>
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("我需要一个竞品监控助手：当输入竞品名称或官网地址时，自动利用联网搜索功能抓取该品牌最近 7 天的新闻动态和社交媒体更新。请重点筛选出与“产品发布”和“营销活动”相关的信息，并汇总生成一份结构清晰的 Markdown 格式简报，包含“关键动态”、“策略分析”和“总结建议”三个部分。")}
            >
              抓取竞品动态并生成分析报告
            </button>
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("设计一个文档结构化处理流程：接收用户上传的 PDF 文件，读取并理解全文内容。请智能识别文档的章节层级（如一级标题、二级要点），将其提炼并转化为层级分明的 Markdown 列表格式（或 OPML 格式）。输出结果要求逻辑清晰，能够直接用于生成思维导图。")}
            >
              把 PDF 文档整理成思维导图
            </button>
          </div>
        </div>
      </div>

      {/* ✅ BUG FIX: Auth Dialog for unauthenticated users */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}
