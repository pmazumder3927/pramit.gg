"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

// "edit this entry ✎" — rendered only when the owner's session is on this
// device. getSession() is a local read (no network), so visitors pay nothing
// and see nothing; an expired session at worst links to the login redirect.
export function useOwnerSession() {
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) setIsOwner(true);
    });
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
