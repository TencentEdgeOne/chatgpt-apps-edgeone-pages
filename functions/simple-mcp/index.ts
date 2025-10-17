import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Hono } from 'hono';
import { HttpJsonTransport } from '../httpTransport';
import { z } from 'zod';

const app = new Hono().basePath('/');

// Your MCP server implementation
const mcpServer = new McpServer({
  name: 'edgeone-pages-edge-mcp-server',
  version: '1.0.0',
});

mcpServer.tool(
  'hello_world',
  'Returns a friendly greeting.',
  {
    name: z.string().describe(`The name of the person to greet.`),
  },
  async ({ name }) => ({
    content: [
      {
        type: 'text',
        text: `Hello from EdgeOne Pages! ${name}`,
      },
    ],
  })
);

app.all('/simple-mcp', async (c) => {
  try {
    const transport = new HttpJsonTransport();
    await mcpServer.connect(transport);
    return transport.handleRequest(c);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// EdgeOne Pages Functions export
export function onRequest(context: {
  request: Request;
  params: Record<string, string>;
  env: Record<string, any>;
}): Response | Promise<Response> {
  return app.fetch(context.request, context.env);
}
