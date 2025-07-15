import { Metadata } from 'next'
import AboutClient from './AboutClient'

export const metadata: Metadata = {
  title: 'About | pramit.gg',
  description: "Hey, I'm Pramit. This is my digital space — a living journal where I share things that capture my attention",
  openGraph: {
    title: 'About Pramit',
    description: "Hey, I'm Pramit. This is my digital space — a living journal where I share things that capture my attention",
    type: 'profile',
    firstName: 'Pramit',
    lastName: 'Mazumder',
  },
  alternates: {
    canonical: '/about',
  },
}

export default function About() {
  const content = {
    back: 'back',
    title: 'about',
    intro: "hey, i'm pramit. this is my digital space — a living journal where i share things that capture my attention",
    sections: [
      {
        title: 'current focus',
        items: [
          'building software that makes a difference',
          'climbing (v3-v4 on a good day)',
          'curating playlists that tell stories',
          'exploring the intersection of tech and creativity',
        ],
      },
      {
        title: 'what to expect',
        items: [
          'climbing beta and outdoor adventures',
          'music discoveries and playlist deep-dives',
          'thoughts on tech, design, and building things',
          'random musings that don\'t fit elsewhere',
        ],
      },
      {
        title: 'principles',
        items: [
          'authenticity over perfection',
          'curiosity as a compass',
          'creating > consuming',
          'embracing the journey',
        ],
      },
    ],
    footer: "thanks for stopping by. feel free to explore, and don't hesitate to reach out if something resonates.",
  }

  return (
    <div suppressHydrationWarning>
      <AboutClient content={content} serverRendered={true} />
    </div>
  )
} 