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
              onClick={() => setSuggestion("我想要一个AI小伙伴")}
            >
              我想要一个AI小伙伴
            </button>
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("我想要清洗表格的脏数据")}
            >
              我想要清洗表格的脏数据
            </button>
            <button
              className="px-4 py-2 rounded-full bg-white text-gray-600 text-xs tracking-wide border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
              onClick={() => setSuggestion("我想锻炼面试技巧")}
            >
              我想锻炼面试技巧
            </button>
          </div>
        </div>
      </div>

      {/* ✅ BUG FIX: Auth Dialog for unauthenticated users */}
      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </div>
  );
}
