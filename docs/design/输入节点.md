# Input 节点设计与逻辑契约文档

> **文档版本**: v2.0 (Code-Synced)  
> **审计基于**: `src/types/flow.ts` L111-130, `InputNodeExecutor.ts`, `inputValidation.ts`, `InputNodeForm/*`

---

## 1. 功能语意 (LLM-Ready Metadata)

**生态位**: 工作流的**数据入口节点**（Data Entry Point）。负责收集用户运行时输入，将原始数据（文本/文件/表单）标准化为 JSON 结构，供下游节点消费。

**核心能力**:
- 文本输入（默认启用）
- 文件/图像上传
- 结构化表单（下拉单选/多选、纯文本）

---

## 2. 核心参数契约 (Schema)

> **Source**: `src/types/flow.ts` → `InputNodeData` (L111-130)

### 2.1 配置参数 (Builder 侧)

| 参数名 | TypeScript 类型 | 必填 | 默认值 | 描述 |
|--------|----------------|------|--------|------|
| `label` | `string \| undefined` | ❌ | `undefined` | 节点显示名称（继承自 `BaseNodeData`）|
| `enableTextInput` | `boolean \| undefined` | ❌ | **隐式 `true`** | 启用文本输入框。代码逻辑: `enableTextInput !== false` |
| `enableFileInput` | `boolean \| undefined` | ❌ | **隐式 `false`** | 启用文件上传。代码逻辑: `enableFileInput === true` |
| `enableStructuredForm` | `boolean \| undefined` | ❌ | **隐式 `false`** | 启用结构化表单。代码逻辑: `enableStructuredForm === true` |
| `greeting` | `string \| undefined` | ❌ | `undefined` | 招呼语/引导文案，空状态时显示 |
| `fileConfig` | `FileInputConfig \| undefined` | ❌ | 见下文 | 文件上传配置对象 |
| `formFields` | `FormFieldConfig[] \| undefined` | ❌ | `[]` | 结构化表单字段定义数组 |

### 2.2 运行时数据 (App 侧)

| 参数名 | TypeScript 类型 | 描述 |
|--------|----------------|------|
| `text` | `string \| undefined` | 用户输入的文本内容（即 Legacy `user_input`）|
| `files` | `Array<{ name: string; size: number; type: string; url?: string }>` | 上传的文件元数据数组 |
| `formData` | `Record<string, unknown> \| undefined` | 表单字段值的 KV 映射 |

---

## 3. 嵌套类型定义

### 3.1 FileInputConfig

> **Source**: `src/types/flow.ts` L103-107

```typescript
interface FileInputConfig {
  allowedTypes: string[];  // 允许的文件类型（MIME 或扩展名）
  maxSizeMB: number;       // 单文件最大体积 (MB)
  maxCount: number;        // 最大文件数量
}
```

**默认值** (Source: `constants.ts` L21-24):
```typescript
const DEFAULT_FILE_CONFIG: FileInputConfig = {
  allowedTypes: ["*/*"],
  maxSizeMB: 100,
  maxCount: 10,
};
```

**硬约束** (Source: `FileInputSection.tsx` L116-140):
| 字段 | 约束 | 来源 |
|------|------|------|
| `maxSizeMB` | `min: 1, max: 100` | UI `<Input>` + `Math.min(Math.max(val, 1), 100)` |
| `maxCount` | `min: 1, max: 10` | UI `<Input>` + `Math.min(Math.max(val, 1), 10)` |
| `allowedTypes` | 空数组自动回退为 `["*/*"]` | `handleTypeToggle` 逻辑 |

**allowedTypes 枚举值** (Source: `constants.ts` L10-18):
```typescript
const FILE_TYPE_OPTIONS = [
  { value: ".png,.jpg,.jpeg,.webp", label: "图片 (png, jpg, jpeg, webp)" },
  { value: ".pdf", label: "PDF (pdf)" },
  { value: ".doc,.docx", label: "Word 文档 (doc, docx)" },
  { value: ".xls,.xlsx", label: "Excel 表格 (xls, xlsx)" },
  { value: ".txt", label: "文本文件 (txt)" },
  { value: ".md", label: "Markdown (md)" },
  { value: ".csv", label: "CSV (csv)" },
];
```

### 3.2 FormFieldConfig (联合类型)

> **Source**: `src/types/flow.ts` L72-101

```typescript
type FormFieldType = 'select' | 'text' | 'multi-select';
type FormFieldConfig = SelectFieldConfig | TextFieldConfig | MultiSelectFieldConfig;
```

#### SelectFieldConfig
```typescript
interface SelectFieldConfig {
  type: 'select';
  name: string;            // 变量 ID (用于 formData 的 Key)
  label: string;           // 显示名称
  options: string[];       // 选项列表
  required: boolean;       // 是否必填
  defaultValue?: string;   // 默认选中项
}
```

