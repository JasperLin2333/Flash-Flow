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

/**
 * Render Flow Icon
 */
export function IconDisplay({
  flow,
  className,
  isCircular = false,
}: {
  flow: FlowRecord;
  className?: string;
  isCircular?: boolean;
}) {
  const iconKind = flow.icon_kind || "emoji";
  const display = flow.icon_name || "📄";

  const borderRadius = isCircular ? "rounded-full" : "rounded-lg";
  const containerBase = `w-full h-full ${borderRadius} bg-gray-100 flex items-center justify-center`;

  if (iconKind === "image" && flow.icon_url) {
    return (
      <img
        src={flow.icon_url}
        alt="flow icon"
        className={cn(`w-full h-full ${borderRadius} object-cover`, className)}
      />
    );
  }

  if (iconKind === "lucide" && flow.icon_name && LUCIDE_ICON_MAP[flow.icon_name]) {
    return (
      <div className={cn(containerBase, "text-gray-700", className)}>
        {LUCIDE_ICON_MAP[flow.icon_name]}
      </div>
    );
  }

  return (
    <div className={cn(containerBase, "text-xl", className)}>
      {display}
    </div>
  );
}
