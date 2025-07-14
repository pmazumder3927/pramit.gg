import { getPosts } from "@/app/lib/server-actions";
import HomeClient from "@/app/components/HomeClient";

export const metadata = {
  alternates: {
    canonical: '/',
  },
};

export default async function Home() {
  const posts = await getPosts();
  
  return (
    <>
      <HomeClient 
        initialPosts={posts}
        featuredPosts={posts.slice(0, 3)}
        remainingPosts={posts.slice(3)}
      />
      
      {/* JSON-LD structured data for the homepage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "pramit.gg",
            url: "https://pramit.gg",
            description: "a living, evolving journal of interests, projects, and experiences",
            author: {
              "@type": "Person",
              name: "Pramit",
              url: "https://pramit.gg/about"
            },
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: "https://pramit.gg/search?q={search_term_string}"
              },
              "query-input": "required name=search_term_string"
            }
          }),
        }}
      />
    </>
  );
}
