# 节点设计规范 (Node Design Specification)

> **版本**: 1.1 | **更新**: 2026-01-05
> **用途**: 前端节点开发与优化的核心红线标准。

---

## 🏗️ 总体设计 (System)

### 1. 场景定义
| 场景 | 特征 | 风格关键词 | 容器规范 |
| :--- | :--- | :--- | :--- |
| **Builder (构建器)** | 功能密集、工程化 | 紧凑、蓝色系 | `rounded-2xl`, `shadow-xl`, `border-gray-200` |
| **Runtime (运行时)** | 沉浸式、极简 | Premium、黑白灰 | `rounded-2xl`, `shadow-xl`, `bg-white` |

### 2. 原子规范 (Atomic Rules)
*   **Radius**: 全局统一 `rounded-2xl` (16px)，表单元素使用 `rounded-lg`。
*   **Spacing**:
    *   **Layout**: `space-y-5` (主要区块间距)。
    *   **Form**: `space-y-4` (表单项间距)。
    *   **Dialog**: Header (`pt-6 pb-3`), Body (`px-6 py-4`).
*   **Input Height**:
    *   **Builder**: `h-9` (36px) - 紧凑。
    *   **Runtime**: `h-10` (40px) - 易触控。

---

## 🧩 节点规范详情 (Node Specs)

### 1. 输入节点 (Input Node)
*   **交互**: 多节点聚合于单弹窗；必须校验必填项；统一使用 `useFileUpload`。
*   **结构**:
    *   `DialogHeader`: 标题 + 欢迎语 (Blue Box)。
    *   `Inputs`: 文本域 (`min-h-[100px]`) + 文件上传 + 结构化表单。
    *   **状态**: 运行中锁定 Dialog (`disabled`)；上传显示进度 (`Loader2`)。

### 2. LLM 节点 (LLM Node)
*   **交互**: 调试时支持临时覆盖 System Prompt / User Input。
*   **配置表单 (Settings Form)**:
    *   **高度**: 所有输入框/下拉框 `h-9`。
    *   **布局**: 标准 `space-y-4`，移除冗余分割线。
    *   **卡片**: 复杂组 (如记忆、高级设置) 使用轻量卡片 (`bg-gray-50/50 rounded-xl border`).
*   **调试弹窗 (Debug Dialog)**:
    *   **Header**: `px-6 pt-6 pb-3`.
    *   **Body**: `px-6 py-4 space-y-5`.
    *   **Inputs**: Textarea `min-h-[100px]`, `rounded-lg`, Focus `ring-black`.

### 3. 分支节点 (Branch Node)
*   **核心**: JS 表达式实时校验 (Visual Feedback)。
*   **配置表单 (Settings Form)**:
    *   **布局**: 标准 `space-y-4`。
    *   **条件输入**: Textarea `min-h-[80px]`, `font-mono`，支持实时语法校验。
    *   **校验反馈**: 合法时显示绿色 ✓；非法时边框变 `border-amber-400` + 错误提示。
*   **调试弹窗 (Debug Dialog)**:
    *   **Header**: `px-6 pt-6 pb-3`。
    *   **Body**: `px-6 py-4 space-y-5`。
    *   **Textarea**: `min-h-[120px]`, `font-mono`, `rounded-lg`, Focus `ring-black`。

### 4. 图像生成节点 (ImageGen Node)
*   **配置表单 (Settings Form)**:
    *   **高级设置**: 使用卡片容器 (`bg-gray-50/50 rounded-xl border`)，标题栏支持 Hover 反馈。
    *   **输入框**: 提示词 Textarea 最小高度 `min-h-[100px]`，负向提示词 `min-h-[80px]`。
    *   **参考图**:
        *   模式切换使用 Segmented Control 风格 (`bg-gray-100 p-1 rounded-lg`)。
        *   添加按钮使用统一虚线风格 (`border-dashed`).
*   **调试弹窗 (Debug Dialog)**:
    *   **Header**: `px-6 pt-6 pb-3` (Vertical Split).
    *   **Body**: `px-6 py-4 space-y-5`.

### 5. 知识库节点 (RAG Node)
*   **配置表单 (Settings Form)**:
    *   **布局**: 标准 `space-y-4`。
    *   **模式切换**: 使用 Segmented Control (`bg-gray-100 p-1 rounded-lg gap-1`)，与 ImageGen 参考图风格一致。
    *   **高级设置**: 使用轻量卡片 (`bg-gray-50/50 rounded-xl border`)，Hover 反馈。
    *   **输入框**: 变量引用输入使用 `py-1.5 px-3 text-xs font-mono`，与 Segmented Control 高度一致。
*   **调试弹窗 (Debug Dialog)**:
    *   **Header**: `px-6 pt-6 pb-3`。
    *   **Body**: `px-6 py-4 space-y-5`。
    *   **Inputs**: Textarea `min-h-[100px]`, `rounded-lg`, Focus `ring-black`。
    *   **Behavior**: Unified Store-Driven (Auto-prefill from node)。

### 6. 工具节点 (Tool Node)
*   **配置表单 (Settings Form)**:
    *   **布局**: 标准 `space-y-4` 容器包裹。
    *   **高度**: 所有输入框/下拉框 `h-9`。
    *   **文件上传 (Code Interpreter)**: 
        *   使用虚线边框 (`border-dashed`)。
        *   空状态使用 `rounded-lg border border-dashed`。
        *   间距 `space-y-4`。
*   **调试弹窗 (Debug Dialog)**:
    *   **Header**: `px-6 pt-6 pb-3`。
    *   **Body**: `px-6 py-4 space-y-5`。
    *   **SelectTrigger**: 统一 `h-9`。
    *   **Textarea**: `min-h-[120px]`, `rounded-lg`, Focus `ring-black`。

---

## 🔧 Builder 侧边栏规范 (Builder Sidebar)

*   **NodeIOSection 间距**: 与上方表单分隔使用 `mt-5 pt-4 border-t border-gray-100`。
*   **区块内间距**: `space-y-4`。

---
*文档持续迭代中*

