## 1️⃣ Input 节点（输入节点）

### 功能描述
用户输入的入口节点，支持**文本输入**、**文件上传**、**结构化表单**三种输入模式，可单独或组合使用。

### 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|-----|-------|------|
| `label` | string | ✅ | - | 节点显示名称 |
| `enableTextInput` | boolean | ❌ | `true` | 启用文本输入框 |
| `enableFileInput` | boolean | ❌ | `false` | 启用文件上传 |
| `enableStructuredForm` | boolean | ❌ | `false` | 启用结构化表单 |
| `greeting` | string | ❌ | `""` | 招呼语/欢迎语，在对话页面显示，引导用户使用 |
| `text` | string | ❌ | `""` | 用户输入的文本内容 (运行时数据) |
| `fileConfig` | object | ❌ | 见下文 | 文件上传配置 (仅 `enableFileInput=true` 时生效) |
| `formFields` | array | ❌ | `[]` | 结构化表单字段配置列表 (仅 `enableStructuredForm=true` 时生效) |

## 招呼语配置 (`greeting`)

**功能说明**：
- 在应用对话页面的空状态（无对话历史）时显示
- 用于引导用户如何使用该助手，提升用户体验
- 如未配置，显示默认提示文本

**使用场景示例**：
```
「我可以帮你生成创意文案，请告诉我你的产品和目标受众！」
「上传图片，我来帮你分析图片内容并生成描述。」
```

### 文件上传配置 (`enableFileInput=true` 时)

`fileConfig` 对象配置参数：

| 参数名 | 类型 | 默认值 | 描述 |
|-------|------|-------|------|
| `fileConfig.allowedTypes` | string[] | `["*/*"]` | 允许的文件类型列表（可多选） |
| `fileConfig.maxSizeMB` | number | `100` | 单文件最大体积 (MB)，范围 1-100 |
| `fileConfig.maxCount` | number | `10` | 最大文件数量，范围 1-10 |

**支持的文件类型 (allowedTypes 可选值)**:
- `.png,.jpg,.jpeg,.webp` - 图片 (png, jpg, jpeg, webp)
- `.pdf` - PDF 文档
- `.doc,.docx` - Word 文档
- `.xls,.xlsx` - Excel 表格
- `.txt` - 文本文件
- `.md` - Markdown
- `.csv` - CSV 文件
- `*/*` - 所有文件类型（未选择任何类型时的默认值）

> [!TIP]
> 在构建器中，文件类型以复选框形式呈现，可同时选择多种类型。
> 如果取消选择所有类型，系统自动回退到 `*/*`（允许所有文件）。

### 结构化表单配置 (`enableStructuredForm=true` 时)

`formFields` 数组，每个字段包含以下配置：

| 字段参数 | 类型 | 必填 | 描述 |
|---------|------|-----|------|
| `type` | string | ✅ | 字段类型：`"text"` / `"select"` / `"multi-select"` |
| `name` | string | ✅ | 变量名（推荐格式：`field_timestamp`，如 `field_123456`） |
| `label` | string | ✅ | 显示标签（对用户展示的字段名称） |
| `required` | boolean | ❌ | 是否必填（默认 `false`） |

**字段类型 (type) 及特有参数**:

| 字段类型 | type 值 | 额外参数 | 默认值 | 说明 |
|---------|--------|---------|-------|------|
| 文本输入 | `"text"` | `placeholder`, `defaultValue` | `defaultValue: ""` | 单行文本输入框 |
| 单选下拉 | `"select"` | `options` (string[]), `defaultValue` | `defaultValue: options[0]` | 下拉单选框，用户只能选择一个选项 |
| 多选下拉 | `"multi-select"` | `options` (string[]), `defaultValue` | `defaultValue: []` | 下拉多选框，用户可选择多个选项 |

> [!NOTE]
> **字段配置说明**：
> - **变量名 (`name`)**: 用于在后续节点中引用该字段的值，如 `{{输入节点.formData.field_123456}}`
> - **字段名 (`label`)**: 在用户界面展示的友好名称，如"目标受众"、"文案风格"等
> - **选项列表 (`options`)**: 在构建器中以逗号分隔输入，系统会自动解析为字符串数组
> - **关闭表单时**: 系统会自动清空 `formFields` 配置和运行时 `formData` 数据

