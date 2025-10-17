export default function Home() {
  const renderedAt = new Date().toISOString()

  return (
    <div className="flex min-h-[600px] items-center justify-center px-6 py-12">
      <main className="w-full max-w-3xl rounded-2xl border border-slate-400/20 bg-slate-900/85 px-8 py-12 shadow-[0_24px_80px_rgba(15,23,42,0.45)] backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100 md:text-4xl">
          ChatGPT Apps SDK · EdgeOne Pages
        </h1>
        <p className="mt-4 text-slate-200/90">
          This is a minimal example that uses EdgeOne Pages Edge Functions to
          host a server compatible with the Model Context Protocol (MCP).
        </p>
        <p className="mt-6 font-semibold text-slate-100">Main capabilities of this project:</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-200/90">
          <li>Provides an MCP-compatible backend for ChatGPT connectors.</li>
          <li>Includes a Next.js page you can customize or replace.</li>
        </ul>
        <p className="text-slate-200/90">
          Want to try it? In ChatGPT{' '}
          <em>Settings → Connectors</em>{' '}
          add your EdgeOne Pages domain and invoke the publishing workflow to receive a live page URL.
        </p>
        <p className="text-slate-200/90">
          View the full source on GitHub:{' '}
          <a
            className="inline-flex items-center rounded-md bg-teal-600/20 px-2 py-1 font-mono text-sm text-teal-300 transition hover:bg-teal-600/30"
            href="https://github.com/TencentEdgeOne/chatgpt-apps-edgeone-pages"
            target="_blank"
            rel="noreferrer"
          >
            github.com/TencentEdgeOne/chatgpt-apps-edgeone-pages
          </a>
        </p>
        <p className="text-slate-200/90">
          This page renders on the server for every request. Server render timestamp:{' '}
          <strong>{renderedAt}</strong>
        </p>
      </main>
    </div>
  )
}
