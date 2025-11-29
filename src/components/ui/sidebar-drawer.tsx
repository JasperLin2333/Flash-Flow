"use client"

import type { FlowRecord } from "@/types/flow";
import type { ChatHistory } from "@/services/chatHistoryAPI";

import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle, VisuallyHidden } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import {
  List,
  History,
  Zap,
  MessageSquare,
  BarChart3,
  Mail,
  FileText,
  X,
  Settings,
  ChevronDown,
  ArrowUpRight,
  User,
  Home as HomeIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

// Design System Constants - 统一色彩规范
const COLORS = {
  icon: {
    default: "text-gray-400",
    hover: "text-gray-600",
    active: "text-gray-700",
  },
  text: {
    primary: "text-gray-900",
    secondary: "text-gray-500",
    label: "text-gray-400",
  },
  bg: {
    hover: "hover:bg-gray-50",
  },
} as const;

const SIZES = {
  icon: "w-[18px] h-[18px]",
  text: {
    xs: "text-xs",
    sm: "text-[13px]",
  },
} as const;

function DockIcon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <button
      aria-label={title}
      className="group relative w-9 h-9 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 flex items-center justify-center transition-all duration-150 ease-out hover:scale-[1.05] active:scale-[0.95] shadow-xs"
    >
      {children}
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 translate-y-1 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 bg-gray-900 text-white text-[11px] rounded-md px-2 py-1 shadow-md whitespace-nowrap font-medium transition-all duration-150">{title}</span>
    </button>
  )
}

