import { Inter } from 'next/font/google'
import React from 'react'

import './styles.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = {
  description:
    'Registration, attendance, and acquisition for the April 2 office hours on AI for developers.',
  title: 'Webinar analytics · Zuddl',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
