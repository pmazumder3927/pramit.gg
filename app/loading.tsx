import LoadingSpinner from "@/app/components/LoadingSpinner";

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-void-black via-charcoal-black to-void-black flex items-center justify-center z-50">
      <LoadingSpinner isLoading={true} type="navigation" />
    </div>
  );
}