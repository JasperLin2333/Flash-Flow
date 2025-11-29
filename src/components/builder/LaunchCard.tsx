"use client";
import { motion, AnimatePresence } from "framer-motion";
import { useFlowStore } from "@/store/flowStore";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LaunchCard() {
    const executionStatus = useFlowStore((s) => s.executionStatus);
    const flowTitle = useFlowStore((s) => s.flowTitle);
    const currentFlowId = useFlowStore((s) => s.currentFlowId);
    const router = useRouter();

    // Show when execution is completed (simulating "Ready" state)
    const isReady = executionStatus === "completed";

    return (
        <AnimatePresence>
            {isReady && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="fixed bottom-8 right-8 z-10"
                >
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-150 w-64">
                        <div className="border border-gray-100 rounded-2xl px-6 py-5 flex flex-col gap-4 bg-white">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                                    应用已就绪
                                </div>
                                <div className="font-semibold text-sm text-gray-900 truncate">
                                    {flowTitle}
                                </div>
                            </div>
                            <Button
                                className="w-full bg-black hover:bg-black/85 active:bg-black/95 text-white rounded-lg h-9 text-xs font-semibold gap-2 transition-colors duration-150"
                                onClick={() => {
                                    if (currentFlowId) {
                                        router.push(`/app?flowId=${currentFlowId}`);
                                    } else {
                                        console.error("Cannot open app: missing flowId");
                                    }
                                }}
                            >
                                打开应用 <Rocket className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
