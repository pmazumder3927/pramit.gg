import { Metadata } from 'next'
import ConnectClient from './ConnectClient'

export const metadata: Metadata = {
  title: 'Connect | pramit.gg',
  description: 'Get in touch with Pramit Mazumder - connect through social media, email, or leave an anonymous message.',
  openGraph: {
    title: 'Connect - pramit.gg',
    description: 'Get in touch with Pramit Mazumder - connect through social media, email, or leave an anonymous message.',
    type: 'website',
  },
  alternates: {
    canonical: '/connect',
  },
}

export default function ConnectPage() {
  return (
    <>
      <ConnectClient />
      
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Connect - pramit.gg",
            description: "Contact and connect with Pramit Mazumder",
            url: "https://pramit.gg/connect",
            mainEntity: {
              "@type": "Person",
              name: "Pramit Mazumder",
              email: "me@pramit.gg",
              url: "https://pramit.gg",
              sameAs: [
                "https://www.instagram.com/mazoomzoom/",
                "https://github.com/pramit"
              ]
            }
          }),
        }}
      />
    </>
  )
}