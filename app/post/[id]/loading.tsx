export default function PostLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen px-5 py-8 sm:px-6 md:px-8 md:py-16">
        <article className="max-w-2xl md:max-w-3xl lg:max-w-5xl mx-auto animate-pulse">
          {/* Back link skeleton */}
          <div className="h-4 w-28 bg-white/5 rounded mb-10" />

          {/* Header */}
          <header className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-6 w-16 bg-white/5 rounded-full" />
              <div className="h-4 w-24 bg-white/5 rounded" />
            </div>
            <div className="h-10 md:h-14 w-3/4 bg-white/5 rounded-lg mb-4" />
            <div className="h-10 md:h-14 w-1/2 bg-white/5 rounded-lg mb-8" />
            <div className="flex gap-2">
              <div className="h-7 w-16 bg-white/5 rounded-full" />
              <div className="h-7 w-20 bg-white/5 rounded-full" />
              <div className="h-7 w-14 bg-white/5 rounded-full" />
            </div>
          </header>

          {/* Content skeleton */}
          <div className="space-y-4">
            <div className="h-5 w-full bg-white/5 rounded" />
            <div className="h-5 w-full bg-white/5 rounded" />
            <div className="h-5 w-5/6 bg-white/5 rounded" />
            <div className="h-5 w-full bg-white/5 rounded" />
            <div className="h-5 w-3/4 bg-white/5 rounded" />
            <div className="h-8 w-0" />
            <div className="h-5 w-full bg-white/5 rounded" />
            <div className="h-5 w-full bg-white/5 rounded" />
            <div className="h-5 w-2/3 bg-white/5 rounded" />
          </div>
        </article>
      </main>
    </div>
  );
}
