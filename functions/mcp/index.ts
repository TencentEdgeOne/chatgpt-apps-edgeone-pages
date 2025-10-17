import { Hono } from 'hono';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HttpJsonTransport } from '../httpTransport';

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  description: string;
  widgetDomain: string;
  html: string;
  sourceKey?: string;
};

const DEFAULT_WIDGET_HTML = /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Hello Stat</title>
    <style>
      body { font-family: ui-sans-serif, system-ui; margin: 0; padding: 12px; }
      .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
      .title { font-size: 14px; color: #6b7280; }
      .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
      .desc { margin-top: 8px; color: #4b5563; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title" id="title">—</div>
      <div class="value" id="value">—</div>
      <div class="desc" id="desc">—</div>
    </div>
    <script>
      function render(globals) {
        try {
          const data = globals?.structuredContent || {};
          document.getElementById('title').textContent = data.title ?? 'Hello Stat';
          document.getElementById('value').textContent = data.value ?? '—';
          document.getElementById('desc').textContent = data.description ?? '';
        } catch (e) {
          console.error(e);
        }
      }

      const init = () => {
        const g = window.openai?.state?.globals;
        if (g) render(g);

        window.addEventListener('openai:set_globals', (ev) => {
          render(ev.detail);
        }, false);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
    </script>
  </body>
</html>
`;

const wrapWithHtmlRoot = (html: string) => {
  const trimmed = html.trim();
  if (/^\s*<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<html>${trimmed}</html>`;
};

const getAppsSdkCompatibleHtml = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch widget template from ${url}: ${response.status} ${response.statusText}`
    );
  }
  return await response.text();
};

const updateWidgetHtml = async (origin: string, widget: ContentWidget) => {
  try {
    const target = new URL('/', origin).toString();
    if (widget.html && widget.sourceKey === target) {
      return;
    }

    const html = await getAppsSdkCompatibleHtml(target);
    if (html.trim().length > 0) {
      widget.html = html;
      widget.sourceKey = target;
      return;
    }
  } catch (error) {
    console.error('[mcp] Failed to fetch stat widget template:', error);
  }

  if (!widget.html) {
    widget.html = DEFAULT_WIDGET_HTML;
    widget.sourceKey = undefined;
  }
};

const contentWidget: ContentWidget = {
  id: 'stat_widget',
  title: 'Hello Stat Widget',
  templateUri: 'ui://widget/stat.html',
  invoking: 'Building your stat…',
  invoked: 'Stat is ready',
  description: 'Render a simple stat widget with title/value/description.',
  widgetDomain: 'https://nextjs.org/docs',
  html: DEFAULT_WIDGET_HTML,
};

const widgetMeta = (widget: ContentWidget) =>
  ({
    'openai/outputTemplate': widget.templateUri,
    'openai/toolInvocation/invoking': widget.invoking,
    'openai/toolInvocation/invoked': widget.invoked,
    'openai/widgetAccessible': false,
    'openai/resultCanProduceWidget': true,
  } as const);

const mcpServer = new McpServer(
  { name: 'edgeone-pages-chatgpt-apps-server', version: '1.0.0' },
  { capabilities: { tools: {}, experimental: {} } }
);

mcpServer.registerResource(
  contentWidget.id,
  contentWidget.templateUri,
  {
    title: contentWidget.title,
    description: contentWidget.description,
    mimeType: 'text/html+skybridge',
    _meta: {
      'openai/widgetDescription': contentWidget.description,
      'openai/widgetPrefersBorder': true,
    },
  },
  async () => ({
    contents: [
      {
        uri: contentWidget.templateUri,
        mimeType: 'text/html+skybridge',
        text: wrapWithHtmlRoot(contentWidget.html),
        _meta: {
          'openai/widgetDescription': contentWidget.description,
          'openai/widgetPrefersBorder': true,
          'openai/widgetDomain': contentWidget.widgetDomain,
        },
      },
    ],
  })
);

const helloStatInput = {
  name: z.string().min(1).optional(),
};

mcpServer.registerTool(
  'hello_stat',
  {
    title: 'Hello Stat',
    description: 'Return a small stat widget that greets the user.',
    inputSchema: helloStatInput,
    _meta: widgetMeta(contentWidget),
  },
  async ({ name }) => {
    const who = name ?? 'World';
    const now = new Date().toLocaleString('en-US', { hour12: false });
    const internalId =
      globalThis.crypto?.randomUUID?.() ??
      `stat-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      structuredContent: {
        title: 'Welcome',
        value: who,
        description: `Rendered at ${now}`,
      },
      content: [
        { type: 'text', text: `Hello, ${who}! Here is your stat widget.` },
      ],
      _meta: {
        ...widgetMeta(contentWidget),
        internalId,
      },
    };
  }
);

const app = new Hono().basePath('/');

app.all('/mcp', async (c) => {
  try {
    if (c.req.method === 'POST') {
      try {
        const origin = new URL(c.req.url).origin;
        await updateWidgetHtml(origin, contentWidget);
      } catch (error) {
        console.warn('[mcp] Unable to refresh widget template:', error);
      }
    }

    const transport = new HttpJsonTransport();
    await mcpServer.connect(transport);
    return transport.handleRequest(c);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: message }, 500);
  }
});

export function onRequest(context: {
  request: Request;
  params: Record<string, string>;
  env: Record<string, any>;
}): Response | Promise<Response> {
  return app.fetch(context.request, context.env);
}
