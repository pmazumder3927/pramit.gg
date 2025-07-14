import { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
  title: 'About | pramit.gg',
  description: 'Learn more about Pramit Mazumder - interests in reinforcement learning, robotics, bouldering, and electronic music production.',
  openGraph: {
    title: 'About Pramit Mazumder',
    description: 'Learn more about Pramit Mazumder - interests in reinforcement learning, robotics, bouldering, and electronic music production.',
    type: 'profile',
  },
  alternates: {
    canonical: '/about',
  },
}

export default function AboutPage() {
  return (
    <>
      <AboutClient />
      
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: "Pramit Mazumder",
            url: "https://pramit.gg",
            email: "me@pramit.gg",
            sameAs: [
              "https://github.com/pramit",
              "https://www.instagram.com/mazoomzoom/"
            ],
            jobTitle: "Developer",
            description: "Interested in reinforcement learning, robotics, bouldering, and electronic music production",
          }),
        }}
      />
    </>
  )
} 