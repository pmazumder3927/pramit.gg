# Welcome to pramit.gg: Building a Living Digital Journal

*Published: [DATE_PLACEHOLDER]*

Welcome to my corner of the internet. After months of tinkering, designing, and coding, I'm excited to share **pramit.gg** — a living, evolving journal of my interests, projects, and experiences. This isn't just another blog; it's a digital space that reflects both my technical curiosities and my belief that personal websites should feel truly personal.

## The Genesis: From GPT Prompt to Digital Reality

The journey began with a simple yet ambitious prompt to GPT: *"Create a spec sheet using everything you know about me."* This wasn't just a technical exercise — it was an attempt to translate my scattered interests, from reinforcement learning and robotics to bouldering and electronic music production, into a cohesive digital identity.

*[IMAGE_PLACEHOLDER: Screenshot of the original GPT conversation or spec sheet]*

What emerged was a blueprint for something more than a traditional blog. I wanted a space that could house technical writeups about my latest RL experiments, showcase climbing videos, embed my SoundCloud tracks, and display what I'm currently listening to on Spotify — all while maintaining a sophisticated, Apple-inspired aesthetic.

## The Architecture: Next.js Meets Modern Design

### The Tech Stack That Powers Everything

The foundation of pramit.gg is built on modern web technologies that prioritize both performance and developer experience:

- **Frontend**: Next.js 14 with App Router, TypeScript, and Tailwind CSS
- **Backend**: Supabase for database, authentication, and storage
- **Animations**: Framer Motion for sophisticated interactions
- **Music Integration**: Spotify Web API for real-time "Now Playing"
- **Media**: React Player for YouTube and SoundCloud embeds
- **Hosting**: Vercel for seamless deployment

*[IMAGE_PLACEHOLDER: Architecture diagram showing the tech stack]*

### The Design Philosophy: Apple-Inspired, Gone Rogue

From the beginning, I knew I wanted something that felt premium yet personal. The design draws heavy inspiration from Apple's sophisticated design language while maintaining a "gone rogue" aesthetic through bold color choices and experimental animations.

The color palette tells the story:
- **Void Black** (`#000000`) for that deep, premium feel
- **Charcoal Black** (`#0a0a0a`) for subtle variations
- **Accent Orange** (`#ff6b3d`) for warmth and energy
- **Accent Purple** (`#7c77c6`) for sophistication
- **Accent Blue** (`#4a9eff`) for that Apple-style trust

*[IMAGE_PLACEHOLDER: Color palette showcase]*

## The Unique Features That Make It Special

### 1. **Spotify Integration That Actually Works**

One of my favorite features is the real-time Spotify integration. The "Now Playing" widget in the footer isn't just decoration — it's a living piece of my digital identity. Whether I'm deep into a Boards of Canada session while coding or pumping up with some electronic beats, visitors can see what's currently soundtrack to my life.

*[IMAGE_PLACEHOLDER: Screenshot of the Spotify widget in both collapsed and expanded states]*

The widget features:
- Real-time updates every 30 seconds
- Expandable view with album art and progress bar
- Graceful fallback to "last played" when offline
- Direct links to Spotify for the full experience

### 2. **Apple-Inspired Animations with Personality**

Every interaction on the site has been carefully crafted with custom easing curves (`cubic-bezier(0.25, 0.1, 0.25, 1)`) that mirror Apple's sophisticated motion design. But here's where it gets interesting — I've added staggered animations that bring content to life in waves, creating a sense of organic emergence rather than mechanical appearance.

*[IMAGE_PLACEHOLDER: GIF or video showing the staggered animations on page load]*

### 3. **Featured Posts with Momentum Scrolling**

The homepage features a horizontal scrolling section for featured posts that implements iOS-style momentum scrolling. It's not just about the visual appeal — it's about creating a mobile-first experience that feels natural on every device.

*[IMAGE_PLACEHOLDER: Screenshot of the featured posts section]*

### 4. **Glass Morphism Meets Dark Mode**

The navigation and cards throughout the site use glass morphism effects with `backdrop-blur-3xl` and subtle gradients. Combined with the dark theme, it creates depth and sophistication that feels both modern and timeless.

