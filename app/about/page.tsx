import { Metadata } from 'next'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn more about Pramit - a digital space sharing interests in reinforcement learning, robotics, bouldering, and electronic music production.',
  openGraph: {
    title: 'About | pramit.gg',
    description: 'Learn more about Pramit - a digital space sharing interests in reinforcement learning, robotics, bouldering, and electronic music production.',
    type: 'website',
  },
  alternates: {
    canonical: '/about',
  },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />
      
      <div className="relative z-10">
        <AboutContent />
      </div>
    </div>
  )
} 