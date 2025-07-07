// Structured data for Pramit Mazumder
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": "https://pramit.gg/#person",
      "name": "Pramit Mazumder",
      "url": "https://pramit.gg",
      "sameAs": [
        "https://github.com/pmazumder3927",
        "https://www.instagram.com/mazoomzoom/"
      ],
      "jobTitle": "Technologist",
      "knowsAbout": [
        "Reinforcement Learning",
        "Robotics", 
        "Machine Learning",
        "Bouldering",
        "Electronic Music Production",
        "Software Engineering"
      ],
      "email": "mailto:me@pramit.gg"
    },
    {
      "@type": "WebSite",
      "@id": "https://pramit.gg/#website",
      "url": "https://pramit.gg",
      "name": "Pramit Mazumder - pramit.gg",
      "description": "Pramit Mazumder's personal website - a living, evolving journal of interests in reinforcement learning, robotics, bouldering, and electronic music production",
      "publisher": {
        "@id": "https://pramit.gg/#person"
      },
      "inLanguage": "en-US"
    }
  ]
};

// Inject structured data into the page
if (typeof window !== 'undefined') {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(structuredData);
  document.head.appendChild(script);
}