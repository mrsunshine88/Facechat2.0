import React, { Suspense } from 'react'
import type { Metadata } from 'next'

import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header'
import ProgressBar from '@/components/ProgressBar'
import PushManager from '@/components/PushManager'

import InstallPrompt from '@/components/InstallPrompt'

import { UserProvider } from '@/components/UserContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Facechat',
  description: 'Den digitala tidsmaskinen för vänner.',
  manifest: '/manifest.json?v=8',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Facechat',
  },
}

export const viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="sv">
      <body className={inter.className}>
        <UserProvider>
          <div className="app-container">
            <Suspense fallback={null}>
              <ProgressBar />
            </Suspense>
            <Header />

            <main className="main-content">

              {children}
            </main>
            <PushManager />
            <InstallPrompt />
          </div>
        </UserProvider>
      </body>
    </html>
  )
}
