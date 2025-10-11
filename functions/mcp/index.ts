const SESSION_ID_HEADER_NAME = 'mcp-session-id';
const JSON_RPC_VERSION = '2.0';
const SKYBRIDGE_MIME_TYPE = 'text/html+skybridge';
const DEPLOY_HTML_TOOL_NAME = 'deploy_html';
const DEFAULT_WIDGET_ID = 'show_content';

type JsonRpcId = string | number | null;

const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;

type ProtocolVersion = (typeof SUPPORTED_VERSIONS)[number];

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, any>;
};

type JsonRpcResponse =
  | {
      jsonrpc: typeof JSON_RPC_VERSION;
      id: JsonRpcId;
      result: Record<string, any>;
    }
  | {
      jsonrpc: typeof JSON_RPC_VERSION;
      id: JsonRpcId;
      error: {
        code: number;
        message: string;
        data?: Record<string, any>;
      };
    };

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  description: string;
  html: string;
};

type RequestContext = {
  origin: string;
  contentWidgetPromise?: Promise<ContentWidget>;
  protocolVersionHeader?: string;
  negotiatedProtocolVersion?: ProtocolVersion;
};

type EdgeOneRequestInit = RequestInit & {
  eo?: {
    timeoutSetting?: {
      connectTimeout?: number;
      readTimeout?: number;
      writeTimeout?: number;
    };
    [key: string]: unknown;
  };
};

const EDGEONE_TIMEOUT_SETTING = {
  connectTimeout: 30000,
  readTimeout: 30000,
  writeTimeout: 30000,
};

const looksLikePlaceholderHtml = (html: string) => {
  const s = html.trim();
  const hasHtmlTag = /<html[\s>]/i.test(s);
  const hasBodyContent = /<body[\s>][\s\S]*<\/body>/i.test(s);
  const isJustHelloWorld = /^[\s\S]*<h1[^>]*>\s*hello[,\s]*world[!\s]*<\/h1>[\s\S]*$/i.test(s) && s.length < 200;
  const tooShort = s.length < 100;
  return !hasHtmlTag || !hasBodyContent || isJustHelloWorld || tooShort;
};

const createCorsHeaders = (contentType?: string, originOverride?: string) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': originOverride ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': `Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, ${SESSION_ID_HEADER_NAME}`,
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'MCP-Protocol-Version',
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  headers['Vary'] = 'Origin';
  return headers;
};

const wrapWithHtmlRoot = (html: string) => {
  const trimmed = html.trim();
  if (/^\s*<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }
  return `<html lang="en">${trimmed}</html>`;
};

const STATIC_WIDGET_DOCUMENT = wrapWithHtmlRoot(`
  <head>
    <meta charset="UTF-8" />
    <title>EdgeOne Pages Deployment</title>
    <style>
      body { margin: 0; font-family: system-ui, sans-serif; padding: 24px; background: #0f172a; color: #e2e8f0; }
      .card { max-width: 640px; margin: 0 auto; padding: 32px; border-radius: 16px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(148, 163, 184, 0.2); }
      h1 { margin-top: 0; font-size: 1.8rem; }
      h2 { font-size: 1.2rem; margin: 16px 0 12px; }
      p { line-height: 1.5; margin: 12px 0; }
      a { color: #38bdf8; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .url-box { background: rgba(148, 163, 184, 0.1); padding: 16px; border-radius: 8px; margin: 16px 0; word-break: break-all; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>EdgeOne Pages Deployment</h1>
      <p data-status>Waiting for deployment...</p>

      <section data-deploy hidden>
        <h2>Deployment URL</h2>
        <div class="url-box">
          <a data-deploy-link target="_blank" rel="noopener noreferrer"></a>
        </div>
      </section>

      <p>Deployed at: <span data-timestamp>--</span></p>
    </div>
    <script type="module">
      const out = (window.openai ?? {}).toolOutput ?? {};
      const statusEl = document.querySelector("[data-status]");
      const tsEl = document.querySelector("[data-timestamp]");
      const deploySec = document.querySelector("[data-deploy]");
      const link = document.querySelector("[data-deploy-link]");

      const hasUrl = typeof out.url === "string" && out.url.trim().length > 0;

      if (hasUrl && link && deploySec) {
        link.href = out.url;
        link.textContent = out.url;
        deploySec.hidden = false;
        statusEl.textContent = "Deployment successful! Click the link below to visit your app.";
      } else {
        statusEl.textContent = "Waiting for deployment...";
      }

      try {
        tsEl.textContent = new Date(out.timestamp || Date.now()).toLocaleString();
      } catch { tsEl.textContent = out.timestamp || "--"; }
    </script>
  </body>
`);

