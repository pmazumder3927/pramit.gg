import { Metadata } from 'next'
import ConnectClient from './ConnectClient'

export const metadata: Metadata = {
  title: 'Connect | pramit.gg',
  description: 'Get in touch, share ideas, or just say hello. Connect with me through various channels.',
  openGraph: {
    title: 'Connect - pramit.gg',
    description: 'Get in touch, share ideas, or just say hello. Connect with me through various channels.',
    type: 'website',
  },
  alternates: {
    canonical: '/connect',
  },
}

export default function ConnectPage() {
  return (
    <div suppressHydrationWarning>
      <ConnectClient serverRendered={true} />
    </div>
  )
}