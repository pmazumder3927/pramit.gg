import { Metadata } from 'next'
import AboutContent from './AboutContent'

export const metadata: Metadata = {
  title: 'About Pramit Mazumder - pramit.gg',
  description: 'Learn more about Pramit Mazumder - interests in reinforcement learning, robotics, bouldering, and electronic music production',
  openGraph: {
    title: 'About Pramit Mazumder',
    description: 'Learn more about Pramit Mazumder - technologist exploring reinforcement learning, robotics, and creative pursuits',
    url: 'https://pramit.gg/about',
  },
}

export default function About() {
  return <AboutContent />
} 