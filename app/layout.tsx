import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Supplier Quote System',
  description: 'Internal supplier quote management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100">{children}</body>
    </html>
  )
}
