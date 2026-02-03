"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Search, GitGraph, Settings, Loader2 } from "lucide-react";
import { useFlowStore, COPILOT_STEPS } from "@/store/flowStore";

const ICONS = [Sparkles, Search, GitGraph, Settings];

export default function CopilotOverlay() {
    const copilotStatus = useFlowStore((s) => s.copilotStatus);
    const copilotMode = useFlowStore((s) => s.copilotMode);
    const copilotStep = useFlowStore((s) => s.copilotStep);
    const backdrop = useFlowStore((s) => s.copilotBackdrop);

    if (copilotStatus === "idle" || copilotMode !== "classic") return null;

    const CurrentIcon = ICONS[copilotStep] || Loader2;

    return (
        <AnimatePresence>
            {copilotStatus === "thinking" && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`fixed inset-0 z-[100] flex items-center justify-center ${backdrop === "blank" ? "bg-white" : "bg-black/20 backdrop-blur-md"}`}
                >
                    <div className="flex flex-col items-center gap-6">
                        {/* Icon Circle */}
                        <motion.div
                            key={copilotStep}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className="w-16 h-16 rounded-2xl bg-white shadow-xl flex items-center justify-center"
                        >
                            <CurrentIcon className="w-8 h-8 text-black animate-pulse" />
                        </motion.div>

                        {/* Text */}
                        <motion.div
                            key={`text-${copilotStep}`}
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -10, opacity: 0 }}
                            className="flex flex-col items-center gap-2"
                        >
                            <span className="text-lg font-semibold text-black/80 tracking-wide">
                                {COPILOT_STEPS[copilotStep]?.text}
                            </span>
                            <div className="flex gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" />
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
