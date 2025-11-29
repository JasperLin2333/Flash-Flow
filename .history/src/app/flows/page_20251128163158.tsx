"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Home, Search as SearchIcon, Loader2 } from "lucide-react";
import SidebarDrawer from "@/components/ui/sidebar-drawer";
import { flowAPI } from "@/services/flowAPI";
import type { FlowRecord } from "@/types/flow";
import FlowCard from "@/components/flows/FlowCard";
import { Input } from "@/components/ui/input";

export default function FlowsPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<FlowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    try {
      const newFlow = await flowAPI.createFlow(
        "Untitled Flow",
        { nodes: [], edges: [] },
        "anonymous",
        "New workflow"
      );
      router.push(`/builder?flowId=${newFlow.id}`);
    } catch (err) {
      console.error("Failed to create flow:", err);
      alert("Failed to create flow. Please try again.");
    }
  };

  const filtered = useMemo(() => flows.filter(f => (f.name?.toLowerCase().includes(query.toLowerCase()) || (f.description || "").toLowerCase().includes(query.toLowerCase()))), [flows, query]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[22px] font-semibold text-black">Flow Box</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索 flow" className="w-[240px] pl-8" />
              <SearchIcon className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
            </div>
            <Button className="bg-gray-100 text-gray-700 hover:bg-gray-200 gap-2 rounded-lg px-6 h-11" onClick={handleCreateFlow}>
              <Plus className="w-4 h-4" /> 新建 Flow
            </Button>
            <Button className="bg-black text-white hover:bg-black/90 gap-2 rounded-lg px-6 h-11" onClick={() => router.push("/")}>
              <Home className="w-4 h-4" /> 首页
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
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
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">还没有工作流</h3>
            <p className="text-gray-500 text-sm mb-6">创建你的第一个 AI 工作流</p>
            <Button
              onClick={handleCreateFlow}
              className="bg-black text-white hover:bg-black/90 gap-2"
            >
              <Plus className="w-4 h-4" />
              创建 Flow
            </Button>
          </div>
        )}

        {!isLoading && !error && flows.length > 0 && (
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
        )}
      </div>
    </div>
  );
}
