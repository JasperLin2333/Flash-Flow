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
- `.png,.jpg,.jpeg` - 图片 (png, jpg)
- `.pdf` - PDF 文档
- `.doc,.docx` - Word 文档
- `.xls,.xlsx` - Excel 表格
- `.txt` - 文本文件
- `.md` - Markdown
- `.csv` - CSV 文件
- `image/*` - 所有图片类型（通配符）
- `*/*` - 所有文件类型（通配符）

> [!TIP]
> 在构建器中，文件类型以复选框形式呈现，可同时选择多种类型。
> 智能 AI 规划功能会根据节点名称自动推断合适的文件类型（如节点名包含"图片"则默认选择 `image/*`）。

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

点击"运行 Flow"时，系统会自动检查 Input 节点的数据完整性。**如果存在以下任意缺失情况，会自动弹出输入对话框**：

**校验规则**：

1. **文本未填**: 启用了文本输入 (`enableTextInput: true`)，但 `text` 为空或仅包含空格
2. **文件未上传**: 启用了文件上传 (`enableFileInput: true`)，但 `files` 为空数组
3. **必填字段缺失**: 启用了结构化表单 (`enableStructuredForm: true`)，且存在 `required: true` 的字段未填写数据
   - 对于多选字段：空数组 `[]` 视为未填写
   - 对于其他字段：空值、`null`、`undefined` 视为未填写（但数字 `0` 视为有效值）

**校验流程**：

```typescript
// 伪代码示例
for (const inputNode of inputNodes) {
  // 1. 检查文本输入
  const isTextEnabled = enableTextInput !== false; // 默认 true
  const isTextMissing = isTextEnabled && (!text || !text.trim());
  
  // 2. 检查文件上传
  const isFileEnabled = enableFileInput === true;
  const isFileMissing = isFileEnabled && (!files || files.length === 0);
  
  // 3. 检查结构化表单必填项
  const isFormEnabled = enableStructuredForm === true;
  let isFormMissing = false;
  if (isFormEnabled && formFields) {
    isFormMissing = formFields.some(field => 
      field.required && isEmpty(formData[field.name])
    );
  }
  
  // 4. 如果有任何缺失，弹出输入对话框
  if (isTextMissing || isFileMissing || isFormMissing) {
    openInputPrompt();
    return;
  }
}
```

> [!WARNING]
> **文件上传说明**：
> - 如果启用了文件上传且未上传任何文件，系统会**自动弹出输入对话框**，提示用户上传文件
> - 文件上传是在点击“运行”后、执行流程前进行的
> - 如果上传失败，会显示错误提示并中止执行
> - 开发者需在后续节点中自行判断文件是否存在（文件可能为空数组）

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
- 类型定义: `src/types/flow.ts` - `InputNodeData` 接口
- 表单配置: `src/components/builder/node-forms/InputNodeForm/`
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
   图片处理: ["image/*"]
   文档分析: [".pdf", ".doc", ".docx", ".txt"]
   数据导入: [".csv", ".xlsx"]
   ```
