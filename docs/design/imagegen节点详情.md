## 1️⃣ ImageGen 节点（图像生成节点）

### 功能描述
AI 图像生成节点，支持**文生图**和**图生图**两种模式。调用 SiliconFlow API 根据文本描述生成图像，支持变量引用、多参考图融合等高级功能。

### 核心参数

| 参数名 | 类型 | 必填 | 默认值 | 描述 |
|-------|------|-----|-------|------|
| `label` | string | ❌ | - | 节点显示名称 |
| `model` | string | ❌ | `"Kwai-Kolors/Kolors"` | 图像生成模型 |
| `prompt` | string | ✅ | - | 图片描述（支持 `{{变量}}` 语法） |
| `negativePrompt` | string | ❌ | `""` | 负向提示词（仅部分模型支持） |
| `imageSize` | string | ❌ | 模型默认值 | 输出图片尺寸 |
| `cfg` | number | ❌ | 模型默认值 | 创意系数（CFG，值越小越有创意，越大越遵循提示词） |
| `numInferenceSteps` | number | ❌ | 模型默认值 | 推理步数（越大质量越高，速度越慢） |
| `referenceImageMode` | `"variable"` \| `"static"` | ❌ | `"static"` | 参考图来源模式 |
| `referenceImageUrl` | string | ❌ | - | 静态上传的主参考图 URL |
| `referenceImageUrl2` | string | ❌ | - | 静态上传的副参考图 URL 2 |
| `referenceImageUrl3` | string | ❌ | - | 静态上传的副参考图 URL 3 |
| `referenceImageVariable` | string | ❌ | - | 变量引用的主参考图（如 `{{输入节点.files[0].url}}`） |
| `referenceImage2Variable` | string | ❌ | - | 变量引用的副参考图 2 |
| `referenceImage3Variable` | string | ❌ | - | 变量引用的副参考图 3 |

### 支持的模型

| 模型 ID | 模型名称 | 负向提示词 | 尺寸调节 | 参考图 | 推理步数 |
|--------|---------|----------|---------|--------|---------|
| `Kwai-Kolors/Kolors` | 可灵 | ✅ | ✅ | ❌ | ✅ (1-49) |
| `Qwen/Qwen-Image` | 千问-文生图 | ✅ | ✅ | ❌ | ✅ (1-50) |
| `Qwen/Qwen-Image-Edit-2509` | 千问-图生图 | ✅ | ❌ | ✅ (1-3张) | ✅ (1-50) |

> [!TIP]
> 不同模型能力不同，构建器会根据所选模型动态显示/隐藏相关配置项。
> 模型列表从数据库动态加载，可通过后台管理添加新模型。

### 参考图配置（图生图模式）

仅 `supportsReferenceImage=true` 的模型支持参考图功能。

**两种参考图来源模式**：

| 模式 | 字段 | 描述 |
|------|-----|------|
| `static` | `referenceImageUrl`, `referenceImageUrl2`, `referenceImageUrl3` | 在构建器中直接上传图片 |
| `variable` | `referenceImageVariable`, `referenceImage2Variable`, `referenceImage3Variable` | 通过变量引用动态获取图片 URL |

**变量引用示例**：
```
{{输入节点.files[0].url}}          // 引用用户上传的图片
{{图像生成节点.imageUrl}}           // 引用上游节点生成的图片
```

> [!NOTE]
> - 主图权重最高，副图用于融合多图特征
> - 千问-图生图 (Edit-2509) 最多支持 3 张参考图
> - 未解析的变量占位符（如 `{{xxx}}`）会被自动过滤，不会发送到 API

### 图片尺寸选项

**可灵 (Kolors)**：
- `1024x1024` - 1:1 正方形
- `960x1280` - 3:4 竖版
- `768x1024` - 3:4 竖版
- `720x1440` - 1:2 竖版
- `720x1280` - 9:16 竖版

**千问-文生图 (Qwen-Image)**：
- `1328x1328` - 1:1 正方形
- `1664x928` / `928x1664` - 16:9 横版/竖版
- `1472x1140` / `1140x1472` - 4:3 横版/竖版
- `1584x1056` / `1056x1584` - 3:2 横版/竖版

### 创意系数与生成质量

**创意系数 (CFG)**：
- 前端显示为 0-100% 的滑块
- 值越高越遵循提示词描述
- 值越低越有创意自由度
- 不同模型的参数名和范围不同：
  - Kolors: `guidance_scale`，范围 0-20，默认 7.5
  - Qwen 系列: `cfg`，范围 0.1-20，默认 4.0

**生成质量（推理步数）**：
- 前端显示为 0-100% 的滑块
- 值越高质量越好，但生成速度越慢
- 会根据模型的 `minInferenceSteps` 和 `maxInferenceSteps` 自动转换

