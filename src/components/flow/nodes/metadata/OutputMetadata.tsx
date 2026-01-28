import type { AppNodeData, OutputNodeData } from "@/types/flow";
import { METADATA_LABEL_STYLE, METADATA_VALUE_STYLE } from "../../constants";
import { getOutputModeLabel } from "@/lib/outputModeConstants";

export function OutputMetadata({ data }: { data: AppNodeData }) {
    const outputData = data as OutputNodeData;
    const mode = outputData?.inputMappings?.mode || 'direct';

    return (
        <div className="flex items-center gap-2">
            <span className={METADATA_LABEL_STYLE}>回复格式</span>
            <span className={METADATA_VALUE_STYLE}>{getOutputModeLabel(mode)}</span>
        </div>
    );
}