#### MultiSelectFieldConfig
```typescript
interface MultiSelectFieldConfig {
  type: 'multi-select';
  name: string;
  label: string;
  options: string[];
  required: boolean;
  defaultValue?: string[]; // 默认选中项数组
}
```

#### TextFieldConfig
```typescript
interface TextFieldConfig {
  type: 'text';
  name: string;
  label: string;
  placeholder?: string;    // 输入占位符
  required: boolean;
  defaultValue?: string;
}
```

**新字段默认值** (Source: `constants.ts` L62-70):
```typescript
function createNewTextField(): TextFieldConfig {
  return {
    type: "text",
    name: `field_${Date.now()}`,  // 时间戳格式
    label: "新字段",
    required: false,
  };
}
```

---

## 4. 逻辑约束与边界

### 4.1 参数依赖 (显隐控制)

> **AI 生成工作流时必须遵守的逻辑依赖**

| 控制参数 | 被控参数 | 逻辑关系 |
|----------|----------|----------|
| `enableFileInput === true` | `fileConfig` | 启用时才可配置，关闭时 `fileConfig` 被忽略 |
| `enableStructuredForm === true` | `formFields` | 启用时才可配置，关闭时 `formFields` 被忽略 |

### 4.2 运行时校验规则

> **Source**: `src/store/utils/inputValidation.ts`

```typescript
function checkInputNodeMissing(data: InputNodeData): boolean {
  // 仅校验结构化表单的必填项
  const isFormEnabled = data.enableStructuredForm === true && Array.isArray(data.formFields);
  
  if (isFormEnabled && data.formFields) {
    return data.formFields.some((field) => {
      if (!field.required) return false;
      const value = data.formData?.[field.name];
      return isFieldEmpty(value);
    });
  }
  return false;
}

function isFieldEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'number') return false; // 数字 0 视为有效
  return false;
}
```

**关键点**:
- ⚠️ `text` 输入**不做强制校验**（即使为空也可运行）
- ⚠️ `files` 上传**不做强制校验**（可无文件运行）
- ✅ 仅 `formFields` 中 `required: true` 的字段会被校验

### 4.3 运行时错误条件

> **Source**: `InputDebugDialog.tsx` L107-192

| 错误条件 | 错误消息 | 触发位置 |
|----------|----------|----------|
| 必填表单字段未填写 | `"必填字段未填: {field.label}"` | `handleConfirm` 循环校验 |
| 文件上传失败 | `result.errors[0]` (来自 `useFileUpload`) | `uploadFiles` 返回错误 |
| 文件校验失败 | `validation.errors[0]` | `validateFiles` 返回错误 |

---

## 5. 执行器逻辑 (Executor)

> **Source**: `src/store/executors/InputNodeExecutor.ts`

```typescript
class InputNodeExecutor extends BaseNodeExecutor {
  async execute(node: AppNode, _context: FlowContext, mockData?: Record<string, unknown>): Promise<ExecutionResult> {
    const inputData = node.data as InputNodeData;

    // 优先使用 mockData（调试模式）
    const text = (mockData?.user_input as string) ?? inputData.text ?? "";
    const files = (mockData?.files as any[]) ?? inputData.files;
    const formData = (mockData?.formData as Record<string, unknown>) ?? inputData.formData;

    // 构建输出对象
    const output: Record<string, unknown> = {
      user_input: text,  // 始终存在
    };

    // 条件性添加 files
    if (files && files.length > 0) {
      output.files = files;
    }

    // 条件性添加 formData
    if (formData && Object.keys(formData).length > 0) {
      output.formData = formData;
    }

    return { output, executionTime: time };
  }
}
```

**关键点**:
- `user_input` **始终存在**于输出中（空字符串 `""` 如果未填写）
- `files` 仅在有文件时存在
- `formData` 仅在有表单数据时存在

---

## 6. 输出格式契约

### 6.1 存储层 (执行结果 JSON)

> ⚠️ **存储层使用 `field.name`（变量ID）作为 Key**

```typescript
interface InputNodeOutput {
  user_input: string;  // 始终存在，默认 ""

  files?: Array<{
    name: string;   // 文件名
    size: number;   // 字节数
    type: string;   // MIME 类型
    url?: string;   // 上传后的访问 URL
  }>;

  formData?: {
    [fieldName: string]: string | string[];
    // ⚠️ Key 是 field.name（变量ID），如 "field_1767594083392"
    // 详见下方「双层映射机制」说明
  };
}
```

### 6.2 引用层 (变量模板)

> ✅ **引用层使用 `field.label`（显示名/字段名）**

系统在 `processInputNodeFormData()` 中自动建立映射：

```typescript
// 源码: src/store/executors/utils/variableUtils.ts L137-149
formFields.forEach(field => {
  const value = formData[field.name];  // 从存储层读取
  processor.addVariable(`formData.${field.label}`, value);  // 用 label 注册引用
});
```

**因此您可以使用友好的字段名引用：**

