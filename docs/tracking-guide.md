# 埋点使用指南

## 🎯 埋点体系概述

本项目的埋点体系基于 `trackingService.ts` 核心模块，提供完整的用户行为追踪能力。

### 核心特性
- **批量上报**：每5秒或满10条事件自动上报
- **高频采样**：canvas_pan、canvas_zoom、node_hover 等事件5%采样率
- **悬浮防抖**：≥300ms的悬浮事件才会被记录
- **离线缓存**：页面关闭前确保事件不丢失
- **自动重试**：网络失败时自动重试上报

## 📊 画布埋点清单

### 基础节点操作 ✅
```typescript
// 添加节点
trackNodeAdd('llm', { x: 100, y: 200 });

// 删除节点  
trackNodeDelete('node_123', 'llm');

// 选中节点
trackNodeSelect('node_123', 'llm');

// 节点数据更新
trackNodeDataUpdate('node_123', 'llm', 'prompt');
```

### 连线操作 ✅
```typescript
// 连接节点
trackEdgeConnect('node_1', 'node_2');

// 删除连线
trackEdgeDelete('edge_456');
```

### 画布交互 ✅
```typescript
// 画布移动/缩放（内部5%采样）
trackCanvasMove(150, 200, 1.2);

// 选中变化
trackSelectionChange(3, 2);

// 画布点击（空白区域）
trackCanvasClick();

// 画布右键菜单
trackCanvasContextMenu({ x: 300, y: 400 });
```

### 高级交互 ✅（新增）
```typescript
// 节点悬停（配合 createHoverTracker）
const hoverTracker = createHoverTracker('node_hover', { 
  node_id: 'node_123', 
  node_type: 'llm' 
});

// 节点双击
trackNodeDoubleClick('node_123', 'llm');

// 节点拖拽
trackNodeDragStart('node_123', 'llm');
trackNodeDragEnd('node_123', 'llm', 
  { x: 100, y: 100 }, 
  { x: 200, y: 150 }
);

// 节点右键菜单
trackNodeContextMenu('node_123', 'llm');
```

### 编辑操作 ✅（新增）
```typescript
// 多选操作
trackMultiSelect(['node_1', 'node_2'], ['edge_1']);

// 复制粘贴
trackNodeCopy(['node_1', 'node_2'], ['llm', 'tool']);
trackNodePaste(2);

// 对齐分布
trackNodeAlign('left', 3);
trackNodeDistribute('horizontal', 4);

// 自动布局
trackAutoLayout('dagre', 10);
```

### 文件操作 ✅（新增）
```typescript
// 导入导出
trackFlowImport('file_upload', 15, 20);
trackFlowExport('json', 15, 20);

// 搜索功能
trackNodeSearch(5, 3); // 查询5个字符，找到3个结果
```

### 编辑历史 ✅（新增）
```typescript
// 撤销重做
trackUndo('node_move');
trackRedo('node_move');
```

## 🔧 在组件中使用埋点

### 1. 节点组件埋点示例
```typescript
import { trackNodeSelect, trackNodeDoubleClick, createHoverTracker } from '@/lib/trackingService';

function CustomNode({ id, type }: { id: string; type: string }) {
  // 悬停追踪器
  const hoverTracker = useMemo(() => 
    createHoverTracker('node_hover', { node_id: id, node_type: type }), 
    [id, type]
  );

  return (
    <div
      onClick={() => trackNodeSelect(id, type)}
      onDoubleClick={() => trackNodeDoubleClick(id, type)}
      onMouseEnter={hoverTracker.onEnter}
      onMouseLeave={hoverTracker.onLeave}
    >
      {/* 节点内容 */}
    </div>
  );
}
```

