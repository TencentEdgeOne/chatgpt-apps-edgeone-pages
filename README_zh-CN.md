# ChatGPT Apps SDK EdgeOne Pages 起步项目

这是一个最小化的 EdgeOne Pages 项目，展示如何使用边缘函数构建兼容 [OpenAI Apps SDK](https://developers.openai.com/apps-sdk) 的 MCP 服务器，并将 ChatGPT 输出直接部署到 EdgeOne 静态站点。

## 部署

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?from=github&template=chatgpt-apps-edgeone-pages)

## 概览

![](./assets/s_2025-10-11_20-39-08.png)

本项目演示如何通过腾讯云 EdgeOne Pages + Functions 托管 MCP 服务器。只需一个 `functions/mcp/index.ts` 文件，就可以向 ChatGPT 暴露工具，实时部署 HTML 内容并返回可访问的公网地址。

## 核心能力

- **MCP 服务端**：基于 EdgeOne Functions 的无服务器 `onRequest` 处理入口。
- **一键部署**：`deploy_html` 工具接收 ChatGPT 生成的 HTML，并调用 EdgeOne API 发布静态资源。
- **跨域支持**：内置 CORS 逻辑，可兼容 ChatGPT iframe 及浏览器调试。

## 关键文件

- `functions/mcp/index.ts`：实现 MCP JSON-RPC，注册 `deploy_html` 工具并处理 `initialize`、`tools/list` 等请求。
- `index.html`：示例落地页，用于在部署成功后向访问者展示项目说明。

## 快速开始

### 1. 部署到 EdgeOne Pages

1. 点击上面一键部署
2. 部署完成后，控制台会分配一个域名，用于托管静态页面和 MCP 入口。

部署完成后，`index.html` 会在根路径展示说明页面，`functions/mcp/index.ts` 会自动映射到 `/mcp`。

## 在 ChatGPT 中连接

1. 确认账号已开通 ChatGPT Apps 开发者权限。
2. 打开 ChatGPT，依次进入 **Settings → [Connectors](https://chatgpt.com/#settings/Connectors) → Create**。
3. 将 EdgeOne Pages 的部署地址添加为 MCP 服务器，例如：
   ```
   https://<your-project-url>/mcp
   ```
4. 保存后即可在对话中调用 `deploy_html` 工具发布内容，ChatGPT 会返回托管在 EdgeOne 上的静态页面 URL。

## MCP 调用流程

1. ChatGPT 通过 MCP 协议请求 `/mcp`，触发 `initialize`、`tools/list` 等握手流程。
2. 用户调用 `deploy_html` 时，将 HTML 推送至 EdgeOne 部署接口。
3. EdgeOne 生成可公开访问的链接并返回，ChatGPT 会把该链接展示给用户。
4. 如果发生错误，服务会返回结构化的错误信息，便于 ChatGPT 和开发者调试。

## 项目结构

```
examples/chatgpt-apps-edgeone-pages/
├── functions/
│   └── mcp/
│       └── index.ts      # 基于 EdgeOne 的 MCP 函数
├── index.html            # 静态说明页面
└── README.md             # 英文使用指南
```

## 延伸阅读

- [OpenAI Apps SDK 文档](https://developers.openai.com/apps-sdk)
- [Model Context Protocol 规范](https://modelcontextprotocol.io)
- [EdgeOne Pages 与 Functions 指南](https://pages.edgeone.ai/document/pages-functions-overview)
- [ChatGPT 连接器创建指南](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)

如需扩展更多工具或资源，可在 `functions/mcp/index.ts` 中继续扩展 MCP 处理逻辑，EdgeOne Pages 会按需自动扩容计算能力。
