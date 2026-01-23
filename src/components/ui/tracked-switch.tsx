"use client"

import * as React from "react"
import { Switch } from "@/components/ui/switch"
import { track } from "@/lib/trackingService"

interface TrackedSwitchProps extends React.ComponentProps<typeof Switch> {
    /** 用于埋点的字段名称 */
    trackingName: string
    /** 可选的节点类型，用于更精确的埋点 */
    nodeType?: string
}

/**
 * TrackedSwitch - 自动埋点的 Switch 组件
 * 在切换时自动记录 node_config_toggle 事件
 */
function TrackedSwitch({
    trackingName,
    nodeType,
    onCheckedChange,
    ...props
}: TrackedSwitchProps) {
    const handleCheckedChange = React.useCallback(
        (checked: boolean) => {
            // 埋点：开关切换
            track('node_config_toggle', {
                field: trackingName,
                value: checked,
                node_type: nodeType,
            })
            // 调用原始回调
            onCheckedChange?.(checked)
        },
        [trackingName, nodeType, onCheckedChange]
    )

    return <Switch onCheckedChange={handleCheckedChange} {...props} />
}

export { TrackedSwitch }
