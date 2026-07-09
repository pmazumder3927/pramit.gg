// Generalized post-widget system.
//
// Blog posts can embed interactive/custom visuals as HTML custom tags (e.g.
// <noise-frontier></noise-frontier>). This module is the single, generic bridge
// the shared markdown renderer (app/post/[id]/PostContent.tsx) talks to — it
// knows nothing about any specific post.
//
// To add widgets for a NEW post: make a pack (a Record<tagName, Component>,
// ideally using next/dynamic so its code is code-split) and add it to `packs`.
// PostContent never needs to change, and because every pack entry is a dynamic
// split point, a post that doesn't use a tag never downloads its code.

import type { ComponentType, ReactElement } from "react";
import { openaimWidgets } from "@/app/components/openaim/registry";

const packs: Record<string, ComponentType>[] = [
  openaimWidgets,
  // future post packs go here
];

/** tagName → component, merged across all packs. */
export const postWidgets: Record<string, ComponentType> = Object.assign({}, ...packs);

/** the custom tag names, so the renderer can treat them as block-level. */
export const postWidgetTags: string[] = Object.keys(postWidgets);

/** ready to spread into react-markdown's `components` map. Widgets are
 *  self-contained and take no props, so each tag just renders its component. */
export const postWidgetComponents: Record<string, () => ReactElement> =
  Object.fromEntries(
    Object.entries(postWidgets).map(([tag, Cmp]) => [tag, () => <Cmp />]),
  );
