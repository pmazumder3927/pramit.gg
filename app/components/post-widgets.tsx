// Generalized post-widget system.
//
// Blog posts can embed interactive/custom visuals as HTML custom tags (e.g.
// <noise-frontier></noise-frontier>). This module is the single, generic bridge
// the shared markdown renderer (app/post/[id]/PostMarkdown.tsx) talks to — it
// knows nothing about any specific post.
//
// To add figures for a NEW post: make a pack (a FigureDef[]) and add it to
// `packs`. The renderer never needs to change, and a post that doesn't use a
// tag never downloads its code — PROVIDED the pack's next/dynamic imports live
// in a "use client" module (see openaim's FigureSlot). This catalog is read by
// the server-rendered post body, and dynamic() evaluated in the RSC graph is
// not a split point: the bundler folds every figure into the shared post
// chunk. The writing room reads the SAME catalog (label/blurb/kind) to make
// figures browsable and insertable — see app/write/Figures.tsx.

import type { ComponentType, ReactElement } from "react";
import { openaimFigures } from "@/app/components/openaim/registry";

/** interactive = it responds to the reader; diagram = a static (theme-aware) figure. */
export type FigureKind = "interactive" | "diagram";

/** One embeddable figure: its custom tag, how to describe it, and its component. */
export type FigureDef = {
  /** the custom HTML tag, e.g. "noise-frontier" (no angle brackets) */
  tag: string;
  /** human name shown in the picker + on the in-editor plate */
  label: string;
  /** one-line description shown in the picker */
  blurb: string;
  kind: FigureKind;
  /** the component to render (self-contained, takes no props) */
  component: ComponentType;
};

const packs: FigureDef[][] = [
  openaimFigures,
  // future post packs go here
];

/** the full catalog, in insertion-menu order. */
export const postWidgetCatalog: FigureDef[] = packs.flat();

/** tag → definition, for O(1) lookups (plate labels, validation). */
export const postWidgetByTag: Record<string, FigureDef> = Object.fromEntries(
  postWidgetCatalog.map((d) => [d.tag, d]),
);

/** tagName → component, merged across all packs. */
export const postWidgets: Record<string, ComponentType> = Object.fromEntries(
  postWidgetCatalog.map((d) => [d.tag, d.component]),
);

/** the custom tag names, so the renderer can treat them as block-level. */
export const postWidgetTags: string[] = postWidgetCatalog.map((d) => d.tag);

/** ready to spread into react-markdown's `components` map. Figures are
 *  self-contained and take no props, so each tag just renders its component. */
export const postWidgetComponents: Record<string, () => ReactElement> =
  Object.fromEntries(
    postWidgetCatalog.map((d) => {
      const Cmp = d.component;
      return [d.tag, () => <Cmp />];
    }),
  );