### 运行前校验 (Runtime Validation)

点击"运行 Flow"时，系统会对 Input 节点的数据完整性进行检查。**目前仅针对结构化表单的必填项进行强制校验**。

**校验规则**：

1. **结构化表单校验**: 
   - 启用了结构化表单 (`enableStructuredForm: true`)
   - 存在 `required: true` 的字段未填写数据
   - **判定标准**:
     - `undefined` 或 `null` 视为未填写
     - 空字符串 `""` 视为未填写 (包括仅空格)
     - 空数组 `[]` 视为未填写
     - **注意**: 数字 `0` 视为有效值

2. **文本与文件输入**:
   - `text` 输入：不做强制非空校验（即使启用，为空通常也可运行，取决于具体业务逻辑，但底层不拦截）
   - `files` 上传：不做强制非空校验（未上传文件时 `files` 字段可能不存在或为空数组）

**校验流程**：

```typescript
// 伪代码示例 (参考 src/store/utils/inputValidation.ts)
export function checkInputNodeMissing(data: InputNodeData): boolean {
    // 仅检查结构化表单必填项
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
    // 数字 0 视为有效值
    if (typeof value === 'number') return false;
    return false;
}
```

> [!WARNING]
> **文件上传说明**：
> - 系统**不会**自动校验文件是否已上传。如果您的业务逻辑依赖文件输入，请在后续节点（如 Tool 或 LLM）中自行检查 `files` 字段是否为空。

> [!NOTE]
> **对话框交互优化**：
> - 弹窗自动隐藏内部节点 ID，仅展示节点名称（`label`）
> - 如果启用了结构化表单但尚未配置任何字段，弹窗中会显示"暂无表单字段配置"提示
> - 支持在对话框中实时编辑文本、选择表单选项、上传文件

### 输出格式 (JSON Structure)

Input 节点执行后，会输出以下 JSON 结构：

```typescript
{
  "user_input": string,                       // 文本输入内容（总是存在，未填写时为空字符串 ""）
  
  // 仅在启用文件上传且有文件时存在
  "files"?: [
    {
      "name": string,                         // 文件名 (e.g. "report.pdf")
      "size": number,                         // 文件大小 (bytes)
      "type": string,                         // MIME类型 (e.g. "application/pdf")
      "url": string                           // 文件访问 URL（上传后生成）
    }
  ],
  
  // 仅在启用结构化表单且有填写时存在
  "formData"?: {
    "field_123456": string | string[],       // 字段值，根据字段类型不同
    // text 字段: string
    // select 字段: string
    // multi-select 字段: string[]
  }
}
```

**输出示例**：

```json
// 示例 1: 仅文本输入
{
  "user_input": "帮我写一篇产品介绍"
}

// 示例 2: 文本 + 结构化表单
{
  "user_input": "生成文案",
  "formData": {
    "field_style": "专业",           // select 字段
    "field_tags": ["科技", "创新"],  // multi-select 字段
    "field_length": "500"            // text 字段
  }
}

// 示例 3: 文本 + 文件
{
  "user_input": "分析这张图片",
  "files": [
    {
      "name": "product.jpg",
      "size": 245678,
      "type": "image/jpeg",
      "url": "https://storage.example.com/flows/xxx/product.jpg"
    }
  ]
}
```

> [!IMPORTANT]
> **变量引用注意事项**：
> - `formData` 和 `files` 是**对象/数组**类型的变量
> - 直接引用 `{{输入节点.formData}}` 会被转换为 JSON 字符串
> - **推荐引用方式**：
>   - 文本字段：`{{输入节点.formData.field_style}}`
>   - 多选字段：`{{输入节点.formData.field_tags}}`（返回数组）
>   - 文件数组：`{{输入节点.files}}`（在支持文件的节点中使用）
>   - 单个文件 URL：`{{输入节点.files[0].url}}`

### 完整节点 JSON 示例

以下是一个完整的 Input 节点配置与运行时数据示例：