export default function SidebarDrawer({ hideTopIcons = false, primaryLabel = "Flow Box", onPrimaryClick, variant = "home", currentFlowId }: { hideTopIcons?: boolean; primaryLabel?: string; onPrimaryClick?: () => void; variant?: "home" | "app"; currentFlowId?: string }) {
  const router = useRouter()
  const [todayOpen, setTodayOpen] = useState(true)
  const [yesterdayOpen, setYesterdayOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [flows, setFlows] = useState<{ id: string; title: string; avatar: string; icon_kind?: string; icon_name?: string; icon_url?: string; created_at: string }[]>([])
  const [chatHistory, setChatHistory] = useState<{ id: string; title: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (variant === "app" && currentFlowId) {
      // Load chat history for app mode
      import("@/services/chatHistoryAPI").then(({ chatHistoryAPI }) => {
        // FIX: Use proper ChatHistory[] type instead of any[]
        chatHistoryAPI.getHistory(currentFlowId).then((data: ChatHistory[]) => {
          const mapped = data.map((chat: ChatHistory) => ({
            id: chat.id,
            // FIX: Add null protection - user_message could be empty/null
            title: (chat.user_message || '空消息').slice(0, 50) + (chat.user_message && chat.user_message.length > 50 ? '...' : ''),
            created_at: chat.created_at
          })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          setChatHistory(mapped)
          setLoading(false)
        })
      })
    } else {
      // Load flows for home mode
      import("@/services/flowAPI").then(({ flowAPI }) => {
        // FIX: Use proper FlowRecord[] type instead of any[]
        flowAPI.listFlows().then((data: FlowRecord[]) => {
          const mapped = data.map((f: FlowRecord) => ({
            id: f.id,
            // FIX: Add null protection - name could be null from database
            title: f.name || '未命名工作流',
            // FIX: Prevent crash on null.slice() by providing fallback
            avatar: (f.name || 'UN').slice(0, 2).toUpperCase(),
            icon_kind: f.icon_kind,
            icon_name: f.icon_name || undefined,
            icon_url: f.icon_url || undefined,
            created_at: f.created_at
          })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          setFlows(mapped)
          setLoading(false)
        })
      })
    }
  }, [variant, currentFlowId])

  const filteredFlows = flows.filter((f) => f.title.toLowerCase().includes(searchQuery.toLowerCase()))
  const filteredChats = chatHistory.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))

  // Group chats by date
  const todayChats = filteredChats.filter((c) => {
    const date = new Date(c.created_at)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000)
    return diffHours < 24
  })

  const yesterdayChats = filteredChats.filter((c) => {
    const date = new Date(c.created_at)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / 3600000)
    return diffHours >= 24 && diffHours < 48
  })

  const renderFlowIcon = (flow: typeof flows[0]) => {
    if (flow.icon_kind === 'image' && flow.icon_url) {
      return <img src={flow.icon_url} alt="icon" className="w-6 h-6 rounded-full object-cover" />;
    }
    // For emoji or default
    const display = flow.icon_name || flow.avatar || '📄';
    return <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-[11px] text-gray-700">{display}</div>;
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "刚刚"
    if (diffMins < 60) return `${diffMins} 分钟前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} 小时前`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return "昨天"
    return `${diffDays} 天前`
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className={`absolute left-8 rounded-full bg-black text-white hover:bg-black/90 active:bg-black/95 shadow-md font-semibold transition-all duration-150 ${variant === "app" ? "top-20 h-10 px-3 flex items-center gap-2" : "top-8 h-10 w-10 flex items-center justify-center"}`}
          aria-label={variant === "app" ? "历史记录" : "列表"}
          title={variant === "app" ? "历史记录" : "列表"}
        >
          {variant === "app" ? (
            <>
              <History className="w-4 h-4" />
              <span className="text-sm font-medium">历史记录</span>
            </>
          ) : (
            <List className="w-4 h-4" />
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="left" className="bg-white border-r border-gray-200 p-0 shadow-lg">
        {/* FIX: DialogContent requires DialogTitle for accessibility */}
        <VisuallyHidden>
          <SheetTitle>侧边栏导航</SheetTitle>
        </VisuallyHidden>
        <div className="h-full flex flex-col">
          <div className={`${variant === "app" ? "py-4" : "py-5"} px-4 flex items-center justify-between border-b border-gray-100`}>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-black" />
              <div className="text-[15px] font-bold tracking-tight text-gray-900">Flash Flow</div>
            </div>
            <div className="flex items-center gap-2">
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Close Sidebar"
                  title="Close Sidebar"
                >
                  <X className="w-[18px] h-[18px]" />
                </Button>
              </SheetClose>
            </div>
          </div>

          <div className="pt-3 pb-2 px-4">
            {!hideTopIcons && (
              <div className="grid grid-cols-5 gap-2">
                <DockIcon title="聊天">
                  <MessageSquare className={`${SIZES.icon} ${COLORS.icon.active}`} />
                </DockIcon>
                <DockIcon title="自动化">
                  <Zap className={`${SIZES.icon} ${COLORS.icon.active}`} />
                </DockIcon>
                <DockIcon title="分析">
                  <BarChart3 className={`${SIZES.icon} ${COLORS.icon.active}`} />
                </DockIcon>
                <DockIcon title="邮件">
                  <Mail className={`${SIZES.icon} ${COLORS.icon.active}`} />
                </DockIcon>
                <DockIcon title="文档">
                  <FileText className={`${SIZES.icon} ${COLORS.icon.active}`} />
                </DockIcon>
              </div>
            )}
            <div className={variant === "app" ? "mt-2 space-y-2" : "mt-3 space-y-2"}>
              <Button onClick={() => router.push("/")} className="w-full h-9 rounded-lg bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm font-medium transition-all duration-150 gap-2 justify-start px-3">
                <HomeIcon className="w-4 h-4 text-gray-500" />
                首页
              </Button>
              <Button onClick={onPrimaryClick || (() => router.push("/flows"))} className="w-full h-9 rounded-lg bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm font-medium transition-all duration-150 gap-2 justify-start px-3">
                <Zap className="w-4 h-4 text-gray-500" />
                {primaryLabel}
                <ArrowUpRight className="w-4 h-4 ml-auto text-gray-400" />
              </Button>
            </div>
          </div>
          <Separator className="bg-gray-100 h-px" />

          <div className="flex-1 overflow-y-auto py-4">
            <div className="px-4 mb-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索历史记录"
                className="h-9 rounded-lg border-gray-200"
              />
            </div>
            {variant === "app" ? (
              <div className="mb-2">
                {todayChats.length > 0 && (
                  <>
                    <button onClick={() => setTodayOpen((v) => !v)} className="w-full px-4 flex items-center justify-between text-left">
                      <p className="text-[11px] uppercase tracking-[0.05em] text-gray-400">今天</p>
                      <ChevronDown className={`w-4 h-4 ${COLORS.icon.default} transition-transform ${todayOpen ? "rotate-0" : "-rotate-90"}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {todayOpen && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }} className="mt-2 space-y-0.5">
                          {todayChats.map((chat, i) => (
                            <button key={`today-${chat.id}-${i}`} className={`w-full h-[34px] px-4 text-left ${COLORS.bg.hover} cursor-pointer flex items-center`}>
                              <span className={`flex-1 min-w-0 ${SIZES.text.sm} ${COLORS.text.primary} truncate`}>{chat.title}</span>
                              <span className={`flex-shrink-0 ml-3 ${SIZES.text.xs} ${COLORS.text.label} whitespace-nowrap`}>{formatTime(chat.created_at)}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
                {yesterdayChats.length > 0 && (
                  <div className="mt-3">
                    <button onClick={() => setYesterdayOpen((v) => !v)} className="w-full px-4 flex items-center justify-between text-left">
                      <p className="text-[11px] uppercase tracking-[0.05em] text-gray-400">昨天</p>
                      <ChevronDown className={`w-4 h-4 ${COLORS.icon.default} transition-transform ${yesterdayOpen ? "rotate-0" : "-rotate-90"}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {yesterdayOpen && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.12 }} className="mt-2 space-y-0.5">
                          {yesterdayChats.map((chat, i) => (
                            <button key={`y-${chat.id}-${i}`} className={`w-full h-[34px] px-4 text-left ${COLORS.bg.hover} cursor-pointer flex items-center`}>
                              <span className={`flex-1 min-w-0 ${SIZES.text.sm} ${COLORS.text.primary} truncate`}>{chat.title}</span>
                              <span className={`flex-shrink-0 ml-3 ${SIZES.text.xs} ${COLORS.text.label} whitespace-nowrap`}>昨天</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-4 space-y-0.5">
                {filteredFlows.map((f, i) => (
                  <button key={`all-${f.id}-${i}`} className={`w-full h-[34px] px-4 text-left ${COLORS.bg.hover} cursor-pointer flex items-center`} onClick={() => router.push(`/app?flowId=${f.id}`)}>
                    <div className="mr-2">{renderFlowIcon(f)}</div>
                    <span className={`flex-1 min-w-0 ${SIZES.text.sm} ${COLORS.text.primary} truncate`}>{f.title}</span>
                    <span className={`flex-shrink-0 ml-3 ${SIZES.text.xs} ${COLORS.text.label} whitespace-nowrap`}>{formatTime(f.created_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

              <div className="border-t border-gray-100 px-4 py-4">
            <Dialog>
              <DialogTrigger asChild>
                <button className="w-full flex items-center group rounded-lg hover:bg-gray-50 px-2 py-1.5 transition-all duration-150">
                  <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center transition-all duration-200 group-hover:ring-2 group-hover:ring-black/10 group-hover:scale-105 group-hover:shadow-sm">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                  <span className="ml-2.5 text-[13px] font-semibold text-gray-900 group-hover:text-black transition-colors duration-150">访客</span>
                  <div className="ml-auto flex items-center gap-3">
                    <Settings className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors duration-150" />
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm rounded-2xl border border-gray-200 shadow-xl">
                <DialogHeader>
                  <DialogTitle className="font-bold text-base">账号</DialogTitle>
                  <DialogDescription className="text-xs text-gray-500">管理个人资料和偏好设置</DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center border border-gray-300">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">访客</div>
                    <div className="text-xs text-gray-500">guest@example.com</div>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <button className="w-full h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-900 transition-colors duration-150">管理账号</button>
                  <button className="w-full h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-900 transition-colors duration-150">切换工作区</button>
                  <button className="w-full h-9 rounded-lg bg-red-600 text-white hover:bg-red-700 active:bg-red-800 text-sm font-semibold transition-all duration-150">退出登录</button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
