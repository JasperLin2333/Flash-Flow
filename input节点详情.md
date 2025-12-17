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
| `text` | string | ❌ | `""` | 用户输入的文本内容 (运行时数据) |
| `customOutputs` | array | ❌ | `[]` | 用户自定义输出变量列表 `{name, value}` |

### 文件上传配置 (`enableFileInput=true` 时)

`fileConfig` 对象配置参数：

| 参数名 | 类型 | 默认值 | 描述 |
|-------|------|-------|------|
| `fileConfig.allowedTypes` | string[] | `["*/*"]` | 允许的文件类型列表 |
| `fileConfig.maxSizeMB` | number | `100` | 单文件最大体积 (MB) |
| `fileConfig.maxCount` | number | `10` | 最大文件数量 |

**支持的文件类型 (allowedTypes 可选值)**:
- `.png,.jpg,.jpeg` - 图片 (png, jpg)
- `.pdf` - PDF 文档
- `.doc,.docx` - Word 文档
- `.xls,.xlsx` - Excel 表格
- `.txt` - 文本文件
- `.md` - Markdown
- `.csv` - CSV 文件

### 结构化表单配置 (`enableStructuredForm=true` 时)

`formFields` 数组，每个字段包含以下配置：

| 字段参数 | 类型 | 必填 | 描述 |
|---------|------|-----|------|
| `type` | string | ✅ | 字段类型 (见下表) |
| `name` | string | ✅ | 变量名 (如 `field_123456`) |
| `label` | string | ✅ | 显示标签 |
| `required` | boolean | ❌ | 是否必填 (默认 `false`) |

**字段类型 (type) 及特有参数**:

| 字段类型 | type 值 | 额外参数 | 默认值 |
|---------|--------|---------|-------|
| 文本输入 | `"text"` | `placeholder`, `defaultValue` | `defaultValue: ""` |
| 单选下拉 | `"select"` | `options` (string[]), `defaultValue` | `defaultValue: options[0]` |
| 多选下拉 | `"multi-select"` | `options` (string[]), `defaultValue` | `defaultValue: []` |

### 运行前校验 (Runtime Validation)

点击“运行 Flow”时，系统会检查 Input 节点的数据状态。**如果存在以下任意缺失情况，会自动弹出填写对话框**：

1.  **文本未填**: 启用了文本输入 (`enableTextInput: true`)，但 `text` 为空。
2.  **必填项缺失**: 启用了结构化表单 (`enableStructuredForm: true`)，且存在 `required: true` 的字段未填写数据。

> [!NOTE]
> 目前虽然支持启用文件上传，但在运行 Flow 时**不会强制校验**是否已上传文件，即使启用了文件输入也是如此。开发者需自行在后续流程中处理文件缺失的情况。

> [!NOTE]
> 弹窗填写界面会自动隐藏内部使用的节点 ID，仅展示节点名称。
> 如果启用了结构化表单但尚未配置任何字段，弹窗中会显示“暂无表单字段配置”提示，以明确告知用户当前状态。

### 输出格式 (JSON Structure)

```typescript
{
  "user_input": string,                       // 文本输入内容
  
  // 仅在有文件上传时存在
  "files"?: [
    {
      "name": string,                         // 文件名 (e.g. "report.pdf")
      "size": number,                         // 文件大小 (bytes)
      "type": string,                         // MIME类型 (e.g. "application/pdf")
      "url"?: string                          // 文件访问地址
    }
  ],
  
  // 仅在有表单填写时存在
  "formData"?: {
    [key: string]: any                        // 键值对，key 为字段定义的 name
  }
}
```

> [!IMPORTANT]
> `formData` 和 `files` 是**对象/数组**类型的变量。
> 如果直接引用 `{{输入节点.formData}}`，通常会被转为 JSON 字符串。
> 建议引用具体的子属性（如 `formData.category`）以获取精准值。
