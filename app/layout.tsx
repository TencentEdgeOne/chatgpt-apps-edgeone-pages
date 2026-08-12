import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ChatGPT Apps EdgeOne Pages Example | EdgeOne Makers',
  description: 'A Next.js app using Model Context Protocol (MCP) · Demo only · EdgeOne Makers',
  keywords: "EdgeOne Makers, Demo only",
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