const widgetResourceMeta = (widget: ContentWidget) =>
  ({
    'openai/widgetDescription':
      'Displays the public deployment URL for the HTML app deployed to EdgeOne Pages.',
    'openai/widgetPrefersBorder': true,
  } as const);

const applyEdgeOneDefaults = (init: EdgeOneRequestInit = {}) => {
  return {
    ...init,
    eo: {
      timeoutSetting: {
        ...EDGEONE_TIMEOUT_SETTING,
        ...(init.eo?.timeoutSetting ?? {}),
      },
      ...(init.eo ?? {}),
    },
  };
};

const edgeFetch = (input: RequestInfo | URL, init: EdgeOneRequestInit = {}) =>
  (fetch as any)(input, applyEdgeOneDefaults(init));

const createRequestContext = (request: Request): RequestContext => {
  const { origin } = new URL(request.url);
  const protocolVersionHeader =
    request.headers.get('mcp-protocol-version') ?? undefined;
  const negotiatedProtocolVersion =
    protocolVersionHeader &&
    SUPPORTED_VERSIONS.includes(protocolVersionHeader as ProtocolVersion)
      ? (protocolVersionHeader as ProtocolVersion)
      : undefined;
  return { origin, protocolVersionHeader, negotiatedProtocolVersion };
};

const getContentWidget = (context: RequestContext) => {
  if (!context.contentWidgetPromise) {
    context.contentWidgetPromise = Promise.resolve({
      id: DEFAULT_WIDGET_ID,
      title: 'Show Content',
      templateUri: 'ui://widget/content-template.html',
      invoking: '',
      invoked: '',
      description:
        'Displays the public deployment URL for the HTML app deployed to EdgeOne Pages.',
      html: STATIC_WIDGET_DOCUMENT,
    });
  }
  return context.contentWidgetPromise;
};

export async function deployHtml(value: string, baseUrl: string) {
  const res = await edgeFetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  });

  if (!res.ok) {
    throw new Error(`HTTP error: ${res.status} ${res.statusText}`);
  }

  const { url, error } = await res.json();

  if (error) {
    throw new Error(error);
  }

  if (!url) {
    throw new Error('Deployment response missing url');
  }

  return url as string;
}

const jsonRpcError = (
  id: JsonRpcId,
  code: number,
  message: string,
  data?: Record<string, any>
): JsonRpcResponse => ({
  jsonrpc: JSON_RPC_VERSION,
  id,
  error: { code, message, ...(data ? { data } : {}) },
});

const methodNotFound = (id: JsonRpcId): JsonRpcResponse =>
  jsonRpcError(id, -32601, 'Method not found');

const invalidRequest = (id: JsonRpcId, message = 'Invalid request') =>
  jsonRpcError(id, -32600, message);

const negotiateVersion = (requested?: string): ProtocolVersion => {
  if (requested && SUPPORTED_VERSIONS.includes(requested as ProtocolVersion)) {
    return requested as ProtocolVersion;
  }
  return SUPPORTED_VERSIONS[0];
};

const handleInitialize = (
  id: JsonRpcId,
  params: Record<string, any> | undefined,
  context: RequestContext
): JsonRpcResponse => {
  const requestedVersion =
    typeof params?.protocolVersion === 'string'
      ? (params.protocolVersion as string)
      : undefined;
  const negotiated = negotiateVersion(requestedVersion);
  context.negotiatedProtocolVersion = negotiated;

  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result: {
      protocolVersion: negotiated,
      serverInfo: {
        name: 'edgeone-pages-mcp-server',
        version: '1.0.0',
      },
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  };
};

const extractProtocolVersion = (
  payload: JsonRpcResponse | JsonRpcResponse[]
): string | undefined => {
  const inspect = (item: JsonRpcResponse) => {
    const version = (item as any)?.result?.protocolVersion;
    return typeof version === 'string' ? version : undefined;
  };

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const version = inspect(item);
      if (version) {
        return version;
      }
    }
    return undefined;
  }

  return inspect(payload);
};

const handleToolsList = async (
  id: JsonRpcId,
  context: RequestContext
): Promise<JsonRpcResponse> => {
  const widget = await getContentWidget(context);
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result: {
      tools: [
        {
          name: DEPLOY_HTML_TOOL_NAME,
          title: 'Deploy HTML',
          description:
            'Deploy a complete, working HTML application to EdgeOne Pages and get a public URL.',
          inputSchema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              value: {
                type: 'string',
                description:
                  'Complete HTML document starting with <html> tag, including any necessary CSS (in <style> tags) and JavaScript (in <script> tags) to make the application functional.',
              },
            },
            required: ['value'],
          },
          _meta: {
            'openai/outputTemplate': widget.templateUri,
            'openai/toolInvocation/invoking': 'Deploying HTML to EdgeOne Pages...',
            'openai/toolInvocation/invoked': 'Deployment successful',
            'openai/widgetAccessible': false,
          },
        },
      ],
    },
  };
};

