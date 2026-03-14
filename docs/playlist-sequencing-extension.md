# Playlist Sequencing Extension

## Why this exists

The current system answers two questions well:

1. Do I still like this song?
2. Which playlists or buckets should it live in?

This extension adds the next question:

3. In what order should songs live inside a playlist so the playlist feels good from start to finish?

The product should treat sequencing as assisted composition, not list management. The system helps shape flow, tension, and release while staying explainable and easy to override.

## 1. Mental model

### User-facing concepts

The product should expose five simple concepts:

- `Playlist goal`: why this playlist exists.
- `Blocks`: local sections of songs that belong together.
- `Flow`: the overall arc across blocks.
- `Transitions`: the seams between adjacent songs or adjacent blocks.
- `Roles`: special song jobs like anchor, bridge, opener, reset, closer.

This is the right user model because it is concrete enough to manipulate but does not force users to think in optimization language.

### Internal concepts

The system can keep richer concepts internal:

- `Arc profile`: target movement in energy, intimacy, novelty, familiarity, and density over time.
- `Song embedding`: a vector built from metadata and listening behavior.
- `Adjacency score`: how well one song follows another.
- `Block cohesion score`: how locally coherent a block feels.
- `Boundary risk`: how abrupt a jump is at a block edge.
- `Bridge potential`: whether a song can connect two otherwise distant clusters.
- `Anchor pressure`: whether the current ordering places too many unfamiliar or demanding songs in a row.

### Structural representation

A playlist sequence should be represented as:

- `Playlist`
- `Sequence plan`
- `Ordered blocks`
- `Ordered songs within each block`
- `Transition descriptors between blocks`
- `Pinned roles for specific songs`
- `Constraints and preferences`

Conceptually:

`Playlist = goal + arc + blocks + local song order + transition rules + locked user choices`

### Recommended data model

The existing app already has `buckets` as playlist containers and track-level review state. Sequencing should extend that rather than create a separate taxonomy.

Suggested entities:

- `playlist_sequence_profiles`
  - `playlist_id`
  - `goal_type`
  - `goal_strengths` JSON
  - `arc_profile` JSON
  - `updated_at`

- `playlist_sequence_blocks`
  - `id`
  - `playlist_id`
  - `name`
  - `purpose`
  - `position`
  - `color_token`
  - `notes`
  - `locked`

- `playlist_sequence_memberships`
  - `playlist_id`
  - `track_id`
  - `block_id`
  - `position`
  - `role_tags` array
  - `locked`
  - `hidden_from_autosort`

- `playlist_sequence_suggestions`
  - `playlist_id`
  - `suggestion_type`
  - `payload`
  - `score`
  - `reason_summary`

- `playlist_sequence_snapshots`
  - `playlist_id`
  - `version`
  - `sequence_json`
  - `quality_metrics`

The key rule is that block membership and song order are editable user state, while recommendations remain separately generated and replaceable.

## 2. User workflow

### Entry point

Each playlist card should gain a secondary action:

- `Open in Sequencer`

If the playlist has never been structured before, the user lands in `Quick setup`.
If it already has a sequence plan, the user lands in `Flow view`.

### First-run flow

1. User opens a playlist in Sequencer.
2. System asks for playlist goal.
3. System scans the playlist and proposes:
   - a default arc
   - 3 to 6 initial blocks
   - likely anchors
   - risky transitions
4. User chooses one of:
   - `Use suggested structure`
   - `Start simple with 1 block`
   - `Start from a template`
5. System renders the sequence workspace with editable blocks and provisional ordering.

### Ongoing editing flow

1. User sees the playlist as a horizontal block arc and a song list under the selected block.
2. User can tune at the macro level first:
   - change goal
   - merge/split/reorder blocks
   - adjust target arc
3. User then tunes locally:
   - accept or reject within-block ordering
   - lock favorite songs in place
   - resolve warnings at transition edges
4. User previews the flow:
   - audition one transition
   - audition a block
   - audition from current point forward
