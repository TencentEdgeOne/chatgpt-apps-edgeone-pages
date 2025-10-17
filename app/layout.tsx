import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ChatGPT Apps EdgeOne Pages Example',
  description: 'A Next.js app using Model Context Protocol (MCP)',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
