import type { FlowRecord } from "@/types/flow";
import { Zap, Globe, FileText, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

// ============ Constants ============
const LUCIDE_ICON_MAP: Record<string, React.JSX.Element> = {
  zap: <Zap className="w-5 h-5" />,
  globe: <Globe className="w-5 h-5" />,
  doc: <FileText className="w-5 h-5" />,
  link: <LinkIcon className="w-5 h-5" />,
};

const ICON_STYLES = {
  container: "w-full h-full rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center",
  emoji: "text-base",
  lucide: "text-gray-700",
};

/**
 * Render Flow Icon
 */
export function IconDisplay({
  flow,
  className,
}: {
  flow: FlowRecord;
  className?: string;
}) {
  const iconKind = flow.icon_kind || "emoji";
  const display = flow.icon_name || "📄";

  if (iconKind === "image" && flow.icon_url) {
    return (
      <img
        src={flow.icon_url}
        alt="flow icon"
        className={cn("w-full h-full rounded-lg object-cover", className)}
      />
    );
  }

  if (iconKind === "lucide" && flow.icon_name && LUCIDE_ICON_MAP[flow.icon_name]) {
    return (
      <div className={cn(ICON_STYLES.container, ICON_STYLES.lucide, className)}>
        {LUCIDE_ICON_MAP[flow.icon_name]}
      </div>
    );
  }

  return (
    <div className={cn(ICON_STYLES.container, ICON_STYLES.emoji, className)}>
      {display}
    </div>
  );
}
