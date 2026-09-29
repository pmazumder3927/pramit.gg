# UI refinement audit

Selected direction: **01 — A quieter desk**. Implemented as the default; the
old comparison URL redirects home.

## Design and copy

Shared paper shadows are softer and theme-aware. Small secondary text is more
legible, card rotation is restrained, and hover movement is limited to clickable
cards. Paper textures, handwriting, tape, doodles, album accents, and authored
post content are preserved. Motion components respect the user's reduced-motion
setting for transforms; equalizer CSS animation also stops in that mode.

Interface copy is shorter: direct labels, less repeated explanation, clearer
loading/errors, and no unsupported “no tracking” claim. Examples:

- “what other adventurers left behind” → “visitor sketches”
- “the council waves you on. whispered into the void.” → “thanks for leaving a note.”
- “re-weave the sketches into a fresh painted nocturne…” → “create a new collage from visitor sketches.”
- “the back of the page” → “post settings”

## Surface coverage

| Surface | Work and verification |
| --- | --- |
| Home and archive | Applied option 01, improved filter state announcements, removed fabricated fallback song details; browser-checked filters and responsive layouts. |
| Shared desktop/mobile navigation | Improved desktop targets; reviewed active states and theme toggle. Mobile tabs retain their existing safe-area behavior. |
| Music | Quieter player, cards and tabs; shorter suggestion copy; explicit unavailable/idle states. Browser-checked error state and populated states using intercepted sample responses. |
| Contact | Lighter cards, shorter note instructions, labeled textarea, submission/error announcements, QR disclosure state; tested QR toggle and vCard download. |
| Drawing canvas and gallery | Reviewed canvas controls and scrollable tool strip; shortened loading/error text; added gallery retry and clearer captions. No drawings or notes submitted. |
| Collage | Fixed tablet arrow overflow and thumbnail selection scrolling the whole page; shortened CTA; checked thumbnail navigation. |
| All ten published articles | Checked desktop and mobile layouts with no document overflow or browser exceptions. Improved heading leading and visible code-copy controls. Authored text unchanged. |
| Embedded figures | Reviewed shared figure controls; enlarged common toggles/actions. Subject-specific diagrams, data and simulations remain intact. |
| Dashboard and Spotify connection | Shared styling, shorter labels, wrapped connection layout, proper new-post button, separated draft edit link from delete button. Source-reviewed; no authenticated mutations. |
| Writing room, post settings, assistant, draft preview | Shared styling, concise labels/placeholders, input names and selection states. Source-reviewed; owner session needed for end-to-end editing/publishing checks. |
| Music desk, sorter, setlist, graveyard | Shared controls and typography, sticky-header offset, wrapped nav, shorter explanations, visible mobile graveyard actions and expanded-state labels. Source-reviewed; owner session needed for end-to-end checks. |
| Loading, error, 404 | Replaced elaborate spinner with a small status indicator; shortened recovery text and fixed action wrapping. 404 browser-checked. Error component source-reviewed. |

Development-only figure/paint harnesses retain their diagnostic controls. The
public robotics playground remains a standalone authored interactive article asset.

## Validation

- Production build succeeded (including all generated article routes).
- TypeScript and `git diff --check` passed.
- Main public routes checked at 390, 768 and 1440px; dark phone layouts inspected.
- All ten article routes checked at 390 and 1280px with no document overflow.
- Read-only interaction checks passed: archive filter, contact QR show/hide,
  local vCard download, disabled empty-note submit, collage thumbnails and initial
  scroll, music tabs, suggestion-panel opening, and populated mobile player.
- Local Spotify service credentials are incomplete. Live error states were checked;
  successful music layouts used browser-only fixture responses. Authenticated owner
  workflows were reviewed in source, not exercised through a signed-in session.