| 引用目标 | 语法 | 返回类型 |
|----------|------|----------|
| 文本内容 | `{{输入节点.user_input}}` | `string` |
| 表单字段 | `{{输入节点.formData.产品名称}}` | `string \| string[]` |
| 文件数组 | `{{输入节点.files}}` | `Array<FileObj>` |
| 首个文件 URL | `{{输入节点.files[0].url}}` | `string` |

### 6.3 双层映射机制

```
┌─────────────────────────────────────────────────────────────┐
│  用户引用: {{INPUT.formData.产品名称}}                        │
│                        ↓                                    │
│  variableUtils.ts 映射: formData.label → formData[name]     │
│                        ↓                                    │
│  存储层读取: formData["field_1767594083392"] = "智能保温杯"   │
└─────────────────────────────────────────────────────────────┘
```

| 层级 | Key 格式 | 来源 |
|------|----------|------|
| **存储层** (执行结果 JSON) | `field.name` (如 `field_1767594083392`) | 系统自动生成或用户配置 |
| **引用层** (变量模板) | `field.label` (如 `产品名称`) | 用户在 Builder 中设置的「字段名」|

---

## 7. 完整 JSON Payload 示例

### 7.1 节点配置示例 (Builder)

```json
{
  "id": "input_1704038400000",
  "type": "input",
  "position": { "x": 100, "y": 200 },
  "data": {
    "label": "智能文案助手",
    "enableTextInput": true,
    "enableFileInput": true,
    "enableStructuredForm": true,
    "greeting": "👋 欢迎！请上传产品图片并填写表单，我来帮你生成营销文案。",
    "fileConfig": {
      "allowedTypes": [".png,.jpg,.jpeg,.webp"],
      "maxSizeMB": 10,
      "maxCount": 3
    },
    "formFields": [
      {
        "type": "text",
        "name": "product_name",
        "label": "产品名称",
        "placeholder": "请输入产品名称",
        "required": true,
        "defaultValue": ""
      },
      {
        "type": "select",
        "name": "style",
        "label": "文案风格",
        "options": ["专业严谨", "活泼有趣", "情感共鸣"],
        "required": true,
        "defaultValue": "专业严谨"
      },
      {
        "type": "multi-select",
        "name": "target_audience",
        "label": "目标受众",
        "options": ["学生", "职场人士", "家庭用户"],
        "required": false,
        "defaultValue": []
      }
    ],
    "text": "",
    "files": [],
    "formData": {}
  }
}
```

### 7.2 执行输出示例 (Runtime)

**存储层实际 JSON（使用 `field.name`）：**

```json
{
  "user_input": "请帮我生成一段朋友圈文案",
  "files": [
    {
      "name": "product.jpg",
      "size": 245678,
      "type": "image/jpeg",
      "url": "https://storage.example.com/flows/xxx/product.jpg"
    }
  ],
  "formData": {
    "field_1736038500001": "智能保温杯",
    "field_1736038500002": "活泼有趣",
    "field_1736038500003": ["学生", "职场人士"]
  }
}
```

**但通过变量引用（使用 `field.label`）：**

```
{{INPUT.formData.产品名称}}  →  "智能保温杯"
{{INPUT.formData.文案风格}}  →  "活泼有趣"
{{INPUT.formData.目标受众}}  →  ["学生", "职场人士"]
```

---

## 8. 代码位置索引

| 功能模块 | 文件路径 | 关键行号 |
|----------|----------|----------|
| 类型定义 | `src/types/flow.ts` | L72-130 |
| 执行器 | `src/store/executors/InputNodeExecutor.ts` | L1-43 |
| 运行时校验 | `src/store/utils/inputValidation.ts` | L1-39 |
| Builder 表单 | `src/components/builder/node-forms/InputNodeForm/index.tsx` | L1-221 |
| 文件配置组件 | `src/components/builder/node-forms/InputNodeForm/FileInputSection.tsx` | L1-151 |
| 表单配置组件 | `src/components/builder/node-forms/InputNodeForm/StructuredFormSection.tsx` | L1-198 |
| 常量与默认值 | `src/components/builder/node-forms/InputNodeForm/constants.ts` | L1-105 |
| 调试弹窗 | `src/components/flow/InputDebugDialog.tsx` | L1-485 |
| Canvas 元数据 | `src/components/flow/nodes/metadata/InputMetadata.tsx` | L1-26 |

---

## 9. LLM 生成工作流指引

### 9.1 最小可用配置

```json
{
  "type": "input",
  "data": {
    "label": "用户输入"
  }
}
```

> 默认启用文本输入，禁用文件和表单。

### 9.2 生成规则

1. **不要**设置 `enableTextInput: true`（它是隐式默认值）
2. **必须**在 `enableFileInput: true` 时提供 `fileConfig`
3. **必须**在 `enableStructuredForm: true` 时提供 `formFields` 数组
4. `formFields` 中的 `name` 字段应使用 `snake_case` 格式
5. `fileConfig.maxSizeMB` 必须在 `[1, 100]` 范围内
6. `fileConfig.maxCount` 必须在 `[1, 10]` 范围内
