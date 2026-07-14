"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// "edit this entry ✎" — rendered only when the owner's session is on this
// device. getSession() is a local read (no network), so visitors pay nothing
// and see nothing; an expired session at worst links to the login redirect.
// The supabase client is imported lazily so visitors never download it as
// part of the page's first-load bundle.
export function useOwnerSession() {
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    let cancelled = false;
    import("@/app/lib/supabase-browser").then(({ supabase }) =>
      supabase.auth.getSession().then(({ data }) => {
        if (!cancelled && data.session) setIsOwner(true);
      })
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return isOwner;
}

export default function OwnerEditLink({
  postId,
  className = "",
}: {
  postId: string;
  className?: string;
}) {
  const isOwner = useOwnerSession();
  if (!isOwner) return null;
  return (
    <Link
      href={`/write/${postId}`}
      className={`font-hand text-lg text-ink-faint transition-colors hover:text-accent-rust ${className}`}
    >
      edit this entry ✎
    </Link>
  );
}
