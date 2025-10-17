# ChatGPT Apps SDK EdgeOne Pages 起步项目

这是一个最小化的 EdgeOne Pages 项目，展示如何使用 Next.js 和边缘函数构建兼容 [OpenAI Apps SDK](https://developers.openai.com/apps-sdk) 的 MCP 服务器。

## 部署

[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?from=github&template=chatgpt-apps-edgeone-pages)

在线演示：https://chatgpt-apps-edgeone-pages.edgeone.run

## 概览

![](https://cdnstatic.tencentcs.com/edgeone/pages/assets/9DNtu-1760670100883.png)

本项目演示如何通过腾讯云 EdgeOne Pages + Functions 使用 Next.js 托管 MCP 服务器。MCP 服务器向 ChatGPT 暴露工具并使用结构化内容渲染小组件。

## 技术栈

- **Next.js 15**：使用 App Router 的 React 框架
- **Hono**：快速、轻量的 EdgeOne Functions Web 框架
- **MCP SDK**：Model Context Protocol 实现
- **Tailwind CSS**：实用优先的 CSS 框架
- **TypeScript**：类型安全开发

## 核心能力

- **MCP 服务端**：基于 EdgeOne Functions 使用 Hono 构建的无服务器 `onRequest` 处理入口
- **小组件支持**：`hello_stat` 工具使用结构化内容渲染动态小组件
- **跨域支持**：内置 CORS 逻辑，可兼容 ChatGPT iframe 及浏览器调试
- **Next.js 前端**：使用 Tailwind CSS 样式的现代 React UI

## 关键文件

- `functions/mcp/index.ts`：实现 MCP JSON-RPC，注册 `hello_stat` 工具并处理小组件渲染
- `functions/httpTransport.ts`：MCP 服务器的自定义 HTTP 传输层
- `app/page.tsx`：解释项目的 Next.js 落地页
- `app/layout.tsx`：包含全局样式的根布局
- `app/globals.css`：Tailwind CSS 配置和全局样式
- `edgeone.json`：EdgeOne Pages 配置（包含 CORS 头）

## 快速开始

### 1. 部署到 EdgeOne Pages

1. 点击上面的按钮一键部署
2. 部署完成后，控制台会分配一个域名，用于托管 Next.js 应用和 MCP 入口

部署完成后，Next.js 应用会在根路径提供服务，`functions/mcp/index.ts` 会自动映射到 `/mcp`。

## 在 ChatGPT 中连接

1. 确认账号已开通 ChatGPT Apps 开发者权限。
2. 打开 ChatGPT，依次进入 **Settings → [Connectors](https://chatgpt.com/#settings/Connectors) → Create**。
3. 将 EdgeOne Pages 的部署地址添加为 MCP 服务器，例如：
   ```
   https://<your-project-url>/mcp
   ```
4. 保存后即可在对话中调用 `hello_stat` 工具，使用你的名字渲染状态小组件。

## MCP 调用流程

1. ChatGPT 通过 MCP 协议请求 `/mcp`，触发 `initialize`、`tools/list` 等握手流程。
2. 用户调用 `hello_stat` 时，服务器返回包含标题/值/描述的结构化内容。
3. 小组件模板从 Next.js 应用根路径获取，并在 ChatGPT 中使用结构化数据渲染。
4. 如果发生错误，服务会返回结构化的错误信息，便于 ChatGPT 和开发者调试。

## 项目结构

```
examples/chatgpt-apps-edgeone-pages/
├── app/
│   ├── layout.tsx        # Next.js 根布局
│   ├── page.tsx          # 落地页
│   └── globals.css       # 使用 Tailwind 的全局样式
├── functions/
│   ├── mcp/
│   │   ├── index.ts      # 包含 hello_stat 工具的 MCP 服务器
│   │   └── [[default]].ts # 动态路由处理器
│   └── httpTransport.ts  # MCP 的自定义 HTTP 传输层
├── edgeone.json          # EdgeOne 配置
├── next.config.js        # Next.js 配置
└── tailwind.config.js    # Tailwind CSS 配置
```

## 延伸阅读

- [OpenAI Apps SDK 文档](https://developers.openai.com/apps-sdk)
- [Model Context Protocol 规范](https://modelcontextprotocol.io)
- [EdgeOne Pages 与 Functions 指南](https://pages.edgeone.ai/document/pages-functions-overview)
- [ChatGPT 连接器创建指南](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)

如需扩展更多工具或资源，可在 `functions/mcp/index.ts` 中继续扩展 MCP 处理逻辑，EdgeOne Pages 会按需自动扩容计算能力。
