import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function Home() {
  return (
    <>
      <Head>
        <title>ChatGPT Apps EdgeOne Pages Example</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.container}>
        <main className={styles.main}>
          <h1 className={styles.title}>ChatGPT Apps SDK · EdgeOne Pages</h1>
          <p className={styles.description}>
            This is a minimal example that uses Tencent Cloud EdgeOne Functions to
            host a server compatible with the Model Context Protocol (MCP) and
            publishes ChatGPT outputs to EdgeOne Pages in real time.
          </p>
          <p>Main capabilities of this project:</p>
          <ul className={styles.list}>
            <li><strong>MCP tools</strong>: exposes a JSON-RPC service at <code className={styles.code}>/mcp</code>.</li>
            <li>
              <strong>deploy_html</strong>: uploads the HTML returned by ChatGPT to EdgeOne Pages and provides a link.
            </li>
            <li>
              <strong>Static info page</strong>: this page confirms the deployment succeeded and can be replaced as needed.
            </li>
          </ul>
          <p>
            Want to try it? In ChatGPT{' '}
            <em>Settings → Connectors</em>{' '}
            add your EdgeOne Pages domain pointing to <code className={styles.code}>/mcp</code>, then call
            the <code className={styles.code}>deploy_html</code> tool to receive a live page URL.
          </p>
        </main>
      </div>
    </>
  )
}