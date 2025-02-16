import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import './globals.css'
import { cn } from "@/lib/utils"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: 'Rock Paper Scissors',
  description: 'A multiplayer rock paper scissors game',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.className
      )}>
        <main className="relative flex min-h-screen flex-col">
          <div className="flex-1">{children}</div>
        </main>
        <Toaster />
      </body>
    </html>
  )
}
