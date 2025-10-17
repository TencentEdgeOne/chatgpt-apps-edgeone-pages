import type { Context } from 'hono'
import {
  JSONRPCMessageSchema,
  isJSONRPCError,
  isJSONRPCRequest,
  isJSONRPCResponse,
  type JSONRPCError,
  type JSONRPCMessage,
  type JSONRPCResponse,
  type MessageExtraInfo,
  type RequestId,
} from '@modelcontextprotocol/sdk/types.js'
import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { StatusCode } from 'hono/utils/http-status'

type PendingEntry = {
  resolve: (message: JSONRPCResponse | JSONRPCError) => void
  reject: (error: Error) => void
}

type JsonRpcErrorPayload = {
  jsonrpc: '2.0'
  id: RequestId | null
  error: {
    code: number
    message: string
  }
}

const createJsonRpcError = (code: number, message: string, id: RequestId | null): JsonRpcErrorPayload => ({
  jsonrpc: '2.0',
  id,
  error: {
    code,
    message,
  },
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * Minimal HTTP transport for MCP servers running behind Hono.
 *
 * This implementation intentionally omits SSE support and responds synchronously
 * to POST requests with the JSON-RPC responses produced by the MCP server.
 */
export class HttpJsonTransport implements Transport {
  private started = false
  private pending = new Map<RequestId, PendingEntry>()

  sessionId: string | undefined
  onclose: (() => void) | undefined
  onerror: ((error: Error) => void) | undefined
  onmessage: ((message: JSONRPCMessage, extra?: MessageExtraInfo) => void) | undefined

  async start() {
    if (this.started) {
      throw new Error('Transport already started')
    }
    this.started = true
  }

  async handleRequest(ctx: Context, parsedBody?: unknown): Promise<Response> {
    switch (ctx.req.method) {
      case 'POST':
        return this.handlePostRequest(ctx, parsedBody)
      case 'OPTIONS':
        return this.handleOptionsRequest(ctx)
      default:
        return this.handleUnsupportedRequest(ctx)
    }
  }

  async close(): Promise<void> {
    this.pending.forEach((entry) => {
      entry.reject(new Error('Transport closed'))
    })
    this.pending.clear()
    this.onclose?.()
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    let requestId = options?.relatedRequestId
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      requestId = message.id ?? requestId
    }

    if (requestId === undefined || requestId === null) {
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        throw new Error('HTTP transport requires request id to deliver responses')
      }
      // Notifications cannot be delivered without SSE support; ignore silently.
      return
    }

    const pending = this.pending.get(requestId)
    if (!pending) {
      if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
        throw new Error(`No pending HTTP request for id ${String(requestId)}`)
      }
      return
    }

    if (!isJSONRPCResponse(message) && !isJSONRPCError(message)) {
      // Non-response messages cannot be delivered in HTTP mode.
      return
    }

    this.pending.delete(requestId)
    pending.resolve(message)
  }

  private async handlePostRequest(ctx: Context, parsedBody?: unknown): Promise<Response> {
    try {
      const accept = ctx.req.header('Accept')
      if (accept) {
        const normalized = accept.toLowerCase()
        if (!normalized.includes('application/json') && !normalized.includes('*/*')) {
          return this.jsonError(
            ctx,
            406,
            -32000,
            'Not Acceptable: application/json required in Accept header',
          )
        }
      }

      const contentType = ctx.req.header('Content-Type')?.toLowerCase()
      if (!contentType || !contentType.includes('application/json')) {
        return this.jsonError(
          ctx,
          415,
          -32000,
          'Unsupported Media Type: Content-Type must be application/json',
        )
      }

      const authInfo = ctx.get('auth') as MessageExtraInfo['authInfo']
      const requestHeaders = Object.fromEntries(ctx.req.raw.headers.entries())
      const requestInfo: MessageExtraInfo['requestInfo'] = {
        headers: requestHeaders,
      } as MessageExtraInfo['requestInfo']

      let rawMessage = parsedBody
      if (rawMessage === undefined) {
        rawMessage = await ctx.req.json()
      }

      let messages: JSONRPCMessage[]
      if (Array.isArray(rawMessage)) {
        messages = rawMessage.map((msg) => JSONRPCMessageSchema.parse(msg))
      } else {
        messages = [JSONRPCMessageSchema.parse(rawMessage)]
      }

      const requests = messages.filter(isJSONRPCRequest)
      if (requests.length === 0) {
        for (const message of messages) {
          this.onmessage?.(message, { authInfo, requestInfo })
        }
        return ctx.newResponse(null, 202)
      }

      const responsePromises = requests.map((request) => {
        if (request.id === undefined) {
          throw new Error('JSON-RPC request is missing id')
        }
        return new Promise<JSONRPCResponse | JSONRPCError>((resolve, reject) => {
          this.pending.set(request.id, { resolve, reject })
        })
      })
      for (const message of messages) {
        this.onmessage?.(message, { authInfo, requestInfo })
      }

      const responses = await Promise.all(responsePromises)
      const payload: JSONRPCResponse | JSONRPCError | Array<JSONRPCResponse | JSONRPCError> =
        responses.length === 1 ? responses[0] : responses
      if (this.sessionId) {
        ctx.header('mcp-session-id', this.sessionId)
      }
      const negotiatedVersion = this.findProtocolVersion(payload)
      if (negotiatedVersion) {
        ctx.header('mcp-protocol-version', negotiatedVersion)
      }

      return ctx.json(payload)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.onerror?.(err)
      return this.jsonError(ctx, 400, -32700, 'Parse error', err)
    }
  }

  private handleOptionsRequest(ctx: Context): Response {
    const headers: HeadersInit = {
      Allow: 'POST, OPTIONS',
    }
    return ctx.newResponse(null, {
      status: 204,
      headers,
    })
  }

  private handleUnsupportedRequest(ctx: Context): Response {
    return ctx.newResponse(
      JSON.stringify(createJsonRpcError(-32000, 'Method not allowed.', null)),
      405,
      {
        Allow: 'POST, OPTIONS',
        'Content-Type': 'application/json',
      },
    )
  }

  private jsonError(ctx: Context, status: StatusCode, code: number, message: string, error?: Error) {
    if (error) {
      this.onerror?.(error)
    }
    return ctx.newResponse(JSON.stringify(createJsonRpcError(code, message, null)), status, {
      'Content-Type': 'application/json',
    })
  }

  private findProtocolVersion(
    payload: JSONRPCResponse | JSONRPCError | Array<JSONRPCResponse | JSONRPCError>,
  ): string | undefined {
    const inspect = (item: JSONRPCResponse | JSONRPCError) => {
      if (!('result' in item)) {
        return undefined
      }
      if (isRecord(item.result) && typeof item.result.protocolVersion === 'string') {
        return item.result.protocolVersion
      }
      return undefined
    }

    if (Array.isArray(payload)) {
      for (const item of payload) {
        const version = inspect(item)
        if (version) {
          return version
        }
      }
      return undefined
    }

    return inspect(payload)
  }
}