### 2. 画布组件埋点示例
```typescript
import { 
  trackCanvasClick, 
  trackCanvasContextMenu,
  trackNodeDragStart,
  trackNodeDragEnd
} from '@/lib/trackingService';

function FlowCanvas() {
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

  const handleNodeDragStart = (event: React.MouseEvent, node: Node) => {
    const pos = { x: node.position.x, y: node.position.y };
    setDragStartPos(pos);
    trackNodeDragStart(node.id, node.type || 'unknown');
  };

  const handleNodeDragStop = (event: React.MouseEvent, node: Node) => {
    if (dragStartPos) {
      trackNodeDragEnd(
        node.id, 
        node.type || 'unknown',
        dragStartPos,
        { x: node.position.x, y: node.position.y }
      );
      setDragStartPos(null);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    // 检查是否点击的是空白区域
    if (event.target === event.currentTarget) {
      trackCanvasClick();
    }
  };

  const handleCanvasContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    trackCanvasContextMenu({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  return (
    <ReactFlow
      onNodeDragStart={handleNodeDragStart}
      onNodeDragStop={handleNodeDragStop}
      onPaneClick={handleCanvasClick}
      onPaneContextMenu={handleCanvasContextMenu}
      // ... 其他属性
    />
  );
}
```

### 3. 工具栏埋点示例
```typescript
import { 
  trackNodeCopy, 
  trackNodePaste, 
  trackNodeAlign,
  trackUndo,
  trackRedo
} from '@/lib/trackingService';

function ControlDock() {
  const handleCopy = () => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length > 0) {
      trackNodeCopy(
        selectedNodes.map(n => n.id),
        selectedNodes.map(n => n.type || 'unknown')
      );
      // 执行复制逻辑
    }
  };

  const handlePaste = () => {
    const pasteCount = getPasteData().length;
    trackNodePaste(pasteCount);
    // 执行粘贴逻辑
  };

  const handleAlign = (alignment: string) => {
    const selectedCount = getSelectedNodes().length;
    trackNodeAlign(alignment, selectedCount);
    // 执行对齐逻辑
  };

  const handleUndo = () => {
    const lastAction = getLastAction();
    trackUndo(lastAction.type);
    // 执行撤销逻辑
  };

  const handleRedo = () => {
    const nextAction = getNextAction();
    trackRedo(nextAction.type);
    // 执行重做逻辑
  };

  return (
    <div className="control-dock">
      <button onClick={handleCopy}>复制</button>
      <button onClick={handlePaste}>粘贴</button>
      <button onClick={() => handleAlign('left')}>左对齐</button>
      <button onClick={handleUndo}>撤销</button>
      <button onClick={handleRedo}>重做</button>
    </div>
  );
}
```

## 📈 埋点数据分析建议

### 关键指标监控

1. **用户活跃度**
   - 日活节点操作数
   - 平均每个用户的画布交互次数
   - 常用节点类型分布

2. **用户体验**
   - 节点拖拽平均距离
   - 悬停时长分布
   - 右键菜单使用频率

3. **功能使用**
   - 自动布局使用率
   - 对齐功能使用情况
   - 撤销重做频率

4. **性能指标**
   - 画布操作响应时间
   - 高频事件采样效果
   - 批量上报成功率

### SQL查询示例

```sql
-- 查看最常用的节点类型
SELECT 
  event_data->>'node_type' as node_type,
  COUNT(*) as usage_count
FROM user_events 
WHERE event_name = 'node_add'
GROUP BY event_data->>'node_type'
ORDER BY usage_count DESC;

-- 分析用户操作路径
SELECT 
  user_id,
  event_name,
  created_at
FROM user_events 
WHERE user_id = 'some-user-id'
  AND event_name IN ('node_add', 'node_delete', 'edge_connect')
ORDER BY created_at;

-- 统计画布交互频率
SELECT 
  DATE(created_at) as date,
  COUNT(*) as canvas_interactions
FROM user_events 
WHERE event_name IN ('canvas_pan', 'canvas_zoom', 'node_select')
GROUP BY DATE(created_at)
ORDER BY date;
```

## ⚠️ 注意事项

1. **隐私保护**：避免记录敏感用户数据
2. **性能影响**：高频事件已配置采样，无需额外处理
3. **事件命名**：遵循 `对象_动作` 的命名规范
4. **数据结构**：保持事件数据结构一致性
5. **错误处理**：埋点失败不应影响主业务流程

## 🔄 最佳实践

1. **就近埋点**：在用户操作发生的组件内直接埋点
2. **语义明确**：事件名称和参数要有明确业务含义
3. **适度采集**：避免过度采集无价值的数据
4. **统一管理**：所有埋点通过 `trackingService.ts` 统一管理
5. **定期审查**：定期检查埋点数据质量和有效性