5. User saves back to Spotify when ready.

### Automation boundary

The default behavior should be:

- automatic proposal
- manual approval
- persistent user locks
- recomputation around locked decisions

The system should never silently rewrite a playlist the user already hand-shaped unless the user explicitly runs a reorder action.

## 3. UI for block-level ordering

### Primary workspace layout

Recommended desktop layout:

- top: playlist header and goal selector
- middle: `Flow rail` showing ordered blocks as connected segments
- left or center: selected block details and song list
- right: `Flow coach` with warnings, bridge suggestions, and optimization actions

On mobile:

- top: goal chip + overall score
- middle: horizontally scrollable flow rail
- bottom sheet: selected block editor and song cards

### Block cards

Each block card should show:

- name
- song count
- dominant feel summary like `warm / mid-energy / familiar`
- one or two warnings if present
- lock state

Block cards should be draggable, but drag-and-drop is not the main feature. The main feature is that dragging is supported by transition diagnostics.

### Block actions

Users should be able to:

- create a block from selected songs
- split a block at a song boundary
- merge adjacent blocks
- rename a block
- duplicate a block layout as a template
- delete a block and redistribute its songs
- lock a block so autosort cannot move songs across it

When deleting a block, the system should ask:

- move songs to previous block
- move songs to next block
- re-cluster automatically

### Arc visualization

The playlist should have a visible shape, not just a list.

Use a compact arc strip with 4 lanes:

- `Energy`
- `Mood valence`
- `Familiarity`
- `Novelty`

Each block contributes a segment to the arc. The user can drag target points or choose presets like:

- `gentle rise`
- `steady-state`
- `dip then lift`
- `late peak`
- `soft landing`

This makes the intended experience legible without requiring the user to inspect each song.

### Transition visualization between blocks

Between adjacent blocks, show a seam indicator:

- green: smooth
- yellow: noticeable
- red: abrupt

Clicking the seam opens a `Transition panel` with:

- what is changing
  - energy
  - texture
  - language
  - vocal density
  - familiarity
- why it may feel abrupt
- candidate bridge songs
- actions
  - insert bridge
  - soften the previous block ending
  - strengthen the next block opening
  - accept abrupt cut

## 4. UI for song-level ordering within blocks

### Song list model

Within a selected block, songs should appear in order with role badges:

- `anchor`
- `bridge`
- `lift`
- `reset`
- `closer`
- `new`
- `favorite`

Each row should also show a subtle compatibility meter against its neighbors.

### Proposal behavior

The system should propose a local ordering based on:

- closeness of adjacent feel
- target block purpose
- anchor distribution
- novelty pacing
- local opening and closing strength

Users can run:

- `Reorder this block`
- `Keep anchors fixed`
- `Make smoother`
- `Add more surprise`
- `Reduce hard jumps`

### Manual override behavior

Users should be able to:

- drag a song
- lock a song position
- pin a song as opener or closer
- mark two songs as `keep together`
- remove a song from block
- send a song to another block

Any manual change should update only the affected neighborhood by default, not reshuffle the full playlist.

### Awkward-jump repair

At the song level, the UI should surface a warning dot where two adjacent songs clash.

Selecting the warning opens quick fixes:

- swap with a better nearby candidate
- insert one bridge song
- move one song earlier
- move one song later
- accept abrupt jump

The default repair interaction should be one tap, not a modal workflow.

## 5. Transition handling

### Detecting bad transitions

The system should score each adjacent pair and each block boundary on:

- energy delta
- emotional-tone delta
- production-texture delta
- vocal-presence delta
- lyrical-density delta
- language switch
- genre-neighborhood distance
- familiarity drop
- novelty streak pressure
- skip-risk estimate

A transition is risky when:

- multiple dimensions change at once
- the playlist goal favors smoothness
- the current point is not marked as an intentional rupture

The system should not flag every difference as a problem. It should flag differences that likely feel jarring for the playlist’s goal.

### Bridge song suggestions

