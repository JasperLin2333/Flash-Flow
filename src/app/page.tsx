"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Logo from "./Logo.png";
import PromptBubble from "@/components/ui/prompt-bubble";
import HomeSidebar, { SIDEBAR_WIDTH } from "@/components/sidebar/home-sidebar";
import { UserNav } from "@/components/auth/UserNav";
import { useAuthStore } from "@/store/authStore";
import { AuthDialog } from "@/components/auth/AuthDialog";
import { userProfileAPI } from "@/services/userProfileAPI";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  // ✅ BUG FIX: Add authentication state check
  const { isAuthenticated, user, isLoading: authLoading } = useAuthStore();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  // ✅ NEW: Generation mode toggle (quick = classic loading, agent = thinking chain)
  const [generationMode, setGenerationMode] = useState<"quick" | "agent">("quick");
  // Clarification toggle (only effective in Agent mode)
  const [enableClarification, setEnableClarification] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load user preferences from local storage on mount for immediate UI feedback
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("generationMode") as "quick" | "agent";
      if (savedMode) setGenerationMode(savedMode);

      const savedClarification = localStorage.getItem("enableClarification");
      if (savedClarification) setEnableClarification(savedClarification === "true");
    } catch (e) {
      console.warn("[Home] Failed to load local preferences:", e);
    }
  }, []);

  // Load user preferences from database on mount
  useEffect(() => {
    // Wait for auth to finish initializing before making decisions
    if (authLoading) {
      return;
    }

    // If not authenticated after auth loaded, mark as loaded immediately (use defaults)
    if (!isAuthenticated) {
      setPreferencesLoaded(true);
      return;
    }

    if (user?.id && !preferencesLoaded) {
      userProfileAPI.getPreferences(user.id).then((prefs) => {
        if (prefs?.enableClarification !== undefined) {
          setEnableClarification(prefs.enableClarification);
        }
        if (prefs?.generationMode !== undefined) {
          setGenerationMode(prefs.generationMode);
        }
        setPreferencesLoaded(true);
      }).catch((err) => {
        console.warn("[Home] Failed to load preferences:", err);
        setPreferencesLoaded(true);
      });
    }
  }, [authLoading, isAuthenticated, user?.id, preferencesLoaded]);


  // Handle toggling clarification with persistence
  const handleToggleClarification = (enabled: boolean) => {
    setEnableClarification(enabled);
    localStorage.setItem("enableClarification", String(enabled));

    // Persist to database if user is logged in
    if (isAuthenticated && user?.id) {
      userProfileAPI.updatePreferences(user.id, { enableClarification: enabled }).catch((err) => {
        console.warn("[Home] Failed to save preferences:", err);
      });
    }
  };

  // ✅ FIX: When switching mode, persist and auto-disable clarification if quick mode
  // ✅ FIX: When switching mode, persist and auto-disable clarification if quick mode
  const handleModeChange = (mode: "quick" | "agent") => {
    setGenerationMode(mode);
    localStorage.setItem("generationMode", mode);

    const newClarification = mode === "quick" ? false : enableClarification;
    if (mode === "quick") {
      setEnableClarification(false);
      localStorage.setItem("enableClarification", "false");
    }
    // Persist to database if user is logged in
    if (isAuthenticated && user?.id) {
      userProfileAPI.updatePreferences(user.id, {
        generationMode: mode,
        enableClarification: newClarification
      }).catch((err) => {
        console.warn("[Home] Failed to save preferences:", err);
      });
    }
  };

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

    // 🔥 修复返回问题：使用replace避免路由历史污染
    const modeParam = generationMode === "agent" ? "&mode=agent" : "";
    const clarificationParam = enableClarification ? "&enableClarification=true" : "";

    // A/B Testing: Forward experiment parameter to builder page
    const experimentParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('experiment') : null;
    const experimentQuery = experimentParam ? `&experiment=${experimentParam}` : "";

    // 直接导航到带参数的页面，避免产生空白页面历史记录
    router.push(`/builder?initialPrompt=${encodeURIComponent(prompt)}${modeParam}${clarificationParam}${experimentQuery}`);
  };

  return (
    <div className="min-h-screen bg-white flex relative">
      {/* User Navigation */}
      <div className="fixed top-4 right-4 z-50">
        <UserNav />
      </div>

      {/* Persistent Sidebar */}
      <Suspense fallback={<div />}>
        <HomeSidebar isOpen={sidebarOpen} onToggle={setSidebarOpen} />
      </Suspense>

      {/* Main Content - Shifts right when sidebar is open */}
      <div
        className="flex-1 flex flex-col items-center justify-center min-h-screen transition-all duration-300 ease-out py-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both"
        style={{
          marginLeft: sidebarOpen ? SIDEBAR_WIDTH : 0,
        }}
      >
        <div className="w-full max-w-3xl px-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-4 mb-8 -translate-x-4">
            <Image src={Logo} alt="Flash Flow Logo" width={72} height={72} className="w-[72px] h-[72px] drop-shadow-sm" priority />
            <h1
              className="text-6xl font-bold tracking-tight bg-clip-text text-transparent pb-2"
              style={{
                fontFamily: "Inter, SF Pro Display, system-ui, -apple-system, sans-serif",
                backgroundImage: "var(--brand-gradient)",
              }}
            >
              Flash Flow
            </h1>
          </div>
          <p className="text-gray-500 text-lg text-center tracking-wide font-normal mb-10">一句话，构建你的专属 AI 智能体</p>

          <div className="w-full transform transition-all duration-500 hover:scale-[1.01]">
            <PromptBubble
              value={prompt}
              onChange={setPrompt}
              onSubmit={handleGenerateFlow}
              placeholder="输入你的想法，AI 自动生成工作流..."
              enableClarification={enableClarification}
              onToggleClarification={generationMode === "agent" ? handleToggleClarification : undefined}
              generationMode={generationMode}
              onGenerationModeChange={handleModeChange}
            />
          </div>



          <div className="mt-12 flex flex-wrap gap-3 justify-center max-w-2xl">
            <button
              className="group px-5 py-3 rounded-2xl bg-white/80 backdrop-blur-sm text-gray-600 text-xs font-medium tracking-wide border border-gray-200/60 shadow-sm hover:shadow-lg hover:border-[#60B4FF]/50 hover:-translate-y-0.5 hover:text-[#4A9FE8] transition-all duration-300"
              onClick={() => setSuggestion("请帮我做一个智能旅游助手：支持用户输入目的地和天数（例如‘重庆 3天’）。第一步，联网搜索当地的必吃美食和热门景点；第二步，智能规划一条不走回头路的特种兵行程路线；第三步，输出详细的每日时间表和交通建议。")}
            >
              <span className="mr-1.5 grayscale group-hover:grayscale-0 transition-all duration-300">✈️</span> 生成特种兵旅游助手
            </button>
            <button
              className="group px-5 py-3 rounded-2xl bg-white/80 backdrop-blur-sm text-gray-600 text-xs font-medium tracking-wide border border-gray-200/60 shadow-sm hover:shadow-lg hover:border-[#60B4FF]/50 hover:-translate-y-0.5 hover:text-[#4A9FE8] transition-all duration-300"
              onClick={() => setSuggestion("我想做一个小红书图文生产线：输入任意主题。1. 让 AI 扮演资深博主，撰写 5 个 emoji 风格的爆款标题和正文；2. 并行调用绘图模型，生成 2 张高颜值的封面图；3. 最后将文案和图片组合输出，方便我直接复制发布。")}
            >
              <span className="mr-1.5 grayscale group-hover:grayscale-0 transition-all duration-300">🎨</span> 打造小红书爆款神器
            </button>
            <button
              className="group px-5 py-3 rounded-2xl bg-white/80 backdrop-blur-sm text-gray-600 text-xs font-medium tracking-wide border border-gray-200/60 shadow-sm hover:shadow-lg hover:border-[#60B4FF]/50 hover:-translate-y-0.5 hover:text-[#4A9FE8] transition-all duration-300"
              onClick={() => setSuggestion("设计一个“梦境画师”工作流：接收用户描述的梦境内容。1. 使用心理学知识分析梦境背后的潜意识含义；2. 调用绘画 AI 将梦境画面具象化，生成超现实主义风格的画作；3. 最终生成一张包含心理分析和画面的精美卡片。")}
            >
              <span className="mr-1.5 grayscale group-hover:grayscale-0 transition-all duration-300">🔮</span> 创建梦境分析师
            </button>
          </div>
        </div>
      </div>

      {/* ✅ BUG FIX: Auth Dialog for unauthenticated users */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}
