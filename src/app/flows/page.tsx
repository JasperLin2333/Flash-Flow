"use client";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Home, Search as SearchIcon, Loader2 } from "lucide-react";
import { flowAPI } from "@/services/flowAPI";
import type { FlowRecord } from "@/types/flow";
import FlowCard from "@/components/flows/FlowCard";
import { Input } from "@/components/ui/input";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useFlowStore } from "@/store/flowStore";
import { toast } from "@/hooks/use-toast";

function FlowsPageContent() {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await flowAPI.listFlows();
      setFlows(data);
    } catch (err) {
      console.error("Failed to load flows:", err);
      setError(err instanceof Error ? err.message : "Failed to load flows");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    if (isCreating) return; // 防止重复点击

    try {
      setIsCreating(true);

      // Reset all visual state immediately
      const { setNodes, setEdges, setFlowTitle, setFlowIcon, setCurrentFlowId } = useFlowStore.getState();
      setNodes([]);
      setEdges([]);
      setFlowTitle("Untitled Flow");
      setFlowIcon("emoji", "⚡", undefined);

      // Then create the flow in the database
      const newFlow = await flowAPI.createFlow(
        "Untitled Flow",
        { nodes: [], edges: [] }
      );

      // CRITICAL FIX: Set currentFlowId immediately after creation
      // This prevents scheduleSave from creating a duplicate flow when user modifies title
      setCurrentFlowId(newFlow.id);

      // Navigate to the builder with the new flow ID
      router.push(`/builder?flowId=${newFlow.id}`);
    } catch (err) {
      console.error("Failed to create flow:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);

      // 区分错误类型
      if (errorMsg.includes("未登录") || errorMsg.includes("not authenticated")) {
        toast({
          title: "请先登录",
          description: "登录后即可创建工作流",
          variant: "destructive",
        });
      } else if (errorMsg.includes("network") || errorMsg.includes("fetch")) {
        toast({
          title: "网络连接失败",
          description: "请检查网络后重试",
          variant: "destructive",
        });
      } else {
        toast({
          title: "创建失败",
          description: "无法创建工作流，请稍后重试",
          variant: "destructive",
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const filtered = useMemo(() => flows.filter(f => (f.name?.toLowerCase().includes(query.toLowerCase()) || (f.description || "").toLowerCase().includes(query.toLowerCase()))), [flows, query]);


  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[22px] font-semibold text-black">我的智能体</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="查找我的智能体..." className="w-[240px] pl-8 shadow-sm" />
              <SearchIcon className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
            <Button className="bg-gray-100 text-gray-700 hover:bg-gray-200 gap-2 rounded-lg px-6 h-11 disabled:opacity-50" onClick={handleCreateFlow} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isCreating ? "创建中..." : "创建新智能体"}
            </Button>
            <Button className="bg-black text-white hover:bg-black/90 gap-2 rounded-lg px-6 h-11" onClick={() => router.push("/")}>
              <Home className="w-4 h-4" /> 返回首页
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 shadow-sm">
            <p className="text-red-600 text-sm">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadFlows}
              className="mt-2 text-red-600 hover:text-red-700"
            >
              重试
            </Button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">加载中...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && flows.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-white border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">还没有创建任何智能体</h3>
            <p className="text-gray-500 text-sm mb-6">打造你的第一个 AI 智能体</p>
            <Button
              onClick={handleCreateFlow}
              className="bg-black text-white hover:bg-black/90 gap-2"
            >
              <Plus className="w-4 h-4" />
              创建新智能体
            </Button>
          </div>
        )}

        {!isLoading && !error && flows.length > 0 && (
          filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-x-8 gap-y-10">
              {filtered.map((flow) => (
                <FlowCard
                  key={flow.id}
                  flow={flow}
                  onUpdated={(updated) => setFlows((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))}
                  onDeleted={(id) => setFlows((prev) => prev.filter((f) => f.id !== id))}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <SearchIcon className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">未找到匹配 &quot;{query}&quot; 的结果</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuery("")}
                className="mt-3 text-gray-600 hover:text-gray-900"
              >
                清除搜索
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// 统一的加载组件
function LoadingScreen() {
  return (
    <div className="h-screen w-full bg-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}

export default function FlowsPageWrapper() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ProtectedRoute>
        <FlowsPageContent />
      </ProtectedRoute>
    </Suspense>
  );
}
