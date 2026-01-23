"use client";
import { useState, useEffect, useCallback } from "react";
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
  const handleToggleClarification = useCallback((enabled: boolean) => {
    setEnableClarification(enabled);
    localStorage.setItem("enableClarification", String(enabled));

    // Persist to database if user is logged in
    if (isAuthenticated && user?.id) {
      userProfileAPI.updatePreferences(user.id, { enableClarification: enabled }).catch((err) => {
        console.warn("[Home] Failed to save preferences:", err);
      });
    }
  }, [isAuthenticated, user?.id]);

  // ✅ FIX: When switching mode, persist and auto-disable clarification if quick mode
  // ✅ FIX: When switching mode, persist and auto-disable clarification if quick mode
  const handleModeChange = useCallback((mode: "quick" | "agent") => {
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
  }, [isAuthenticated, user?.id, enableClarification]);

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
    // ✅ NEW: Append mode=agent if agent mode is selected
    const modeParam = generationMode === "agent" ? "&mode=agent" : "";
    const clarificationParam = enableClarification ? "&enableClarification=true" : "";
    router.push(`/builder?initialPrompt=${encodeURIComponent(prompt)}${modeParam}${clarificationParam}`);
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
              className="text-5xl font-semibold tracking-tight bg-clip-text text-transparent"
              style={{
                fontFamily: "Inter, SF Pro Display, system-ui, -apple-system, sans-serif",
                backgroundImage: "var(--brand-gradient)",
              }}
            >
              Flash Flow
            </h1>
          </div>
          <p className="text-gray-700 text-lg text-center tracking-wide font-light">想要什么，就做什么</p>

          <div className="mt-10 w-full">
            <PromptBubble
              value={prompt}
              onChange={setPrompt}
              onSubmit={handleGenerateFlow}
              placeholder="有想法，尽管说~"
              enableClarification={enableClarification}
              onToggleClarification={generationMode === "agent" ? handleToggleClarification : undefined}
              generationMode={generationMode}
              onGenerationModeChange={handleModeChange}
            />
          </div>



          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("请帮我做一个智能旅游助手：支持用户输入目的地和天数（例如‘重庆 3天’）。第一步，联网搜索当地的必吃美食和热门景点；第二步，智能规划一条不走回头路的特种兵行程路线；第三步，输出详细的每日时间表和交通建议。")}
            >
              ✈️ 搭建特种兵旅游规划助手
            </button>
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("我想做一个小红书图文生产线：输入任意主题。1. 让 AI 扮演资深博主，撰写 5 个 emoji 风格的爆款标题和正文；2. 并行调用绘图模型，生成 2 张高颜值的封面图；3. 最后将文案和图片组合输出，方便我直接复制发布。")}
            >
              🎨 制作小红书爆款图文生成器
            </button>
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("设计一个“梦境画师”工作流：接收用户描述的梦境内容。1. 使用心理学知识分析梦境背后的潜意识含义；2. 调用绘画 AI 将梦境画面具象化，生成超现实主义风格的画作；3. 最终生成一张包含心理分析和画面的精美卡片。")}
            >
              🔮 创建一个梦境可视化分析师
            </button>
          </div>
        </div>
      </div>

      {/* ✅ BUG FIX: Auth Dialog for unauthenticated users */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}
