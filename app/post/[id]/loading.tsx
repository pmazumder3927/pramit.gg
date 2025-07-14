import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />
      
      <LoadingSpinner isLoading={true} fullscreen={true} />
    </div>
  );
}