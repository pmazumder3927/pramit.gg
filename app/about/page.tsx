import { Metadata } from 'next'
import AboutClient from '@/app/components/AboutClient'

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn more about Pramit Mazumder - Software Engineer passionate about AI, robotics, and creative technology.',
  openGraph: {
    title: 'About Pramit Mazumder',
    description: 'Learn more about Pramit Mazumder - Software Engineer passionate about AI, robotics, and creative technology.',
    url: 'https://pramit.gg/about',
  },
}

export default function About() {
  return <AboutClient />
} 