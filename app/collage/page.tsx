import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { fetchLatestHomepageBanner } from "@/app/lib/homepage-banner";
import { createPublicClient } from "@/utils/supabase/server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "the collage",
  description:
    "every confession in the booth comes with a sketch. they all end up here.",
};

export default async function CollagePage() {
  const banner = await fetchLatestHomepageBanner(createPublicClient());

  return (
    <main className="relative min-h-screen page-reveal">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-32 pt-20 md:px-10 md:pt-32">
        <header className="mb-10 md:mb-16">
          <p className="text-xs uppercase tracking-[0.32em] text-white/40">
            the confessional booth
          </p>
          <h1 className="mt-4 text-4xl font-extralight tracking-tight text-white md:text-6xl">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              the collage
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-base font-light leading-relaxed text-white/60 md:text-lg">
            every confession comes with a sketch. they all end up
            here, painted into one scene.
          </p>
        </header>

        {banner ? (
          <figure className="relative">
            <div className="overflow-hidden rounded-3xl border border-white/10 shadow-[0_40px_140px_-40px_rgba(120,119,198,0.45)]">
              <div className="relative aspect-[3/2]">
                <Image
                  src={banner.image_url}
                  alt="painted collage of sketches from the confessional"
                  fill
                  priority
                  sizes="(min-width: 1280px) 1280px, 100vw"
                  className="object-cover"
                />
              </div>
            </div>
            <figcaption className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.28em] text-white/40">
              <span>
                {banner.sketch_count} sketch
                {banner.sketch_count === 1 ? "" : "es"}
              </span>
              <span>·</span>
              <time dateTime={banner.created_at}>
                {new Date(banner.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span>·</span>
              <span>painted by gpt-image-2</span>
            </figcaption>
          </figure>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <p className="text-lg font-light text-white/60">
              no collage yet.
            </p>
            <p className="mt-2 text-sm text-white/40">
              this page fills in once a few sketches land in the booth.
            </p>
          </div>
        )}

        <section className="mt-20 flex flex-col items-center gap-3 text-center md:mt-28">
          <p className="text-sm font-light text-white/50">
            want to add to it?
          </p>
          <Link
            href="/connect"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-2.5 text-sm font-light text-white/80 transition hover:border-white/30 hover:text-white"
          >
            leave a confession
            <span aria-hidden>→</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