const handleToolsCall = async (
  id: JsonRpcId,
  params: Record<string, any> | undefined,
  context: RequestContext
): Promise<JsonRpcResponse> => {
  const toolName = params?.name;
  const args = params?.arguments ?? {};

  if (typeof toolName !== 'string') {
    return invalidRequest(id, 'Tool name must be provided');
  }

  if (toolName === DEPLOY_HTML_TOOL_NAME) {
    const value = args?.value;
    if (typeof value !== 'string' || !value.trim()) {
      return invalidRequest(id, 'Missing required argument: value');
    }

    if (looksLikePlaceholderHtml(value)) {
      return jsonRpcError(
        id,
        -32602,
        'The provided HTML appears to be incomplete or a placeholder. Please provide a complete HTML document with proper structure (<html>, <head>, <body>) and content.',
        {
          hint: "The HTML should be a complete, working application, not just a 'Hello World' example or basic template.",
          provided_length: value.length,
        }
      );
    }

    try {
      const baseUrl = 'https://mcp.edgeone.site/kv/set'
      const url = await deployHtml(value, baseUrl);
      return {
        jsonrpc: JSON_RPC_VERSION,
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Deployment successful! Your app is now live at: ${url}`,
            },
          ],
          structuredContent: {
            mode: 'deploy',
            url,
            timestamp: new Date().toISOString(),
          },
        },
      };
    } catch (error: any) {
      const message = error?.message ?? 'Deployment failed';
      return jsonRpcError(id, -32001, message);
    }
  }

  return methodNotFound(id);
};

const handleResourcesList = async (
  id: JsonRpcId,
  context: RequestContext
): Promise<JsonRpcResponse> => {
  const widget = await getContentWidget(context);
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result: {
      resources: [
        {
          uri: widget.templateUri,
          name: widget.title,
          description: widget.description,
          mimeType: SKYBRIDGE_MIME_TYPE,
          _meta: widgetResourceMeta(widget),
        },
      ],
    },
  };
};

const handleResourcesRead = async (
  id: JsonRpcId,
  params: Record<string, any> | undefined,
  context: RequestContext
): Promise<JsonRpcResponse> => {
  const uri = params?.uri;
  if (typeof uri !== 'string') {
    return invalidRequest(id, 'Resource URI must be provided');
  }

  const widget = await getContentWidget(context);

  if (uri !== widget.templateUri) {
    return jsonRpcError(id, -32004, `Resource not found: ${uri}`);
  }

  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result: {
      contents: [
        {
          uri,
          mimeType: SKYBRIDGE_MIME_TYPE,
          text: widget.html,
          _meta: widgetResourceMeta(widget),
        },
      ],
    },
  };
};

const handlePromptsList = (id: JsonRpcId): JsonRpcResponse => ({
  jsonrpc: JSON_RPC_VERSION,
  id,
  result: {
    prompts: [],
  },
});

const handlePing = (id: JsonRpcId): JsonRpcResponse => ({
  jsonrpc: JSON_RPC_VERSION,
  id,
  result: {},
});

const processJsonRpcSingle = async (
  requestBody: JsonRpcRequest,
  context: RequestContext
): Promise<JsonRpcResponse | null> => {
  if (!requestBody || typeof requestBody !== 'object') {
    return invalidRequest(null);
  }

  if (Array.isArray(requestBody)) {
    return invalidRequest(null);
  }

  const hasId = Object.prototype.hasOwnProperty.call(requestBody, 'id');
  const id: JsonRpcId = hasId ? requestBody.id ?? null : null;

  if (requestBody.jsonrpc && requestBody.jsonrpc !== JSON_RPC_VERSION) {
    return invalidRequest(id);
  }

  const method = requestBody.method;
  if (typeof method !== 'string') {
    return invalidRequest(id);
  }

  if (!hasId) {
    if (method === 'notifications/initialized') {
      return null;
    }
    console.warn('Unsupported notification received:', method);
    return null;
  }

  try {
    switch (method) {
      case 'initialize':
        return handleInitialize(id, requestBody.params, context);
      case 'ping':
        return handlePing(id);
      case 'tools/list':
        return await handleToolsList(id, context);
      case 'tools/call':
        return await handleToolsCall(id, requestBody.params, context);
      case 'resources/list':
        return await handleResourcesList(id, context);
      case 'resources/read':
        return await handleResourcesRead(id, requestBody.params, context);
      case 'resources/get':
        return await handleResourcesRead(id, requestBody.params, context);
      case 'prompts/list':
        return handlePromptsList(id);
      default:
        return methodNotFound(id);
    }
  } catch (error: any) {
    console.error('Error processing JSON-RPC method:', method, error);
    const message = error?.message ?? 'Internal server error';
    return jsonRpcError(id, -32000, message);
  }
};

const processJsonRpcRequest = async (
  body: unknown,
  context: RequestContext
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> => {
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return invalidRequest(null, 'Batch request must not be empty');
    }
    const results = await Promise.all(
      body.map((item) => processJsonRpcSingle(item as JsonRpcRequest, context))
    );
    const filtered = results.filter(
      (result): result is JsonRpcResponse => result !== null
    );
    if (filtered.length === 0) {
      return null;
    }
    return filtered;
  }
  return processJsonRpcSingle(body as JsonRpcRequest, context);
};

const handleStreamingRequest = (origin?: string) => {
  const encoder = new TextEncoder();
  let keepAlive: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(': open\n\n'));
      controller.enqueue(
        encoder.encode('event: endpoint\ndata: {"url": "/mcp"}\n\n')
      );
      keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': ping\n\n'));
      }, 15000);
    },
    cancel() {
      if (keepAlive) {
        clearInterval(keepAlive);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: createCorsHeaders('text/event-stream; charset=utf-8', origin),
  });
};

const handleCorsRequest = (origin?: string) =>
  new Response(null, {
    status: 204,
    headers: createCorsHeaders(undefined, origin),
  });

const jsonResponse = (
  payload: JsonRpcResponse | JsonRpcResponse[],
  status = 200,
  origin?: string,
  extraHeaders: Record<string, string> = {}
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...createCorsHeaders('application/json', origin),
      ...extraHeaders,
    },
  });

const textResponse = (message: string, status = 200, origin?: string) =>
  new Response(message, {
    status,
    headers: createCorsHeaders('text/plain; charset=utf-8', origin),
  });

export const onRequest = async ({ request }: { request: Request }) => {
  const allowedOrigin = '*';

  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return handleCorsRequest(allowedOrigin);
  }

  if (
    method === 'GET' &&
    request.headers.get('accept')?.includes('text/event-stream')
  ) {
    return handleStreamingRequest(allowedOrigin);
  }

  if (method === 'GET') {
    return textResponse(
      'EdgeOne Pages MCP endpoint is active.',
      200,
      allowedOrigin
    );
  }

  if (method !== 'POST') {
    return textResponse('Method Not Allowed', 405, allowedOrigin);
  }

  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return textResponse('Unsupported Media Type', 415, allowedOrigin);
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Failed to parse request body:', error);
    return jsonResponse(
      jsonRpcError(null, -32700, 'Failed to parse JSON'),
      400,
      allowedOrigin
    );
  }

  const isJsonArray = Array.isArray(requestBody);
  const asObject =
    !isJsonArray && requestBody && typeof requestBody === 'object'
      ? (requestBody as Record<string, any>)
      : null;

  const hasId =
    !!asObject && Object.prototype.hasOwnProperty.call(asObject, 'id');
  const isNotification =
    !!asObject && typeof asObject.method === 'string' && !hasId;
  const isResponse =
    !!asObject &&
    (Object.prototype.hasOwnProperty.call(asObject, 'result') ||
      Object.prototype.hasOwnProperty.call(asObject, 'error'));

  if (isNotification && asObject?.method === 'notifications/initialized') {
    return new Response(null, {
      status: 202,
      headers: createCorsHeaders(undefined, allowedOrigin),
    });
  }

  if (isNotification || isResponse) {
    return new Response(null, {
      status: 202,
      headers: createCorsHeaders(undefined, allowedOrigin),
    });
  }

  const context = createRequestContext(request);

  try {
    const responseData = await processJsonRpcRequest(requestBody, context);
    if (responseData === null) {
      return new Response(null, {
        status: 202,
        headers: createCorsHeaders(undefined, allowedOrigin),
      });
    }
    const extraHeaders: Record<string, string> = {};
    const negotiated =
      context.negotiatedProtocolVersion ??
      extractProtocolVersion(
        responseData as JsonRpcResponse | JsonRpcResponse[]
      );
    if (negotiated) {
      extraHeaders['MCP-Protocol-Version'] = negotiated;
    }
    return jsonResponse(responseData, 200, allowedOrigin, extraHeaders);
  } catch (error) {
    console.error('Unhandled error processing request:', error);
    return jsonResponse(
      jsonRpcError(null, -32000, 'Internal server error'),
      500,
      allowedOrigin
    );
  }
};
