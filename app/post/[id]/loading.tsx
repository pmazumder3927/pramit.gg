export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen px-4 py-8 md:px-8 md:py-16">
        <article className="max-w-4xl mx-auto">
          {/* Title skeleton */}
          <div className="animate-pulse mb-8">
            <div className="h-12 bg-white/5 rounded-lg w-3/4 mb-4"></div>
            <div className="h-6 bg-white/5 rounded-lg w-1/2"></div>
          </div>
          
          {/* Content skeleton */}
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-white/5 rounded w-full"></div>
            <div className="h-4 bg-white/5 rounded w-5/6"></div>
            <div className="h-4 bg-white/5 rounded w-4/6"></div>
            <div className="h-32 bg-white/5 rounded-lg my-6"></div>
            <div className="h-4 bg-white/5 rounded w-full"></div>
            <div className="h-4 bg-white/5 rounded w-3/4"></div>
          </div>
        </article>
      </main>
    </div>
  );
}