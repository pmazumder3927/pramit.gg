hello.

A lot has happened in my life recently, and as it happens I'm accepting a new position in the birthplace of fallen dreams (san francisco).

I've been trying to take advantage of my freedom while I have it, so I have returned to my love/hate relationship with the video game Valorant. There is one issue with this. I'm bad at it.

When I look at a game, I tend to prioritize the elements of micro and macro (for a really good explanation of what this means, [this video](https://www.youtube.com/watch?v=NgHvdCcmQ4o) may be helpful). Applied to Valorant, this means that I am paranoid about having good aim. The issue is that I'm very naturally uninclined towards this end.

Traditionally, the tool of choice for this is an aim trainer (or just getting good), and I've used those for quite a while. Currently, my favorite is the [Viscose](https://evxl.app/u/joyfired/Viscose%20Benchmarks%20S2/Easier?tab=leaderboards) playlists in Kovaaks, and I think it's honestly really good.

However, as a perception engineer with a Cognitive Science degree and some dabbling in brain-computer interfaces, I felt like I may be uniquely equipped to take a crack at this problem myself.

## tl;dr

Most aim training routines have a principle of "playlists" of scenarios, each targeting a certain skill. In the process of practicing these over and over, you improve your scores, and thus your mouse control and overall transferrable aiming ability as a result.

I had one major hangup on this, however: the scenarios given to you by playlists are static in difficulty, and funadmentally humans tend to improve quicker at tasks when challenged at a frontier only slightly more difficult than their current abilities. That way you get a lot of actionable learning without feeling beat up. Another major annoyance I found was the difficulty of changing sensitivity in aim trainers. It's generally known now that an optimal sens is a myth, and different sens ranges are beneficial for training aim as a general skill and different muscle groups in the chain. Taking all of this into account, I really wanted to make an aim trainer that prioritizes the actual physical movement of your hand as an objective, rather than a score.

So i sat down and wrote a ton of code this weekend and made openaim: a trainer that treats every mouse movement as a signal about your motor system, reconstructs how you aimed from that signal, and attempts to use this to close the loop on your individual training.

---

## the itch

As a data-driven person, I really wanted to know way more about my aim training scenarios than any program out there currently gives you. I want to know the velocity of my flicks, acceleration curves, timing, and how this compared to other people who aimed better than me. Even if you're not quite as psychotic as me in this regard, I figured at the very least I can use this data to better predict how to improve.

Most importantly, I felt like **the "smart" commercial stuff is a costume.** Aimlabs' store page lists AI coaching, adaptive tasks, generative scenarios, a sensitivity finder, and eight kinematic sub-scores. In reality, if you want optimal training you end up configuring every "adaptive" setting yourself; nothing persistent is modeled about your _ability_ (it logs scores, not skill), the sub-scores ship with no published formula, and the flagship "improve **49% faster**" claim has no study, sample size, or methodology anywhere.[^aimlabs] I did in fact subscribe and use Aimlabs+ for quite a while, and I wasn't quite sold. I decided I could probably do better for free.

I really feel like a lot of aim-training is vibes-based right now, the truth is that a lot of the people who improve quickly have no clue what they're doing, they just have better intuitiion for improving their aim in the first place. I'm trying to codify this a little more. Cycling had vibes-based training for decades until the power meter showed up and gave a definitive watt number tied to the thing you were actually trying to improve. **aim training is pre-power-meter.** it has scoreboards, but no leaderboard measures the underlying thing.

So, in the grand tradition of [the minmaxer's dilemma](/post/the-minmaxer-s-dilemma), i decided the correct response to "just play more" was to spend a weekend building a measurement instrument instead. the irony that a chronic score-minmaxer built a tool whose entire north star is _stop optimizing the score_ is not lost on me. we'll get there.

---

## the thesis: a flick is not a black box

the whole thing rests on one idea from motor-control science, and it's worth sitting with, because everything else is downstream of it.

when you snap your crosshair to a target, that movement is not one smooth motion. fifty years of research says a rapid aimed movement **decomposes into a ballistic _primary_ submovement — a big pre-programmed launch — plus optional _corrective_ submovements** that clean up the landing.[^meyer] and the reason you _need_ those corrections is the second half of the idea: your neural control signals carry **signal-dependent noise**. the bigger and faster the motor command, the more noise rides along with it, so **endpoint error grows linearly with movement speed.**[^harris]

that second paper — Harris & Wolpert, _Nature_, 1998, 3000+ citations — is the load-bearing one. a single "minimize the variance caused by signal-dependent noise" principle predicts the trajectories of _both_ eye saccades and arm reaches, and it _derives_ Fitts's law from first principles instead of just curve-fitting it.

<submovement-fig></submovement-fig>

here's why this matters for a _browser aim trainer_ specifically: **all of that is estimable from raw mouse telemetry.** i don't need a lab, EMG electrodes, or an eye tracker. i need your mouse deltas at a high enough sample rate, and i can reconstruct the submovement structure, fit your personal noise-vs-speed line, and read off the single most useful number in your whole profile — the slope of that line, your **motor-noise coefficient σᵥ**. that number _is_ your personal speed-accuracy frontier: the fastest you can flick before noise, not skill, dominates the outcome. If I take a lot of samples of this over different scenarios, I can construct a vector of your individual ability as a player, and how it's affected by various other factors like the thing you're aiming at.

the anatomy above is static; the _behavior_ is the fun part. here's the whole thesis in one toy — drag the flick speed and watch endpoint spread grow linearly with it, then flip corrections on to see the corrective submovements haul the near-misses back in (and time out the far ones):

<!-- INTERACTIVE WIDGET — signal-dependent noise, live. -->

<submovement-lab></submovement-lab>

that's the bet. the rest of this post is what i built on top of it.

---

## the shape of the thing

before the parts, the whole. openaim is not five features stapled together — it's **one player model, observed through four engines**, wired into a loop that never stops turning.

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/menu.png  ·  caption: "the trainer itself — a zero-install browser app, everything stays on your machine. the coached session is the front door; free play and the tools sit below." -->

<!-- theme-aware diagram — renders via the custom-tag → component map -->

<loop-fig></loop-fig>

let's walk the loop.

---

## engine 0: getting clean signal out of a browser

before any of the science matters, i have to actually _capture_ the movement — and i chose to do it in a browser, which sounds insane for a latency-sensitive input problem. the reasons: zero install, the whole thing is a link you can send someone, replays are shareable, and "open" only means something if there's nothing to download and trust.

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/onboarding.png  ·  caption: "the first thing it asks for: your two physical constants — mouse counts-per-inch and cm/360 — because every drill is built from a *measured* model of your aim, and everything stays on the device." -->

the trick that makes it possible is a stack of three web APIs most people never touch:

- **Pointer Lock** hides the cursor and gives you unbounded relative `movementX/Y` — mandatory for an FPS feel.
- **`pointerrawupdate`** delivers pointer events _without_ the coalescing normal `pointermove` applies.
- **`getCoalescedEvents()`** is the actual magic. browsers batch input samples into one animation-frame callback, but this method hands you back _every underlying sample_ with its own timestamp. a 1000–8000 Hz mouse produces many samples per rendered frame, and this is how you recover them. **i validated real capture at ~2000 Hz on actual hardware.**

<!-- theme-aware diagram — renders via the custom-tag → component map -->

<input-recovery-fig></input-recovery-fig>

and the part i'm weirdly proud of, because no incumbent does it: **the trainer measures its own latency and shows it to you.** since i'm measuring human timing at millisecond scale, the system's own input→photon delay is a confound i have to quantify and subtract, not hide. disclosing your own latency is a transparency win _and_ a correctness requirement for any honest timing metric. i'd rather show you the number and its error bars than pretend it's zero. (the in-app probe is honest about its own limits, too — it measures the software pipeline; true input→photon needs hardware, so it says so instead of guessing.)

every run serializes to an open **`.oar` replay**: a little binary with a magic number, a JSON header (the full scenario spec, seed, your sens/dpi/cm360/fov, capture metadata), and then the raw columns packed back-to-back — `mouse_t_ms`, `mouse_dx`, `mouse_dy`, plus the rendered yaw/pitch and any moving-target tracks. it losslessly reconstructs the run so you can re-score it under a new metric later, and the TS and Python codecs are round-trip tested against each other byte-for-byte. your replays are yours; the format is documented; you can export them.

---

## engine 1: the diagnosis — _why_ you missed

this is the part that already does something no incumbent does, and it's where the science cashes out. the flow: raw replay → segment every flick → fit your noise curve → attribute each miss to a mechanism → hand you a picture, not a paragraph.

### segmenting the flick

the Python engine (`openaim_analysis`) takes the 1 kHz crosshair trace, low-passes the speed profile with an 8 ms Gaussian, and finds the peaks and valleys using **1D persistence** — a topological way of keeping only the extrema that are "tall" enough to be real (persistence ≥ 5% of the speed range) and throwing away the jitter. submovements are `(min, peak, min)` triplets at least 50 ms long with a peak above 8°/s. this is the exact recipe the AutoGain and ICP papers validated.[^autogain][^icp] then it filters out "unaimed" segments — anything pointing more than 45° off the target or overshooting by more than 0.5× the distance — because those aren't corrections, they're you doing something else.

### the headline number: your speed-accuracy frontier

for each ballistic primary, it records `(mean speed, endpoint error)`, and fits a line:

```
SD(endpoint error) = σ₀ + σᵥ · v
```

that's it. that's the signal-dependent-noise law from the thesis, fit to _your_ hand. the fit is a weighted least-squares over speed-quantile bins, with a **1000-sample bootstrap confidence interval** (seeded, so it's deterministic — run it twice, get the same CI). `σᵥ`, the slope, is your motor-noise coefficient. from it the engine reads two things: your **operating point** (the speed you actually flick at, the median primary speed) and your **frontier** (the speed at which predicted error grows past the target radius — the fastest you _should_ flick).

<!-- INTERACTIVE WIDGET (renders on pramit.gg via the custom-tag → React mapping). -->

<noise-frontier></noise-frontier>

### which stage failed?

a miss isn't a miss. the engine classifies every failed engagement into one of five mechanisms, each with a **dissociable telemetry fingerprint** (this is the ablation logic from the point-and-click simulation literature run in reverse — perceptual vs motor deficits leave distinguishable traces in the miss-rate-vs-time tradeoff[^doclick][^icp]):

<!-- theme-aware diagram — renders via the custom-tag → component map -->

<miss-fingerprints-fig></miss-fingerprints-fig>

### the "why you missed" screen (the report that isn't a report)

my first version of this was a Python markdown report — a wall of cited text. it was _correct_ and _boring_, and it violated a rule i care about: don't hand someone an AI-ish essay when you could hand them the thing itself. so i deleted it. now diagnosis lives inside an interactive **Replay Lab**:

- **3D playback** of your run — reconstructed from the recorded camera path and target tracks, rendered through the _same_ renderer the live trainer uses (no re-simulation, just replay).
- a **per-flick scope**: your crosshair's path drawn in the target's own frame of reference, colored by phase (reaction / ballistic / correction / settle), with the launch vector, the landing dot, and the kill-or-miss marker. it's the literal picture of figure 1, for one real flick.
- a **speed fingerprint** chart with the movement phases shaded behind it, and a click-through attribution dashboard: click "correction," it seeks the scrubber to your _worst_ corrective flick and shows you.

<!-- SCREENSHOT — the Replay Lab needs your real run data (a headless capture can't populate it):
     play a run, open it in the Replay Lab, screenshot, and drop it in via the write room here.
     Caption: "the Replay Lab — 3D playback of a run, the per-flick scope in the target's own
     frame, and the speed fingerprint; click a mechanism to jump to your worst example of it."
     Same deal for a populated Player profile and a Run results card. -->

there's a subtlety worth admitting: the in-browser diagnosis is a _principled approximation_ of the full Python engine (no submovement deconvolution, no bootstrap CI live) — for the rigorous version there's a one-click "full engine report." i'd rather ship the honest fast version and label it than pretend the quick client math is the deep fit.

---

## engine 2: a drill is a point in space, not a name

the incumbents think in scenarios: "Reactive Flick," "Strafe Track," a named list you scroll. the second-biggest idea in openaim (after the noise model) is throwing that out. on day one i wrote a scenario generator; by the end of day one i'd deleted it, because **a drill is not a category — it's a point in a parameter space.**

concretely, a drill is a **13-number vector**: amplitude, target width, target speed, reversal rate, motion smoothness, hold-to-kill time, simultaneous target count, verticality, **absolute sensitivity in cm/360**, pace pressure, hits-to-kill, blink/dash rate, and jump/bounce. every community category — flicks, micro, wall/moving/stability switching, moving clicks, reactive vs smooth tracking, multi-tap, blink reflex, bounce, air tracking — is a _region_ of that space. and configurations no human ever hand-authored are just as reachable.

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/scenarios.png  ·  caption: "free play, grouped by what each region trains — clicking/flicking, tracking, switching, and the "advanced" mechanics (blink, bounce, 2-tap). every one of these is just a neighbourhood of the same 13-number space." -->

all of it compiles down to **one bot simulation**. this is the part that keeps the whole thing honest. generated coach drills, built-in scenarios, and reverse-engineered benchmark replicas all execute on a single engine with real mechanics: acceleration-based movement in a Quake/UE style, gravity and jump/bounce physics, flyers, blink dashes with charge systems, HP pools with regen, dodge state machines, and hitscan weapons with cadence, magazines, and reloads — plus faithful KovaaK's scoring. **a demand the model prices is a demand that actually runs**, because the same instrumentation reads every run identically no matter where the drill came from.

to make sure the generator's reach actually _covers_ real training, i reverse-engineered the **Viscose Season 2 benchmarks** straight from the KovaaK's workshop `.sce` files — a Python extractor that parses the INI-ish scenario format, digests two different map formats into a player-local frame, and reconstructs the bot physics, dodge profiles, and weapon tables. that's 156 benchmark slots (39 scenarios × 4 difficulties), of which 132 are faithfully reproduced, riding on the exact same engine as the generated drills. the coach's sampling ranges are pinned — by an actual unit test — to bracket the demand distributions measured from that real Viscose data. "the coach can form any benchmark-shaped drill" is a tested property, not a hope.

(one honest ceiling: elite tracking scenarios like RawControlSphere run at ~129°/s, and the coach's target-speed axis caps lower. i know. it's a documented ceiling, not a bug — for now.)

then, the payoff of the whole engine: because every drill is a parameter vector, and because i have your motor parameters, i can predict **how hard a specific drill will be for you, before you play it** — using the validated HCI difficulty models (the point-and-click simulation and its `D_click` bits for clicking/timing[^doclick][^icp]; the Servo-Gaussian success model for tracking[^servo]; Fitts throughput per class for static flicks[^swipiness]; always a temporal term for moving targets[^ternary]). the _same_ spec is a different difficulty for a different player. that's exactly what the next engine needs.

---

## engine 3: the coach — one model of you, fourteen axes deep

here's where it stops being a diagnostic tool and starts being a _coach_. the core is a model that i'm genuinely happy with: a **multidimensional online Rasch model** (the multi-axis generalization of Elo) that predicts your probability of success on any drill in the space.

```
P(success | drill x) = σ( w₀ − Σⱼ wⱼ · fⱼ(x) )
```

read it like this: `w₀` is your general skill. each `fⱼ(x)` is a **demand feature** — how much the drill loads axis _j_. each `wⱼ` is _what that demand costs you_ (lower = more capable). the dot product is "how much this specific drill taxes this specific player," squashed through a sigmoid into a hit probability.

<!-- INTERACTIVE WIDGET — the logistic surface + a "solve to 0.68" button (Guadagnoli & Lee 2004; Pelánek 2016). -->

<challenge-point></challenge-point>

a few things i'm proud of in how this actually works:

- **it's a real Bayesian filter, not a scalar.** the model carries a full 15×15 posterior covariance. every drill result is folded in with an assumed-density (Laplace/EKF) update — a rank-1 update to the mean and a PSD-safe downdate to the covariance. the important consequence: **the off-diagonals route one axis's surprise to its correlated neighbours.** do well on a hard micro-flick drill and your fine-hand-precision estimate sharpens _and_ your related axes shift, because the model knows they move together.
- **it forgets on a clock, not per drill.** idle axes slowly drift back toward uncertainty (a small process-noise bump per day, capped so a two-week layoff can't erase what it knows), so the coach re-probes skills you haven't touched. a stationary session, by contrast, converges.
- **a second head predicts your kill time.** `ln E[kill-time] = tᵥ₀ + Σ tᵥⱼ·fⱼ`, fit online, which gives each drill a personal _pace budget_ — so outcomes are graded on pace + quality, never raw accuracy (a multi-tap kill is graded on cleanliness against its hits-to-kill, not on whether you eventually connected).

the fourteen demand axes are all cited, and this is the table i'd actually put on a fridge:

| axis            | what it measures                                                                | grounded in                  |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------- |
| `fitts`         | spatial precision — log index of difficulty, **sens-invariant by construction** | Fitts / SDN[^harris]         |
| `temporal`      | interception timing — crossing rate ≈ inverse click window                      | ICP `D_click`[^icp]          |
| `reactivity`    | reactive-correction load from _unpredictable_ motion                            | Servo-Gaussian[^servo]       |
| `stability`     | sustained on-target hold                                                        | tracking hold                |
| `switching`     | simultaneous-target planning load                                               | multi-target                 |
| `vertical`      | vertical spread / motion (jump-aware)                                           | —                            |
| `armControl`    | **hand-space** travel per flick → arm recruitment                               | SDN in motor coords[^harris] |
| `microControl`  | **hand-space** finger-scale flicks                                              | SDN in motor coords[^harris] |
| `handPrecision` | **hand-space** endpoint precision (fine hand)                                   | SDN in motor coords[^harris] |
| `handSpeed`     | **hand-space** required hand velocity                                           | SDN in motor coords[^harris] |
| `pacePressure`  | time pressure (signed — relaxed can be negative)                                | —                            |
| `smoothPursuit` | _predictable_ pursuit, dissociated from reactivity                              | Servo-Gaussian[^servo]       |
| `reacquire`     | post-blink / displacement re-lock                                               | submovement re-plan[^meyer]  |
| `cadence`       | repeat-shot commitment at a rhythm                                              | ICP internal clock[^icp]     |

those four `hand-space` axes are the quiet heart of the whole sensitivity philosophy: they're computed in **absolute physical centimetres of mouse travel**, because signal-dependent noise lives in _motor_ coordinates, not screen pixels.[^harris] which means being a good aimer at 20 cm/360 and at 60 cm/360 are _separate, separately-measured capabilities_ — not the same skill times a multiplier. more on that in engine 4.

<!-- INTERACTIVE WIDGET — click an axis for its formula + citation; "run a session" improves the weakest axes most. -->

<capability-radar></capability-radar>

### deciding what to train

rating you is half of it. the other half is _choosing_ the next drill, which is a little multi-objective search. for each axis, the coach computes a **training value** — and this is the actual acquisition function, weights and all:

```
value(axis j) = wUncert·σ²ⱼ            (how unsure am i about you here)
              + wLp·max(0, learningProgressⱼ)   (are you improving fastest here)
              + wDue·dueRatioⱼ          (is this skill decaying, FSRS-style)
              + wWeak·max(0, wⱼ − populationBaselineⱼ)  (relative weakness)
              + wMech·[flagged by diagnosis]     (did engine 1 blame this)
              − use·usedⱼ               (don't over-serve one thing)
```

three of those deserve a callout, because they're where the education research earns its keep:

- **learning progress, not lowest score.** the bandit routes you to the sub-skill where you're _improving fastest_, not the one where you're worst — because grinding your worst skill is demoralizing and inefficient if you're not actually moving on it.[^zpdes] the reward is the slope of your recent success rate, measured on frozen **measurement probes** (fixed-geometry drills, never adapted, scored against a locked pace budget), so it's honest ground, not model drift.
- **spacing.** each axis has a lightweight FSRS-style memory state; a skill becomes "due" as it decays, and revisiting it _after_ partial decay consolidates more than hammering it fresh.[^fsrs] a static PDF fundamentally cannot come back to a skill at the right moment. this one does.
- **a hard variety cap.** an early, very real bug was the coach falling in love with one mechanic and serving me smooth-pursuit drills all session (there is a commit literally titled `stop giving me smooth pursuit`). the fix: no single axis can own more than 35% of a session, and no more than 4 in a row. weakness is measured against a _population_ baseline now, not a single pilot, so "weak" means weak-relative-to-people, not weak-relative-to-my-own-best-axis.

and then the session itself is _assembled_, not authored — a transparent **plan** at real playlist scale (default 30 × 60-second drills, the length of a Viscose routine):

<!-- theme-aware diagram — renders via the custom-tag → component map -->

<session-plan-fig></session-plan-fig>

here's a real one — the pre-session briefing that opens every coached session, showing exactly what it's about to train and why (this is the app's "slate" theme):

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/coached-briefing.png  ·  caption: "the generated session plan, live from the app — the block spine, the per-capability bars, and each block's predicted success + pace budget. the reasoning behind every choice is shown inline." -->

---

## engine 4: sensitivity as a lever, not a magic number

sensitivity is where the "train the player, not the score" thing gets concrete, and where i most consciously refused to build the feature everyone expects (a "sens finder" that spits out your One True Number).

openaim treats sensitivity as an **absolute physical dimension** — cm/360, on a spectrum from 10 to 100 (Valorant pros live around 84, so it has to fit). the goal isn't "your best sens"; it's a player who is _objectively capable across the whole spectrum_. three pieces:

- **an AutoGain anchor.** the same under/overshoot signal engine 1 already computes tells you if your gain is mismatched: land consistently short in a speed band and your gain there is too low; overshoot and it's too high.[^autogain] the coach nudges your anchor toward _learnable_ errors — a gain matched to your motor system so a miss reflects _your noise_, not you fighting a bad transfer function. (a well-matched gain can even _lower_ your score at first while you stop compensating. that's allowed. that's the point.)
- **a mastered band** around that anchor, and a **sens ladder** in the session plan that replays one solved geometry at the band's _edges_. hold an edge and the band expands outward toward the full spectrum. "a good aimer at every sensitivity" becomes a _measurable state_ — capability held across the band — instead of a slogan.
- **prescribed sensitivities are honored.** some Viscose fingertip work mandates ≤ 50 cm/360; the trainer runs it at that, badges it in the menu, and stamps it in the replay.

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/settings.png  ·  caption: "the settings "bench console" — a live scope with your reticle, your sens resolved to an absolute cm/360, and the theme system (the whole app is theme-aware, which is why the figures in this post are too)." -->

<!-- INTERACTIVE WIDGET — drag the anchor; "cleared a rung" expands your mastered band toward the full spectrum. -->

<sens-spectrum></sens-spectrum>

---

## the aim commons: from a sample size of one to a population

everything so far works for a single player. but a single player has a cold-start problem — the first session, the model knows nothing, and Pelánek's education work says you need ~100 plays to calibrate a drill and ~10 to rate a person.[^pelanek] the fix is to let the crowd teach the model, carefully.

the **Aim Commons** is an opt-in shared data pool with three independent consent scopes: de-identified per-engagement feature rows (for the population fit), raw replays (for verification), and a public handle (for leaderboards). heavy ML runs _offline in Python_; the backend (Convex) just handles ingestion, a cheap integrity gate, storage, and — crucially — revocation. aggregate rows are stored under a salted SHA-256 of a client-minted id, so there's no reversible identity in the corpus and a revoke actually purges you.

the interesting math is the population model. it's a **factor model** over players × the 14 axes:

```
θ_c = μ_pop + L·z_c + ε_c
Σ_pop = L·Lᵀ + diag(ψ)      ← the shipped correlated prior
```

each contributor's own fit noise (their Laplace posterior covariance) is _subtracted_ before estimating the between-player covariance, so the manifold `L` is real human variation, not fitting artifacts. the number of latent factors `k` is chosen by a scree/parallel-analysis cut. and `μ_pop` is precision-weighted, so sharp fits count more than noisy ones.

<!-- theme-aware diagram — renders via the custom-tag → component map -->

<commons-fig></commons-fig>

and because the whole thing is public-facing, it needs teeth. the coach's **BALD** acquisition (`infoGain = κs/(1+κs)`) uses the _full_ predictive variance, so two correlated axes don't get double-counted when the coach goes looking for the most informative drill — active learning, not just "do the uncertain thing." leaderboards get a two-tier integrity model: every submission is re-checked for feature parity (the 15 features are recomputed on the server and must match to 1e-6), sanity-ranged, and screened for superhuman kill times — but **`verified` is only earned by re-simulation.** the engine is a pure function of `(spec, sens, seed, inputs)` with no wall-clock, so a determinism verifier can re-run your recorded inputs and demand a bit-exact track. a forged seed or geometry can't reproduce even the first target's motion. rate limits are keyed by endpoint class, not identity, because a rotating anonymous UUID can't be trusted as a key.

honest status: the backend is deployed and the full train → publish → serve loop is live-verified, but the data is still synthetic seed — the population is basically the pilot prior until real people contribute. and the raw-replay tier (T2) is built but _gated_, because uploading raw human kinematics is a biometric/consent question i'm not going to hand-wave. the verifier, the codec, the encoder all exist and are wired; flipping on raw-trace ingestion is a deliberate, unmade decision.

---

## the whole analysis engine runs in your browser

this is the piece i think is quietly the coolest. the diagnosis engine is a real Python package — numpy, submovement deconvolution, bootstrap CIs, the works. and it runs **client-side, in your browser**, with zero setup.

<!-- theme-aware diagram — renders via the custom-tag → component map -->

<browser-pipeline-fig></browser-pipeline-fig>

so the loop, in practice: you finish a run → it auto-syncs to your local corpus → the engine refits your capability profile in the background → at session end, the sharpened profile flows back into the coach _live_, and the summary shows you exactly which axes moved. no server round-trip, no account, no upload. the thing that would normally be a backend is sitting in a WASM sandbox in your tab.

---

## how it was built (a.k.a. the earlier versions)

i want to be honest about the timeline because it's kind of absurd: **the entire thing above is 79 commits across 3 days** — a weekend, basically. here's the arc, because the earlier versions are genuinely different animals.

<!-- theme-aware diagram — renders via the custom-tag → component map -->

<timeline-fig></timeline-fig>

- **the toy** (`initial concept`). the very first commit is already opinionated: 5,000+ lines dropping a Canvas2D renderer, a TypeScript game loop, _and_ a full Python analysis package all at once — plus a `vision.md` manifesto arguing aim training has "a feedback problem, not a content problem." three hand-named scenarios: Triple Click, Reactive Flick, Strafe Track. commit #2 is `ADD REPLAY` — replay was foundational, not bolted on.
- **the engine** (`continuous task spaces`). this is the day-one leap that defines the project: the generator gets deleted, and a drill becomes a point in a parameter space instead of a name. every hand-named family becomes a region. the coach can now train configurations no human authored.
- **going scientific & 3D** (`OFFLINE FIT!` → `PERSPECTIVE`). the Python capability fit gets wired in, the Viscose extractor lands, and the flat 2D projection grows a real perspective room — floor lines, ground shadows as depth cues, focal length and FOV. the toy starts looking like an FPS.
- **the unified engine & profile** (day two). `unified engine` collapses everything into one engine abstraction; `profile page` is a 4,500-line stats/insights/run-log system with the whole ECharts + micro-viz layer (every chart in this post descends from here). then the showstopper: **`webassembly worker!`** — the Python moves _into the browser_.
- **the backendening** (day three). Convex stands up: population factor model, task-Elo, the determinism verifier, the leaderboard, rate limiting, anti-abuse. the "Aim Commons" is born.
- **the replay lab & coach** (day three, 42 commits — the densest day). `remove report, add dashboard, less text` **retires the Python markdown report** for the interactive client-side dashboard. the coach matures into a forward-simulated rollout planner (`COACK ROLLOUT`, yes that's the real commit name), with a pre-session briefing and that hard-won variety cap.

things that died along the way, for the record: the standalone "report" pipeline, a `verify-celebrate.html` results screen, a static multi-tap scenario, and the entire concept of discrete named scenarios — all absorbed into the continuous space, the in-browser WASM, and the live dashboard.

---

## the one thing i refuse to fake: transfer

here's the part where every other trainer either lies or goes quiet, so i want to be loud about it.

**does aim-trainer practice actually make you better at the real game?** for skilled players, _there is no verified study that says yes._ it's not that the answer is no — it's that nobody has properly measured it. the surrounding evidence is genuinely sobering:

- video-game training shows **near-zero far transfer** to general cognitive ability across a 359-effect meta-analysis.[^sala]
- KovaaK's scores are extremely _reliable_ (test-retest ICC 0.947–0.995) but the authors explicitly warn this **does not license inferences about in-game FPS performance**, because the trainer strips out real gameplay's cognitive load.[^kovaaks]
- Voltaic itself disclaims it — the benchmarks are "just one piece of the puzzle."[^voltaic]
- and **Lumosity paid the FTC $2 million** for marketing exactly this kind of unproven transfer claim.[^ftc]

the one genuinely encouraging result is Neri et al. (2021): novices on _adaptive-difficulty_ CS:GO training improved in-game faster than a fixed-difficulty group.[^neri] but n=21, the "adaptive algorithm" was a researcher manually swapping bot configs, and they were novices, not plateaued enthusiasts. it supports the _thesis_. it does not prove _my system_.

so openaim's stance is: **transfer is the central open question, not a settled premise.** the product is built to _measure_ it — spaced retention tests instead of same-session scores, test-retest reliability reported for every metric, and (opt-in) linkage to in-game stats so the correlation can eventually be computed. the honest line is _"i measure X reliably; whether it transfers is what i'm studying — here's the current data,"_ and that line is the entire difference between this and a Lumosity.

this is also why the north star is **train the player, not the score.** wherever "get a better number on this scenario" and "become a fundamentally better aimer" point in different directions — and they diverge constantly — openaim follows the second, even when it _lowers_ your score today. the sens that gives your best score is often the one you've overfit muscle memory to. the schedule that makes your in-session number climb fastest is worse for durable learning. a benchmark you can grind is a benchmark you'll cheese. so the system optimizes the latent capability the score is a proxy for, and treats the score as an instrument reading, not the target.

(yes. the minmaxer built an anti-minmaxing machine. character growth.)

there's also one claim i had to _kill_ during my own research. i really wanted to use a square-root difficulty law — `√(D/W)` is a cleaner metric than log-Fitts — but when i adversarially fact-checked the sources, it didn't survive (it overreaches the 1988 paper and later work contradicts it).[^meyer] so it's out. openaim uses log-Fitts and the submovement/SDN model, not the pretty thing i wanted. that's the deal i made with myself: every number ships with a citation, and citations that don't hold up get cut, even the convenient ones.

---

## setbacks & what's honestly not there yet

in the spirit of every other build post i've written — here's what's held together with tape:

- **the transfer study doesn't exist yet.** the _harness_ is built; the actual longitudinal, in-game-linked study is the whole point and it's unrun. everything i claim about transfer is "we're measuring it," not "it works."
- **the commons is a ghost town.** the backend is live and the whole train→publish→serve loop works, but the population is synthetic seed data — it's basically the pilot prior wearing a population costume until real people contribute. contribution is on by anonymous default specifically to fix this.
- **the science is priors, not gospel.** the motor-control laws are validated on static targets and saccades, not FPS tracking. the difficulty models are mostly in-sample, small-n, young-adult. FSRS is a _declarative_-memory model and motor retention isn't the same thing — i reuse the machinery but haven't re-fit the functional forms on real motor-retention data. all flagged in-app.
- **the docs drifted from the code.** writing this, my own extraction pass caught that some docstring formulas no longer match the shipped feature functions, and the target success rate quietly moved from 0.72 to 0.68 when the offline sim retuned it. the code is the truth; the prose is catching up. (the irony of a "radical transparency" project having stale docs is noted and being fixed.)
- **eye tracking is vaporware-adjacent.** the quiet-eye idea[^vickers] is scoped and honest, but webcam gaze is too low-accuracy to be in the loop, so it isn't.
- **the tracking speed ceiling.** the coach can't yet generate the fastest elite tracking scenarios (~129°/s); its speed axis caps lower.

none of these are secrets in the app. that's sort of the whole bit.

---

## conclusion

i set out to answer a stupidly simple question — _why did i miss that shot?_ — and it turned into a measurement instrument with four engines, a Bayesian filter, a population model, a WASM-hosted science package, and a leaderboard that re-simulates your inputs to catch cheaters.

the thing i actually believe, under all the machinery: aim training deserves to be a _measurement science_, not a scoreboard with vibes. every mouse movement is a signal about your motor system, and if you take that seriously — segment it, fit it, cite it, and refuse to lie about what it means — you can build something that tells you the truth about your own hands. whether that truth carries into the game is the honest open question, and i'd rather ship the question with a ruler attached than ship a promise.

it never produces a _perfect_ aimer. but it tells you, today, exactly where your noise lives.

that's the end. thanks for reading ✦

— pramit ✦ mazumder

---

## references & footnotes

_every load-bearing claim above traces to one of these. confidence is flagged honestly: where the science is foundational i lean on it; where it's single-study, contested, or borrowed from an adjacent field, it's a prior to re-validate, and i say so._

[^meyer]: Meyer, Abrams, Kornblum, Wright & Smith (1988). "Optimality in human motor performance: Ideal control of rapid aimed movements." _Psychological Review_ 95(3), 340–370. [link](https://www.researchgate.net/publication/232518277_Speed-Accuracy_tradeoffs_in_aimed_movements_Toward_a_theory_of_rapid_voluntary_action). _The stochastic optimized-submovement model — ballistic primary + corrections; endpoint SD grows linearly with velocity. The backbone of Engine 1. **Strong/foundational**, but on static discrete targets; its √-law framing was the one claim I refuted._

[^harris]: Harris & Wolpert (1998). "Signal-dependent noise determines motor planning." _Nature_ 394, 780–784. [link](https://www.nature.com/articles/29528). \*A single minimum-variance / signal-dependent-noise principle predicts both saccades and reaches and derives Fitts's law. Grounds σᵥ and the four hand-space axes. **Strong/foundational.\***

[^challengepoint]: Guadagnoli & Lee (2004). "Challenge Point: A framework for conceptualizing the effects of various practice conditions in motor learning." _J. Motor Behavior_ 36(2). [link](https://www.researchgate.net/publication/8574634_Challenge_Point_A_Framework_for_Conceptualizing_the_Effects_of_Various_Practice_Conditions_in_Motor_Learning). \*Learning peaks at a per-performer optimal challenge point; difficulty is functional, not fixed. The theoretical backbone of the coach targeting ~0.68 success. **Strong theory; hard to operationalize exactly.\***

[^cretton]: Cretton et al. (2025). "When Random Practice Makes You More Skilled: Applying the Contextual Interference Principle to a Simple Aiming Task." _J. Cognitive Enhancement._ [link](https://link.springer.com/article/10.1007/s41465-025-00317-5). _Random-order mouse-aiming practice: worse during training, better at retention/transfer. Motivates opt-in variable practice; corollary that in-session score misleads. **Contested** (single, n=36, y-axis only)._

[^ammar]: Ammar et al. (2023). "The myth of contextual interference…" _Educational Research Review_ 39, 100537. [link](https://www.sciencedirect.com/science/article/abs/pii/S1747938X23000301). \*37 studies: no significant blocked-vs-random difference in applied settings. The counterweight — why variable practice is opt-in and A/B'd, never marketed as proven. **Strong meta-analysis (applied null).\***

[^vickers]: Vickers (2009). "The quiet eye as a bidirectional link…" _Progress in Brain Research_ 174. [link](https://www.sciencedirect.com/science/article/abs/pii/S0079612309013223). \*Pre-shot fixation as a measurable expertise marker → the (experimental, gated) eye-tracking idea. **Established construct; not aim-trainer-specific.\***

[^sala]: Sala, Tatlidil & Gobet (2018). "Video Game Training Does Not Enhance Cognitive Ability." _Psychological Bulletin_ 144(2). [link](https://pubmed.ncbi.nlm.nih.gov/29239631/). \*Near-zero far transfer (k=359). Why OpenAim makes zero cognitive/far-transfer claims. **Strong meta-analysis.\***

[^ftc]: FTC (2016). "Lumosity to Pay $2 Million to Settle FTC Deceptive Advertising Charges." [link](https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program). \*Unsubstantiated transfer claims are legally actionable; standard = "competent and reliable scientific evidence." The claims policy. **Primary/authoritative.\***

[^doclick]: Do, Chang & Lee (2021). "A Simulation Model of Intermittently Controlled Point-and-Click Behaviour." _CHI '21._ [link](https://dl.acm.org/doi/10.1145/3411764.3445514). _Generative sim of point-and-click on moving+static targets; the `D_click` bits difficulty index; perceptual-vs-motor ablation fingerprints. A-priori difficulty (Engine 2) + miss fingerprinting (Engine 1). **Strong-but-caveated** (in-sample, young adults)._

[^icp]: Lee, Kim, Oulasvirta et al. (2020). "Intermittent Click Planning model (ICP)." _CHI '20._ [link](https://dl.acm.org/doi/10.1145/3313831.3376725). \*Predicts click error rate; localizes the elite-vs-novice gap to internal-clock timing precision. The timing axis + real-time submovement pipeline. **Strong-but-caveated.\***

[^servo]: Park, Lee et al. (2020). "Servo-Gaussian model" for continuous tracking. _UIST/VRST '20._ [link](https://dl.acm.org/doi/10.1145/3379337.3415896). _Predicts success in steering & pursuit; positioned for game difficulty tuning. The tracking axes (smoothPursuit, reactivity). **Strong-but-caveated**; personalize corrective RT._

[^swipiness]: Huang / Lee et al. (2022). FPS-aim telemetry & Fitts across scenarios. _Front. Hum. Neurosci._ 16:979293. [link](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9744923/). _Fitts fits within but not across flicking tasks; skilled players shift strategy; the "swipiness" feature. No single global throughput number. **Strong-but-caveated** (32 pro/semi-pro males)._

[^ternary]: (2019). Ternary-Gaussian + Temporal Pointing for moving-target selection. _CHI '19 EA._ [link](https://dl.acm.org/doi/10.1145/3290607.3313077). _Moving-target selection is spatial AND temporal. Why moving-target difficulty always carries a temporal term. **Weak/preliminary** (n=12)._

[^pelanek]: Pelánek (2016). "Applications of the Elo Rating System in Adaptive Educational Systems." _Computers & Education._ [link](https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf). \*Elo as online Rasch; raw %-correct is biased under adaptive selection; deployed at ~75% target success; sizing (~100 plays/item, ~10/user). The rating layer, wholesale. **Strong, deployed at scale (>15M answers).\***

[^zpdes]: Clement, Roy, Oudeyer & Lopes (2015). "Multi-Armed Bandits for Intelligent Tutoring Systems (ZPDES)." _JEDM._ [link](https://files.eric.ed.gov/fulltext/EJ1115278.pdf). \*A learning-progress bandit over a zone of proximal development; knowledge-light beats model-heavy with real kids. The curriculum layer. **Strong (RCT, 400 children).\***

[^fsrs]: FSRS / DSR model (Open Spaced Repetition wiki, 2026). [link](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm). \*Retrievability/Stability/Difficulty; spacing-effect laws; ease-hell mean-reversion; power-law forgetting. The retention/spacing layer. **Strong for declarative memory; re-fit the forms for motor skills.\***

[^lichess]: Lichess Puzzles (wiki). [link](https://lichess.fandom.com/wiki/Puzzles). \*Glicko-2-rated puzzles mined from real games + an "Improvement Areas" weakness view — in-the-wild proof of rating-based drills + weakness targeting. **Deployed product reference.\***

[^kovaaks]: KovaaK's reliability study (2024). _PMC10925653._ [link](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10925653/). \*Scores highly reliable (ICC 0.947–0.995) but do not license in-game inferences; average multiple attempts across sessions. The baselining rules + reliability standard. **Strong (small pilot, n=10).\***

[^neri]: Neri et al. (2021). Adaptive-difficulty CS:GO training. _Front. Psychology_ 12:598410. [link](https://www.frontiersin.org/articles/10.3389/fpsyg.2021.598410/full). _Adaptive difficulty → faster in-game skill gain than fixed (Time×Group p=0.017). The one causal pro-adaptive/pro-transfer lead. **Strong-but-caveated** (n=21, novices, manual "adaptation")._

[^autogain]: Kim et al. (2020). "AutoGain: Gain Function Adaptation with Submovement Efficiency." _CHI '20._ [link](https://dl.acm.org/doi/fullHtml/10.1145/3313831.3376244) · [code](https://github.com/SunjunKim/AutoGain). _Auto-individualizes a gain curve from submovement under/overshoot — the exact signal Engine 1 already computes. Engine 4. **Strong-but-caveated** (single source; optimizes a full curve, not a cm/360 scalar)._

[^voltaic]: Voltaic (2024). "Announcing the Season 5 Aiming Benchmarks (Beta) for KovaaK's." [link](https://blog.voltaic.gg/announcing-the-voltaic-season-5-aiming-benchmarks-beta-for-kovaaks/). \*Evolving taxonomy; anti-spam scoring; the incumbent standard-bearer self-disclaims in-game transfer. **Primary-vendor.\***

[^aimlabs]: Aimlabs — [product page](https://aimlabs.com/aimlabs) · ["Discovery" generative AI](https://medium.com/aimlabs/welcome-to-discovery-aimlabs-generative-ai-for-gaming-9af1bb275c09) · [Steam Aimlabs+](https://store.steampowered.com/app/2253310). \*Markets an AI coach / adaptive tasks / kinematic sub-scores, but "49% faster" has no published study and the metrics no published formula; in hands-on use, a manually-operated veneer, not an integrated system. **Primary-vendor (marketing).\***

[^aimer7]: AIMER7 KovaaK's routine guide (2019). [link](https://steamcommunity.com/sharedfiles/filedetails/?id=1679977919). \*The community's foundational routine — published once, never updated, a static external PDF. The static-routine pain point OpenAim targets. **Primary artifact.\***

[^sini]: Sini — routine-author commentary (2023). [link](https://x.com/sinizap/status/1734652450080989497). \*No single "ideal sens" (a range, playstyle-dependent); transfer is conditional on deliberate practice; changing sens recruits different effectors. Engine 4's range-not-number framing. **Practitioner opinion (informed).\***