### 配额限制

> [!WARNING]
> 图像生成受用户配额限制，执行前会检查 `image_gen_executions` 配额。
> 超出配额时返回错误，不会扣除额度。执行成功后扣除 1 次额度。

### 输出格式 (Node Output)

ImageGen 节点执行后，会输出以下简单结构供下游节点使用：

```typescript
{
  "imageUrl": string,      // 生成图片的永久访问 URL（存储在 Supabase Storage）
}
```

> [!IMPORTANT]
> **变量引用方式**：
> - 引用生成的图片：`{{图像生成节点.imageUrl}}`
> - 可用于后续节点的 LLM 多模态输入或其他图生图节点的参考图

### 完整节点 JSON 示例

以下是一个完整的 ImageGen 节点配置与运行时数据示例：

```json
{
  "id": "imagegen_1704038400000",
  "type": "imagegen",
  "position": { "x": 400, "y": 200 },
  "data": {
    "label": "生成产品图片",
    "status": "completed",
    
    "model": "Kwai-Kolors/Kolors",
    "prompt": "一张{{输入节点.formData.product_name}}的产品展示图，{{输入节点.formData.style}}风格，高清质感，专业摄影",
    "negativePrompt": "模糊，低质量，变形，水印",
    "imageSize": "1024x1024",
    "cfg": 7.5,
    "numInferenceSteps": 30,
    
    "referenceImageMode": "static",
    "referenceImageUrl": "",
    
    "output": {
      "imageUrl": "https://xxxxx.supabase.co/storage/v1/object/public/generated-images/1704038400000_abc123.png"
    },
    "executionTime": 8500
  }
}
```

**图生图模式示例（变量引用参考图）**：

```json
{
  "id": "imagegen_1704038500000",
  "type": "imagegen",
  "position": { "x": 600, "y": 200 },
  "data": {
    "label": "风格迁移",
    "status": "completed",
    
    "model": "Qwen/Qwen-Image-Edit-2509",
    "prompt": "将这张图片转换为水彩画风格",
    "negativePrompt": "真实照片，写实风格",
    "cfg": 4.0,
    "numInferenceSteps": 40,
    
    "referenceImageMode": "variable",
    "referenceImageVariable": "{{输入节点.files[0].url}}",
    "referenceImage2Variable": "",
    "referenceImage3Variable": "",
    
    "output": {
      "imageUrl": "https://xxxxx.supabase.co/storage/v1/object/public/generated-images/1704038500000_def456.png"
    },
    "executionTime": 12300
  }
}
```

### 实现细节

**执行逻辑** (`ImageGenNodeExecutor`)：
1. 检查用户配额 (`image_gen_executions`)
2. 收集所有上游节点输出，构建变量上下文
3. 替换 `prompt` 和参考图变量中的 `{{变量}}` 占位符
4. 获取模型能力配置（Capabilities）
5. 根据模型能力过滤参数（如参考图、尺寸等）
6. 统一调用 `/api/generate-image` API 生成图片
    - 统一处理 `cfg` vs `guidance_scale` 参数映射
    - 统一处理参考图字段 (`image`, `image2`, `image3`)
7. API 调用 SiliconFlow 接口
8. API 将生成的图片下载并上传到 Supabase Storage 持久化存储
9. API 更新用户配额使用量
10. 返回永久 URL 作为输出

**数据流转**：

```
构建器配置 (Node Data)
      ↓
执行器 (Executor): 变量解析 & 参数准备
      ↓
API 路由 (/api): 鉴权, 配额检查, 参数映射
      ↓
SiliconFlow API: 图像生成
      ↓
Supabase Storage: 图片持久化
      ↓
输出结果 (Output): imageUrl
```

**关键接口定义** (`src/types/flow.ts`)：

```typescript
export interface ImageGenNodeData extends BaseNodeData {
  model?: string;           // e.g. "Kwai-Kolors/Kolors"
  prompt: string;           // 支持 {{变量}} 语法
  negativePrompt?: string;  
  imageSize?: string;       // e.g. "1024x1024"
  cfg?: number;             // 统一 CFG 值
  guidanceScale?: number;   // (兼容旧字段)
  numInferenceSteps?: number;    

  // 参考图配置 (图生图)
  referenceImageMode?: 'variable' | 'static';
  referenceImageUrl?: string;                   // static slot 1
  referenceImageUrl2?: string;                  // static slot 2
  referenceImageUrl3?: string;                  // static slot 3
  referenceImageVariable?: string;              // variable slot 1
  referenceImage2Variable?: string;             // variable slot 2
  referenceImage3Variable?: string;             // variable slot 3
}
```
