---
name: webapp-testing
description: 使用 Playwright 交互和测试本地 Web 应用程序的工具包。支持验证前端功能、调试 UI 行为、捕获浏览器截图以及查看浏览器日志。
license: Complete terms in LICENSE.txt
---

# Web 应用程序测试 (Web Application Testing)

要测试本地 Web 应用程序，请编写原生的 Python Playwright 脚本。

**可用辅助脚本 (Helper Scripts Available)**：
- `scripts/with_server.py` - 管理服务器生命周期（支持多个服务器）

**始终先使用 `--help` 运行脚本**以查看用法。不要阅读源代码，除非你先尝试运行脚本并发现绝对需要定制的解决方案。这些脚本可能非常大，因此会污染你的上下文窗口。它们的存在是为了作为黑盒脚本直接调用，而不是被摄入到你的上下文窗口中。

## 决策树：选择你的方法 (Decision Tree: Choosing Your Approach)

```
用户任务 task → 是静态 HTML 吗？
    ├─ 是 → 直接读取 HTML 文件以识别选择器
    │         ├─ 成功 → 使用选择器编写 Playwright 脚本
    │         └─ 失败/不完整 → 视为动态（见下文）
    │
    └─ 否（动态 webapp） → 服务器已经在运行了吗？
        ├─ 否 → 运行：python scripts/with_server.py --help
        │        然后使用辅助脚本 + 编写简化的 Playwright 脚本
        │
        └─ 是 → “侦察-即-行动” (Reconnaissance-then-action)：
            1. 导航并等待 networkidle
            2. 截图或检查 DOM
            3. 从渲染状态中识别选择器
            4. 使用发现的选择器执行操作
```

## 示例：使用 with_server.py

要做启动服务器，先运行 `--help`，然后使用辅助脚本：

**单服务器：**
```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_automation.py
```

**多服务器（例如：后端 + 前端）：**
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_automation.py
```

要创建自动化脚本，只包含 Playwright 逻辑（服务器会自动管理）：
```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True) # 始终以无头模式启动 chromium
    page = browser.new_page()
    page.goto('http://localhost:5173') # 服务器已运行并就绪
    page.wait_for_load_state('networkidle') # 关键：等待 JS 执行
    # ... 你的自动化逻辑
    browser.close()
```

## “侦察-即-行动”模式 (Reconnaissance-Then-Action Pattern)

1.  **检查渲染后的 DOM**：
    ```python
    page.screenshot(path='/tmp/inspect.png', full_page=True)
    content = page.content()
    page.locator('button').all()
    ```

2.  **从检查结果中识别选择器**

3.  **使用发现的选择器执行操作**

## 常见陷阱 (Common Pitfall)

❌ **不要** 在动态应用上等待 `networkidle` 之前检查 DOM
✅ **务必** 在检查之前等待 `page.wait_for_load_state('networkidle')`

## 最佳实践 (Best Practices)

- **将捆绑脚本作为黑盒使用** - 要完成任务，考虑 `scripts/` 中可用的脚本是否有帮助。这些脚本可靠地处理常见、复杂的工作流，而不会弄乱上下文窗口。使用 `--help` 查看用法，然后直接调用。
- 对同步脚本使用 `sync_playwright()`
- 完成后始终关闭浏览器
- 使用描述性选择器：`text=`, `role=`, CSS 选择器, 或 IDs
- 添加适当的等待：`page.wait_for_selector()` 或 `page.wait_for_timeout()`

## 参考文件 (Reference Files)

- **examples/** - 展示常见模式的示例：
  - `element_discovery.py` - 发现页面上的按钮、链接和输入框
  - `static_html_automation.py` - 对本地 HTML 使用 file:// URLs
  - `console_logging.py` - 在自动化过程中捕获控制台日志
