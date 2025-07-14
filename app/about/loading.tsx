export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-16">
      <div className="max-w-2xl mx-auto animate-pulse">
        <div className="h-8 w-24 bg-gray-800 rounded mb-8"></div>
        <div className="h-12 w-48 bg-gray-800 rounded mb-8"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-800 rounded w-full"></div>
          <div className="h-4 bg-gray-800 rounded w-5/6"></div>
          <div className="h-4 bg-gray-800 rounded w-4/6"></div>
        </div>
      </div>
    </main>
  );
}