*[IMAGE_PLACEHOLDER: Close-up of glass morphism effects]*

## The Technical Journey: From Prototype to Production

### Phase 1: Cursor-Assisted Prototyping

Using Cursor, I rapidly prototyped different layouts and component structures. The AI-assisted development allowed me to focus on the creative aspects while quickly iterating on the technical implementation. This phase was crucial for establishing the design system and component architecture.

*[IMAGE_PLACEHOLDER: Screenshot of Cursor in action with the project]*

### Phase 2: The Great Redesign

What started as a basic dark theme evolved into something much more sophisticated. The `DESIGN_TRANSFORMATION.md` file in the project documents this evolution — from basic cards to sophisticated interactive elements, from simple layouts to the current responsive grid system.

Key improvements included:
- Proper desktop centering with `max-w-7xl mx-auto`
- Responsive grid system: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Enhanced typography with `font-extralight` and gradient text effects
- Advanced animation system with staggered reveals

### Phase 3: The Wiring and Polish

The final phase involved connecting all the pieces — setting up Supabase for content management, implementing the Spotify API integration, and adding the rich markdown editor for post creation. Each component was carefully optimized for performance and accessibility.

*[IMAGE_PLACEHOLDER: Screenshot of the admin dashboard or content management interface]*

## The Secret Dashboard: A Hidden Feature

Sharp-eyed visitors might notice something special. The site includes a hidden admin dashboard that can be accessed through a specific key combination. It's built with the same attention to detail as the rest of the site, featuring the markdown editor and post management tools.

*[IMAGE_PLACEHOLDER: Screenshot of the secret dashboard (if you want to reveal it)]*

## What Makes This Different

### Living, Not Static

Unlike traditional blogs that feel frozen in time, pramit.gg is designed to evolve. The Spotify integration means the site's personality changes with my mood and current interests. New posts appear in a dynamic grid that reorganizes itself. The site literally grows and changes as I do.

### Content Variety

The site is built to handle diverse content types:
- Technical writeups with syntax highlighting
- Video embeds from YouTube and other platforms
- SoundCloud integrations for my music projects
- Photography and visual content
- Mathematical notation with KaTeX support

### Performance First

Despite all the animations and integrations, the site is optimized for performance:
- Server-side rendering with Next.js 14
- Optimized images with Next.js Image component
- Efficient bundle splitting
- Minimal JavaScript footprint

*[IMAGE_PLACEHOLDER: Lighthouse performance scores]*

## The Future: What's Next

This is just the beginning. The site is designed to grow with me as my interests evolve. Some ideas on the horizon:

- **Interactive Projects**: Embedding live demos of my RL experiments
- **Climbing Log**: Integration with climbing apps to showcase recent sends
- **Music Production**: Dedicated section for my electronic music projects
- **Learning Notes**: A space for documenting my exploration of new technologies

## Building Your Own

The beauty of this approach is that it's replicable. The combination of GPT for ideation, Cursor for rapid prototyping, and modern web technologies creates a powerful workflow for building personal digital spaces.

If you're inspired to build your own, here are the key principles:

1. **Start with identity**: What makes you unique? Build around that.
2. **Choose technologies you enjoy**: You'll be more motivated to iterate and improve.
3. **Design for evolution**: Your site should grow with you.
4. **Add personal touches**: The small details make all the difference.

*[IMAGE_PLACEHOLDER: Code snippet showing a key component or function]*

## Conclusion

pramit.gg represents more than just a website — it's a digital extension of my identity, a playground for technical experimentation, and a space for sharing what I'm passionate about. It's Apple-inspired but rebellious, sophisticated but personal, technical but accessible.

Welcome to my digital journal. I hope you'll stick around as it evolves, because like me, it's always learning, always growing, and always becoming something new.

---

*Want to connect? You can find me on [GitHub](https://github.com/pmazumder3927), [Instagram](https://www.instagram.com/mazoomzoom/), or drop me an email at [me@pramit.gg](mailto:me@pramit.gg). And if you're curious about what I'm currently listening to, just check the footer — it's probably something good.*

*This post was written with the help of Claude, because even in sharing the story of building something personal, the best tools are the ones that help us express ourselves more clearly.*