```json
{
  "id": "input_1704038400000",
  "type": "input",
  "position": { "x": 100, "y": 200 },
  "data": {
    "label": "智能文案助手",
    "status": "completed",
    
    "enableTextInput": true,
    "enableFileInput": true,
    "enableStructuredForm": true,
    
    "greeting": "欢迎使用智能文案助手！请上传产品图片，填写产品信息，我来帮你生成专业的营销文案。",
    
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
        "options": ["专业严谨", "活泼有趣", "情感共鸣", "简洁明了"],
        "required": true,
        "defaultValue": "专业严谨"
      },
      {
        "type": "multi-select",
        "name": "target_audience",
        "label": "目标受众",
        "options": ["年轻人", "职场人士", "家庭用户", "学生群体", "高端消费者"],
        "required": false,
        "defaultValue": []
      }
    ],
    
    "text": "请帮我生成一段朋友圈文案",
    "files": [
      {
        "name": "product_photo.jpg",
        "size": 1258000,
        "type": "image/jpeg",
        "url": "https://storage.example.com/uploads/product_photo.jpg"
      }
    ],
    "formData": {
      "product_name": "智能保温杯",
      "style": "活泼有趣",
      "target_audience": ["年轻人", "职场人士"]
    },
    
    "output": {
      "user_input": "请帮我生成一段朋友圈文案",
      "files": [
        {
          "name": "product_photo.jpg",
          "size": 1258000,
          "type": "image/jpeg",
          "url": "https://storage.example.com/uploads/product_photo.jpg"
        }
      ],
      "formData": {
        "product_name": "智能保温杯",
        "style": "活泼有趣",
        "target_audience": ["年轻人", "职场人士"]
      }
    },
    "executionTime": 5
  }
}
```

> [!NOTE]
> **字段说明**：
> - **配置字段** (`enableXxx`, `fileConfig`, `formFields`, `greeting`)：在构建器中设置，定义节点能力
> - **运行时数据** (`text`, `files`, `formData`)：用户在运行时填写的实际数据
> - **输出字段** (`output`, `executionTime`, `status`)：节点执行后生成的结果

### 实现细节

**执行逻辑** (`InputNodeExecutor`)：
- Input 节点执行时无需等待，直接返回配置的数据
- 执行时间极短（<10ms），仅进行数据提取和格式化
- 输出结构根据启用的功能动态生成（未启用的功能不会出现对应字段）

**数据流转**：

```
构建器配置 → 运行前校验 → 文件上传 → 节点执行 → 输出数据
    ↓              ↓            ↓          ↓          ↓
enableXxx      弹窗填写    上传到云存储   提取数据   后续节点使用
```

**关键代码位置**：
- 类型定义: `src/types/flow.ts` - `InputNodeData` 接口 (L103-L122)
- 表单配置: `src/components/builder/node-forms/InputNodeForm/`
  - `index.tsx` - 主表单组件
  - `FileInputSection.tsx` - 文件上传配置
  - `StructuredFormSection.tsx` - 结构化表单配置
  - `constants.ts` - 常量定义和默认值
- 运行校验: `src/components/flow/InputPromptDialog.tsx`
- 执行器: `src/store/executors/InputNodeExecutor.ts`
- 应用界面: `src/components/apps/FlowAppInterface/`

**最佳实践**：

1. **合理组合输入方式**：根据实际场景选择合适的输入模式组合
   - 纯对话：仅启用文本输入
   - 图片分析：启用文本输入 + 文件上传（限制为图片类型）
   - 表单填报：启用结构化表单（可选文本输入作为补充说明）

2. **变量命名规范**：使用有意义的变量名
   ```
   ✅ field_target_audience (清晰明确)
   ❌ field_123456 (无意义的时间戳)
   ```

3. **招呼语编写技巧**：简洁明了，突出核心功能
   ```
   ✅ "上传商品图片，我来为你生成吸引人的营销文案！"
   ❌ "这是一个智能助手，可以帮你做很多事情..."
   ```

4. **文件类型限制**：根据实际需求精确限制文件类型，避免用户上传不支持的文件
   ```
   图片处理: [".png,.jpg,.jpeg,.webp"]
   文档分析: [".pdf", ".doc,.docx", ".txt"]
   数据导入: [".csv", ".xls,.xlsx"]
   ```