A bridge candidate should be a song that reduces distance on at least two major dimensions between sides A and B.

Examples:

- medium-energy song between soft and intense
- bilingual or cross-scene song between language regions
- acoustic-to-electronic hybrid between texture zones
- familiar song before a novelty-heavy run
- low-lyric or instrumental song before a genre shift

Bridge suggestions should come from:

- songs already in the playlist but elsewhere
- songs in the user library that fit the playlist but are absent
- songs previously removed from the playlist but statistically useful as connectors

### Intentional hard cuts

Sometimes the right answer is a shock cut. The product should support `intentional rupture` as an explicit transition mode.

If the user marks a boundary as intentional, the system should stop trying to smooth it and instead optimize:

- strong ending before the cut
- strong opening after the cut
- minimized confusion around the rupture

## 6. Goal-aware optimization

The goal selector should be required, but lightweight. Users can choose one primary goal and optionally one secondary modifier.

### Emotion playlists

Optimize for:

- gradual emotional movement
- reduced abrupt energy spikes unless intentional
- strategic anchors for regulation
- strong opener and soft or purposeful landing

Penalize:

- too many emotionally difficult songs in a row
- sudden tonal whiplash

### Language immersion playlists

Optimize for:

- sustained exposure to target language
- gentle transitions into denser or harder material
- familiar anchors to avoid fatigue
- bridge zones when crossing languages

Penalize:

- excessive interruption by non-target-language tracks
- dense unfamiliar tracks back-to-back

### Discovery playlists

Optimize for:

- novelty pacing
- regular familiar anchors
- contrast that remains legible
- exposure to underexplored songs without overload

Penalize:

- long difficult streaks
- clustering too many unknowns at the front

### Comfort or familiar playlists

Optimize for:

- high familiarity
- emotional predictability
- low-friction transitions
- proven favorites placed at structurally important moments

Penalize:

- too much novelty
- hard stylistic cuts

### Background or session playlists

Optimize for:

- stable atmosphere
- low clash risk
- consistent texture and intensity
- minimal attention-grabbing disruptions

Penalize:

- abrupt loudness or density spikes
- lyric overload if the session implies focus

## 7. Metadata usage

The sequencing engine should combine explicit metadata with behavior-derived signals.

### Core signals

- `recency`
- `familiarity`
- `replay frequency`
- `skip behavior`
- `days since last listen`
- `proven favorite`
- `underexplored`
- `mood`
- `energy`
- `emotional tone`
- `language`
- `genre neighborhood`
- `lyrical density`
- `production texture`
- `intensity`
- `bridge potential`

### Derived sequencing features

Useful derived fields:

- `novelty score`
  - high when a song is new, underplayed, or not yet stabilized in behavior

- `comfort score`
  - high when replayed often, skipped rarely, and repeatedly confirmed

- `anchor score`
  - high when familiar, liked strongly, and broadly compatible

- `bridge score`
  - high when a song is moderately central between clusters

- `demand score`
  - high when dense, emotionally heavy, sonically intense, or often skipped in certain contexts

- `reset score`
  - high when a song clears the palette through simpler texture, lower density, or familiar cadence

### Existing-system compatibility

The current review system already tracks signals that should feed sequencing:

- `lastPlayedAt`
- `reviewCount`
- `confirmStreak`
- `deferCount`
- `unsureCount`
- `daysSinceListen`
- active bucket assignments

Sequencing should reuse those fields instead of recomputing familiarity from scratch.

## 8. Suggestions and automation

### Good auto-suggestions

The system should suggest:

- `Create 4 blocks around natural clusters`
- `Move these 3 songs into a softer intro`
- `Use this familiar song as an anchor before the discovery run`
- `Insert one bridge between these two blocks`
- `Swap these neighbors to reduce clash`
- `Spread new songs apart`
- `Your ending is too abrupt for a comedown playlist`
- `This playlist wants one stronger opener`

### What the system should optimize automatically

Safe defaults for auto-optimization:

- order within unlocked blocks
- placement of bridge candidates
- spacing of anchors and underexplored songs
- highlighting risky transitions
- local repairs after a manual move

### What the system should ask the user to decide

The system should ask the user before:

- changing playlist goal
- adding songs not already in the playlist
- moving locked songs or blocks
- splitting or merging blocks automatically when confidence is low
- preserving or removing an intentional hard cut

### Automation modes

Offer three modes:

- `One-click flow fix`
  - keeps block layout if present, smooths ordering, inserts suggestions

- `Guided shaping`
  - presents issues one by one with accept/reject actions

- `Full manual`
  - user controls all structure, system only annotates and proposes

## 9. Quality metrics

There is no single score that defines a good playlist. The product should show a compact scorecard with tensions, not a fake objective truth.

### Core metrics

- `Cohesion`
  - how locally compatible adjacent songs are

- `Arc fit`
  - how well the ordering matches the chosen goal and target arc

- `Variety`
  - whether the playlist avoids monotony

- `Anchor balance`
  - whether familiar songs are distributed well enough to support the goal

- `Novelty pacing`
  - whether new or difficult songs are spaced sensibly

- `Transition health`
  - how many risky seams remain and how severe they are

- `Ending strength`
  - whether the final section resolves as intended

### Tradeoff model

The system should surface explicit tensions like:

- `Smoother transitions, less surprise`
- `More discovery, higher skip risk`
- `More genre spread, weaker atmosphere`
- `More target-language exposure, higher fatigue`

This should be shown as plain language, not hidden inside scores.

### Evaluation style

The UI should avoid saying `best order`. It should say:

- `Best for calm continuity`
- `Best for discovery pacing`
- `Best for stronger ending`

That language matches the product philosophy and prevents false objectivity.

## 10. Power-user controls

### For deep manual control

Provide:

- song and block locking
- neighbor locking
- opener and closer pinning
- custom block names and notes
- explicit transition mode
  - smooth
  - neutral
  - intentional rupture
- optimization sliders
  - familiarity vs novelty
  - smoothness vs contrast
  - stable atmosphere vs expressive arc
  - language purity vs bridge tolerance
- compare two candidate orders side by side
- snapshot and rollback
- export and restore sequence versions

### For lightweight users

Provide:

- `Make this flow better`
- `Add structure`
- `Smooth rough transitions`
- `Make it more comforting`
- `Make it more exploratory`
- `Make ending stronger`

These actions should produce visible changes plus a short rationale like:

- `I split the playlist into 4 blocks and placed two familiar anchors before the deepest run.`

## Recommended default UX

If only one version of the feature ships first, the default should be:

1. User opens a playlist.
2. System asks for goal.
3. System proposes 3 to 5 blocks and an arc.
4. User sees a flow rail with seam warnings.
5. User edits blocks if needed.
6. User selects a seam or song warning and accepts quick fixes.
7. User saves the improved sequence back to Spotify.

This is the highest-leverage default because it gives structure, assistance, and manual control without overwhelming the user with graph theory or dense controls.

## Suggested UI language

Prefer language like:

- `Flow`
- `Shape`
- `Section`
- `Anchor`
- `Bridge`
- `Rough transition`
- `Intentional shift`
- `Make smoother`
- `Keep this moment`

Avoid language like:

- `Cluster centroid`
- `Similarity matrix`
- `Global optimum`
- `Metadata purity`

## Suggested implementation order

1. Add a playlist sequencing workspace and goal selector.
2. Introduce blocks, block CRUD, and persistent ordered memberships.
3. Add adjacency scoring and seam warnings.
4. Add local reorder suggestions and bridge insertion.
5. Add arc presets and quality scorecard.
6. Add advanced controls, snapshots, and compare mode.

## Product stance

The product should behave like a thoughtful sequencing partner:

- opinionated enough to help
- transparent enough to trust
- flexible enough to bend
- restrained enough to preserve the user’s taste

That is the right extension of the current review system, which already succeeds by combining strong defaults, explainable reasoning, and quick user decisions.
