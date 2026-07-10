hello.

A lot has happened in my life recently, and as it happens I'm accepting a new position in the birthplace of fallen dreams (san francisco).

I've been trying to take advantage of my freedom while I have it, so I have returned to my love/hate relationship with the video game Valorant. There is one issue with this. I'm bad at it.

When I look at a game, I tend to prioritize the elements of micro and macro (for a really good explanation of what this means, [this video](https://www.youtube.com/watch?v=NgHvdCcmQ4o) may be helpful). Applied to Valorant, this means that I am paranoid about having good aim. The issue is that I'm very naturally uninclined towards this end.

Traditionally, the tool of choice for this is an aim trainer (or just getting good), and I've used those for quite a while. Currently, my favorite is the [Viscose](https://evxl.app/u/joyfired/Viscose%20Benchmarks%20S2/Easier?tab=leaderboards) playlists in Kovaaks, and I think it's honestly really good.

However, as a perception engineer with a Cognitive Science degree and some dabbling in brain-computer interfaces, I felt like I may be uniquely equipped to take a crack at this problem myself.

## tl;dr

Most aim training routines have a principle of "playlists" of scenarios, each targeting a certain skill. In the process of practicing these over and over, you improve your scores, and thus your mouse control and overall transferrable aiming ability as a result.

I had one major hangup on this, however: the scenarios given to you by playlists are static in difficulty, and fundamentally humans tend to improve quicker at tasks when challenged at a frontier only slightly more difficult than their current abilities. That way you get a lot of actionable learning without feeling beat up. Another major annoyance I found was the difficulty of changing sensitivity in aim trainers. It's generally known now that an optimal sens is a myth, and different sens ranges are beneficial for training aim as a general skill and different muscle groups in the chain. Taking all of this into account, I really wanted to make an aim trainer that prioritizes the actual physical movement of your hand as an objective, rather than a score.

So I sat down and wrote a frankly irresponsible amount of code over about a week and made openaim: a trainer that treats every mouse movement as a signal about your motor system, reconstructs how you aimed from that signal, and uses it to close the loop on your individual training. Then — and this is the part I didn't plan — I spent the last stretch of that week auditing my own system the way I'd audit a commercial one, found it wanting, and started a ground-up rewrite of its brain. Both halves of that story are below.

---

## the itch

As a data-driven person, I really wanted to know way more about my aim training scenarios than any program out there currently gives you. I want to know the velocity of my flicks, acceleration curves, timing, and how this compares to other people who aim better than me. Even if you're not quite as psychotic as me in this regard, I figured at the very least I can use this data to better predict how to improve.

Most importantly, I felt like the "smart" commercial stuff is a costume. Aimlabs' store page lists AI coaching, adaptive tasks, generative scenarios, a sensitivity finder, and eight kinematic sub-scores. In reality, if you want optimal training you end up configuring every "adaptive" setting yourself; nothing persistent is modeled about your _ability_ (it logs scores, not skill), the sub-scores ship with no published formula, and the flagship "improve **49% faster**" claim has no study, sample size, or methodology anywhere.[^aimlabs] I did in fact subscribe and use Aimlabs+ for quite a while, and I wasn't quite sold. I decided I could probably do better for free.

I really feel like a lot of aim-training is vibes-based right now. The truth is that a lot of the people who improve quickly have no clue what they're doing, they just have better intuition for improving their aim in the first place. I'm trying to codify this a little more. Cycling had vibes-based training for decades until the power meter showed up and gave a definitive watt number tied to the thing you were actually trying to improve. Aim training is pre-power-meter. It has scoreboards, but no leaderboard measures the underlying thing.

So, in the grand tradition of [the minmaxer's dilemma](/post/the-minmaxer-s-dilemma), I decided the correct response to "just play more" was to spend a week building a measurement instrument instead. The irony that a chronic score-minmaxer built a tool whose entire north star is _stop optimizing the score_ is not lost on me. We'll get there.

---

## the thesis: a flick is not a black box

Everything in openaim sits on one idea from motor-control science, so it's worth actually sitting with it for a minute.

When you snap your crosshair to a target, that movement is not one smooth motion. Fifty years of research says a rapid aimed movement decomposes into a ballistic _primary_ submovement — a big pre-programmed launch — plus optional _corrective_ submovements that clean up the landing.[^meyer] And the reason you _need_ those corrections is the second half of the idea: your neural control signals carry **signal-dependent noise**. The bigger and faster the motor command, the more noise rides along with it, so endpoint error grows linearly with movement speed.[^harris]

That second paper — Harris & Wolpert, _Nature_, 1998, 3000+ citations — is the load-bearing one. A single "minimize the variance caused by signal-dependent noise" principle predicts the trajectories of both eye saccades and arm reaches, and it _derives_ Fitts's law from first principles instead of just curve-fitting it. When a result generalizes across effectors like that, I'm willing to build on it.

<submovement-fig></submovement-fig>

Here's why this matters for a _browser aim trainer_ specifically: all of that is estimable from raw mouse telemetry. I don't need a lab, EMG electrodes, or an eye tracker. I need your mouse deltas at a high enough sample rate, and I can reconstruct the submovement structure, fit your personal noise-vs-speed line, and read off the single most useful number in your whole profile — the slope of that line, your **motor-noise coefficient σᵥ**. That number _is_ your personal speed-accuracy frontier: the fastest you can flick before noise, not skill, dominates the outcome. Take enough samples of it across different scenarios and you can build a vector describing you as a player — and how each property of the thing you're aiming at taxes you.

The anatomy above is static; the behavior is the fun part. Here's the whole thesis in one toy — drag the flick speed and watch the endpoint spread grow linearly with it, then flip corrections on and watch the corrective submovements haul the near-misses back in (and time out the far ones):

<submovement-lab></submovement-lab>

That's the bet. The rest of this post is what I built on top of it — one player model, observed by a diagnosis engine and spent by a coach, in a loop that never stops turning.

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/menu.png  ·  caption: "the trainer itself — a zero-install browser app, everything stays on your machine. the coached session is the front door; free play and the tools sit below." -->

<loop-fig></loop-fig>

---

## getting a clean signal out of a browser

Before any of the science matters, I have to actually _capture_ the movement — and I chose to do it in a browser, which sounds insane for a latency-sensitive input problem. My reasons: zero install, the whole thing is a link you can send someone, replays are shareable, and "open" only means something if there's nothing to download and trust.

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/onboarding.png  ·  caption: "the first thing it asks for: your two physical constants — mouse counts-per-inch and cm/360 — because every drill is built from a *measured* model of your aim, and everything stays on the device." -->

The trick that makes it possible is a stack of three web APIs most people never touch. Pointer Lock hides the cursor and gives you unbounded relative `movementX/Y`, which is mandatory for an FPS feel. `pointerrawupdate` delivers pointer events without the coalescing that normal `pointermove` applies. And `getCoalescedEvents()` is the actual magic: browsers batch input samples into one animation-frame callback, but this method hands you back _every underlying sample_ with its own timestamp. A 1000–8000 Hz mouse produces many samples per rendered frame, and this is how you recover them. I validated real capture at ~2000 Hz on actual hardware.

<input-recovery-fig></input-recovery-fig>

And the part I'm weirdly proud of, because no incumbent does it: the trainer measures its own latency and shows it to you. Since I'm measuring human timing at millisecond scale, the system's own input→photon delay is a confound I have to quantify and subtract, not hide. I'd rather show you the number and its error bars than pretend it's zero. (The in-app probe is honest about its own limits, too — it measures the software pipeline; true input→photon needs hardware, so it says so instead of guessing.)

Every run serializes to an open **`.oar` replay**: a little binary with a magic number, a JSON header (the full scenario spec, seed, your sens/dpi/cm360/fov, capture metadata), and the raw columns packed back-to-back — mouse timestamps, deltas, the rendered camera path, and any moving-target tracks. The format is now on version 2, which also records when each target actually became hittable, your per-shot endpoint error, and the coach's full decision context for the run. It losslessly reconstructs the run, so anything I compute today can be recomputed under a better model tomorrow. Your replays are yours; the format is documented; you can export them. This turns out to matter enormously later in this post, for a reason I didn't anticipate when I built it.

---

## why you missed

This is the part that already does something no incumbent does, and it's where the science cashes out. The flow: raw replay → segment every flick → fit your noise curve → attribute each miss to a mechanism → hand you a picture, not a paragraph.

The segmenter takes the high-rate crosshair trace, smooths the speed profile, and splits each engagement into phases — reaction, ballistic launch, correction, settle — using the same submovement recipe the pointing-device literature validated.[^autogain][^icp] Then it filters out "unaimed" segments (anything pointing way off the target, or overshooting by more than half the distance again), because those aren't corrections, they're you doing something else.

For each ballistic primary it records a `(speed, endpoint error)` pair, and fits the line the thesis promised:

```
SD(endpoint error) = σ₀ + σᵥ · v
```

That's the signal-dependent-noise law, fit to _your_ hand. From it the engine reads two things: your **operating point** (the speed you actually flick at) and your **frontier** (the speed at which predicted error outgrows the target — the fastest you _should_ flick). Here, play with it:

<noise-frontier></noise-frontier>

Then, the diagnosis. A miss isn't a miss — the engine classifies every failed engagement into one of five mechanisms, each with a dissociable telemetry fingerprint (this is the ablation logic from the point-and-click simulation literature, run in reverse[^doclick][^icp]): a **perception** miss looks different from a **planning** miss looks different from a shaky **correction** loop, a **timing** failure, or a **tracking** deficit.

<miss-fingerprints-fig></miss-fingerprints-fig>

My first version of this was a Python-generated markdown report — a wall of cited text. It was correct, and it was boring, and it violated a rule I care about: don't hand someone an AI-ish essay when you could hand them the thing itself. So I deleted it. Diagnosis now lives inside an interactive **Replay Lab**, computed in the browser from the same replay you're watching: 3D playback of your run rendered through the same renderer the live trainer uses; a per-flick scope that draws your crosshair's path in the target's own frame of reference, colored by phase, with the launch vector and the landing dot; and a speed fingerprint with the movement phases shaded behind it. The attribution is click-through — click "correction" and it seeks the scrubber to your _worst_ corrective flick and shows you.

<!-- SCREENSHOT — the Replay Lab needs your real run data (a headless capture can't populate it):
     play a run, open it in the Replay Lab, screenshot, and drop it in via the write room here.
     Caption: "the Replay Lab — 3D playback, the per-flick scope in the target's own frame,
     and the speed fingerprint; click a mechanism to jump to your worst example of it."
     Same deal for a populated Player profile and a Run results card. -->

(The original Python analysis package still exists, but it's been demoted to an offline research harness. Everything the app shows you is computed client-side, from your replay, with the formulas published. More on that demotion later — it was earned.)

---

## a drill is a point in space, not a name

The incumbents think in scenarios: "Reactive Flick," "Strafe Track," a named list you scroll. The second-biggest idea in openaim (after the noise model) is throwing that out. On day one I wrote a scenario generator with hand-named drills; by the end of day one I'd deleted it, because a drill is not a category — it's a point in a parameter space.

Concretely, a drill is a vector of about sixteen numbers: amplitude, target width, target speed, reversal rate, motion smoothness, hold-to-kill time, simultaneous target count, verticality, **absolute sensitivity in cm/360**, pace pressure, hits-to-kill, blink/dash rate, jump/bounce physics, depth pulsing (targets that swell and shrink as they approach and recede), target shape, and invincibility (pure time-on-target tracking). Every community category — flicks, micro, tracking, switching, multi-tap, blink reflex — is just a _region_ of that space. And configurations no human ever hand-authored are just as reachable.

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/scenarios.png  ·  caption: "free play — a curated showcase of sixteen regions of the space, grouped by what each trains. every one of these is just a neighbourhood of the same parameter space." -->

All of it compiles down to one bot simulation, and this is the part that keeps the whole thing honest. Generated coach drills and built-in scenarios execute on a single engine with real mechanics: acceleration-based movement in a Quake/UE style, gravity and bounce physics, flyers, blink dashes with charge systems, HP pools with regen, dodge state machines, and hitscan weapons with cadence, magazines, and reloads — plus faithful KovaaK's scoring. A demand the model prices is a demand that actually runs, and the same instrumentation reads every run identically no matter where the drill came from.

To make sure the generator's reach actually covers real training, I reverse-engineered the **Viscose Season 2 benchmarks** straight from the KovaaK's workshop `.sce` files — a parser for the INI-ish scenario format that reconstructs the bot physics, dodge profiles, and weapon tables. That's 156 benchmark slots (39 scenarios × 4 difficulties), of which 132 are faithfully reproduced on the exact same engine as the generated drills. The point was never to ship a Viscose clone (the replicas now live behind a dev flag); the point was calibration — the coach's sampling ranges are pinned, by an actual unit test, to bracket the demand distributions measured from real Viscose data. "The coach can form any benchmark-shaped drill" is a tested property, not a hope. (One honest ceiling: elite tracking scenarios like RawControlSphere run at ~129°/s, and the coach's target-speed axis caps lower. I know. It's documented, not hidden.)

Then, the payoff: because every drill is a parameter vector, and because I have your motor parameters, I can predict how hard a specific drill will be _for you_, before you play it — using the validated HCI difficulty models for clicking, timing, and tracking.[^doclick][^icp][^servo][^ternary] The same spec is a different difficulty for a different player. That's exactly what the model needs.

---

## one model of you

Here's where it stops being a diagnostic tool and starts being a coach. The core is a **multidimensional online Rasch model** — the multi-axis generalization of Elo — that predicts your probability of success on any drill in the space:

```
P(success | drill x) = σ( w₀ − Σⱼ wⱼ · fⱼ(x) )
```

Read it like this: `w₀` is your general skill. Each `fⱼ(x)` is a **demand feature** — how much the drill loads axis _j_. Each `wⱼ` is what that demand costs _you_ (lower = more capable). The dot product is "how much this specific drill taxes this specific player," squashed through a sigmoid into a hit probability. It's the same family of model that rates chess players and calibrates adaptive tests,[^pelanek] pointed at your mouse hand.

The fourteen demand axes are all cited, and this is the table I'd actually put on a fridge:

| axis            | what it measures                                                                 | grounded in                  |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| `fitts`         | spatial precision — log index of difficulty, sens-invariant by construction      | Fitts / SDN[^harris]         |
| `temporal`      | interception timing — crossing rate ≈ inverse click window                       | ICP[^icp]                    |
| `reactivity`    | reactive-correction load from _unpredictable_ motion                             | Servo-Gaussian[^servo]       |
| `stability`     | sustained on-target hold                                                         | tracking hold                |
| `switching`     | simultaneous-target planning load                                                | multi-target                 |
| `vertical`      | vertical spread / motion (jump-aware)                                            | —                            |
| `armControl`    | **hand-space** travel per flick → arm recruitment                                | SDN in motor coords[^harris] |
| `microControl`  | **hand-space** finger-scale flicks                                               | SDN in motor coords[^harris] |
| `handPrecision` | **hand-space** endpoint precision (fine hand)                                    | SDN in motor coords[^harris] |
| `handSpeed`     | **hand-space** required hand velocity                                            | SDN in motor coords[^harris] |
| `pacePressure`  | time pressure (signed — relaxed can be negative)                                 | —                            |
| `smoothPursuit` | _predictable_ pursuit, dissociated from reactivity                               | Servo-Gaussian[^servo]       |
| `reacquire`     | post-blink / displacement re-lock                                                | submovement re-plan[^meyer]  |
| `cadence`       | repeat-shot commitment at a rhythm                                               | ICP internal clock[^icp]     |

Those four hand-space axes are the quiet heart of the whole sensitivity philosophy: they're computed in absolute physical centimetres of mouse travel, because signal-dependent noise lives in _motor_ coordinates, not screen pixels.[^harris] Which means being a good aimer at 20 cm/360 and at 60 cm/360 are separate, separately-measured capabilities — not the same skill times a multiplier.

<capability-radar></capability-radar>

A few things about how the model actually behaves, because this is where most "adaptive" systems are faking it:

It's a real Bayesian filter, not a scalar. The model carries a full posterior covariance over all the axes, and every result is folded in with a PSD-safe assumed-density update. The consequence that matters: the off-diagonals route one axis's surprise to its correlated neighbours. Do well on a hard micro-flick drill and your fine-hand-precision estimate sharpens _and_ your related axes shift, because the model knows they move together.

It forgets on a clock, not per drill. Idle axes slowly drift back toward uncertainty (a small process-noise bump per day, capped so a two-week layoff can't erase what it knows), so the coach re-probes skills you haven't touched, and "due for a revisit" emerges from the math instead of a to-do list.

A second head predicts your kill time, which gives each drill a personal _pace budget_ — so outcomes are graded on pace and cleanliness, never raw accuracy. A multi-tap kill is graded against its hits-to-kill, not on whether you eventually connected.

And a third head models your consistency separately from your capability: your endpoint scatter as a function of hand speed and sens (the σ₀/σᵥ line from the diagnosis section, kept as a persistent filtered estimate). The radar tells you what you can do; the motor-noise head tells you how repeatably you can do it, splits your error into bias vs variance, and derives a per-sens precision curve.

Everything you see on the profile — including the ratings, which sit on a familiar Elo-style ladder around 2000 — is a pure readout of this one posterior, quoted conservatively (mean minus two standard deviations, so your number is one you've _demonstrated_, not one you've flattered). The profile and the leaderboard read the same number by construction. There is exactly one place a rating can come from, which sounds obvious and took real work to make true.

---

## the coach

Rating you is half of it. The other half is choosing the next drill, and this went through a full rewrite mid-project that I think is worth explaining, because the before/after is the difference between a heuristic and a principle.

The first coach was a pile of hand-weighted heuristics — a bonus for uncertainty, a bonus for weakness, a bonus for learning progress, a penalty for over-serving, each with a tuned weight. It worked, but every weight was a magic number I'd have to defend, and the failure mode was predictable: it fell in love with one mechanic and served me smooth-pursuit drills all session. There is a commit literally titled `stop giving me smooth pursuit`.

The current coach scores every candidate drill with one value function under **Thompson sampling** — each decision draws a plausible version of you from the posterior and acts optimally against the draw, which is a classic, principled way to balance exploring what it doesn't know against exploiting what it does:

```
V(x) = expected skill gain from drill x     (challenge kernel × your learnability × your headroom)
     + β · information gain                 (how much this drill teaches the MODEL about you)
```

The first term is where the education research earns its keep. Learning is dosed through a challenge kernel — a bump centered near the difficulty where practice pays most.[^challengepoint] The coach solves each drill's parameters so your predicted success lands around 0.68, roughly the sweet spot the adaptive-learning literature keeps converging on:[^pelanek] hard enough to drive adaptation, easy enough that you're practicing the skill instead of practicing failing. And it's per-player and per-skill: the kernel is scaled by a learnability estimate fit from your own improvement history, measured on frozen **probes** — fixed-geometry drills that never adapt, scored against a locked pace budget, so the "am I actually improving" signal is honest ground instead of model drift.

<challenge-point></challenge-point>

The second term is Bayesian active learning: drills that would most reduce the model's uncertainty about you are worth serving, and because it's computed from the full covariance, two correlated axes don't get double-counted. An under-trained sensitivity regime or a never-probed mechanic shows up as high posterior variance, and the coach goes looking — no bespoke "exploration bonus" needed.

The smooth-pursuit incident still left a scar, so on top of the objective there are hard variety guarantees rather than soft weights: no single mechanic can own more than about a third of a session, no long unbroken runs of one region, and weakness is measured against a _population_ baseline — so "weak" means weak relative to people, not weak relative to your own best axis. Spacing comes from the forgetting clock: a skill that's been idle becomes worth re-probing on its own. This is the thing a static routine PDF fundamentally cannot do — come back to a skill at the right moment.[^aimer7][^fsrs]

The session itself is assembled, not authored — a transparent plan at real playlist scale (default 30 × 60-second drills, the length of a Viscose routine), with a warm-up, focus blocks, probes, and a sens ladder, and a pre-session briefing that shows every block's predicted success, pace budget, and the reasoning behind the choice.

<session-plan-fig></session-plan-fig>

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/coached-briefing.png  ·  caption: "the generated session plan, live from the app — the block spine, per-capability bars, and each block's predicted success + pace budget. the reasoning behind every choice is shown inline." -->

One more thing the coach does that I haven't seen anywhere: it validates itself. There's a whole profile section that audits the model's own claims against what actually happened — calibration (when it predicted 70%, did you hit 70%?), and probe-anchored dose-response (when it prescribed drills "for" an axis, did that axis actually move?). The system publishing its own report card is the point; a coach that can't be wrong in public can't be trusted in private.

---

## sensitivity as a lever, not a magic number

Sensitivity is where "train the player, not the score" gets concrete, and where I most consciously refused to build the feature everyone expects — a "sens finder" that spits out your One True Number.

openaim treats sensitivity as an absolute physical dimension: cm/360, on a spectrum from 10 to 100 (Valorant pros live around 84, so it has to fit). The goal isn't your best sens; it's a player who is objectively capable across the whole spectrum.[^sini] Three pieces:

An **AutoGain anchor**. The same under/overshoot signal the diagnosis already computes tells you if your gain is mismatched: land consistently short in a speed band and your gain there is too low; overshoot and it's too high.[^autogain] The coach nudges your anchor toward _learnable_ errors — a gain matched to your motor system so a miss reflects your noise, not you fighting a bad transfer function. A well-matched gain can even lower your score at first while you stop compensating. That's allowed. That's the point.

A **mastered band** around that anchor, and a sens ladder in the session plan that replays one solved geometry at the band's edges. Hold an edge and the band expands outward. "A good aimer at every sensitivity" becomes a measurable state — capability held across the band — instead of a slogan.

And prescribed sensitivities are honored: some fingertip work genuinely mandates a fast sens; the trainer runs it at that, badges it in the menu, and stamps it in the replay.

<sens-spectrum></sens-spectrum>

<!-- SCREENSHOT — upload via the write room, then paste the returned image here.
     source file: openaim-screenshots/settings.png  ·  caption: "the settings "bench console" — a live scope with your reticle, your sens resolved to an absolute cm/360, and the theme system (the whole app is theme-aware, which is why the figures in this post are too)." -->

The profile ties this together in one instrument I'm fond of: a single "your spectrum" strip that lays your capability ribbon, your mastered band, and each drill family's likely-optimal sens on one shared cm/360 axis. That last part falls out of the model for free — because sens is just another dimension of the drill vector, I can sweep it and read off where your predicted success peaks, per task. It's a pure readout, not a prescription; the interesting thing is watching the peaks sit at _different_ places for micro-precision work versus big arm swings, which is the whole "range, not number" argument drawn from your own data.

---

## the aim commons: from a sample size of one to a population

Everything so far works for a single player, but a single player has a cold-start problem: the first session, the model knows nothing, and the adaptive-testing literature says you need on the order of a hundred plays to calibrate an item and ten to rate a person.[^pelanek] The fix is to let the crowd teach the model, carefully.

The **Aim Commons** is a shared data pool with three independent consent scopes: de-identified per-run feature rows (on by default, anonymous), raw replays (opt-in, and currently gated — more below), and a public handle for leaderboards (opt-in). Aggregate rows are stored under a salted hash of a client-minted id, so there's no reversible identity in the corpus, and revoking actually purges you.

The interesting math is the population model: a factor model over players × axes,

```
Σ_pop = L·Lᵀ + diag(ψ)
```

where each contributor's own fit noise is subtracted before estimating the between-player covariance — so the learned manifold is real human variation, not fitting artifacts. That correlated prior is what a new player gets seeded with: after a couple of runs the model can say "players shaped like you tend to be here on the axes you haven't shown me yet," which collapses the cold start from sessions to minutes.

<commons-fig></commons-fig>

And because leaderboards attract cheaters the way porches attract raccoons, the integrity model has teeth. Every submission is re-checked for feature parity (the demand features are recomputed on the server and must match to 1e-6) and screened for superhuman kill times — but the `verified` badge is only earned by **re-simulation**. The engine is a pure function of `(spec, seed, inputs)` with no wall-clock anywhere, so a verifier can replay your recorded mouse inputs through the same deterministic engine and demand a bit-exact result. A forged seed or doctored geometry can't reproduce even the first target's motion.

Honest status: the backend is deployed and the full train → publish → serve loop runs, but the population data is still synthetic seed — the "population" is basically a pilot prior wearing a costume until real people contribute. And the raw-replay tier is built but deliberately gated, because uploading raw human kinematics is a biometric/consent question I'm not going to hand-wave. Flipping that on is a decision I haven't made, and I'd rather ship the gate than the regret.

---

## the bots I hired to rob the place

At this point I had a trainer whose whole identity is "the numbers are honest," which raises an uncomfortable question: says who? A scoring system nobody has tried to cheat is not honest, it's untested.

So I built a synthetic player: a mechanistic aim controller — reaction delay, submovement planner, signal-dependent noise injection, the same model the diagnosis assumes — that drives the _real_ engine through the real input path and produces byte-compatible `.oar` replays. Point it at the coach and you can run a thousand sessions of a fake human through the exact pipeline a real human uses: does the coach converge? does difficulty land where predicted? does a player with a deliberately weak axis get diagnosed with that weak axis?

Then the fun part: I made dishonest ones. A **sprayer** that clicks as fast as the game allows and lets spam do the aiming. A **camper** that parks on the highest-traffic beam and refuses to chase. A **2-tap reader** that ignores aim entirely and exploits rhythm. Each adversary plays every drill family, and the exploit audit asks one question: does any dishonest strategy out-score the honest aimer it should lose to?

<cheat-lab></cheat-lab>

The first audit was humbling in an unexpected direction: most of the "exploits" it flagged turned out to be bugs in my _honest_ bot, not holes in the scoring — the baseline was artificially weak (its flick planner had a dead code path; it didn't track moving targets before clicking), which made the cheaters look brilliant. That itself is a finding about this kind of testing: your exploit audit is only as good as your honest baseline. After fixing the aimers, the real holes stood out cleanly — the worst was multi-tap drills, where a rhythm-reading sprayer out-scored the honest player by 4.7× — and each got a targeted fix in the grader or the drill generator (spam now costs pace, switch kills require actual crosshair travel, no mechanic sits dormant at spawn for a camper to farm). The audit now passes with zero exploitable families, and it runs as a standing test suite — 451 tests — so a future change that re-opens a hole fails CI instead of shipping.

My favorite side-effect: the audit caught a "left-side aim bias" in my own play that two separate viz layers had confidently displayed. The synthetic player — which by construction has no bias — showed the same signal. It was within-run variance plus asymmetric spawn geometry, not a property of my hand. The instrument debugged the instrument.

---

## then I turned the audit on myself

Here's the part of the story I didn't plan.

The whole premise of this project is auditing other people's claims — Aimlabs' unpublished formulas, unproven transfer promises. Around day five, with the system working end to end, I sat down and audited mine the same way: every store, every formula, every data path, written up as a defect register with file-and-line citations, as if I were reviewing a stranger's codebase I was inclined to distrust.

It did not go great, and I mean that as a compliment to the process. A week of build-fast decisions had quietly accumulated exactly the kind of debt my own manifesto complains about. The model's math existed in four copies (TypeScript client, server, Python, plus an algebraic inverse) held in sync by discipline and one parity test. There were three different definitions of "kill time" in three subsystems, which could disagree by the length of a respawn animation. Player state lived in over a dozen localStorage keys with three writers racing each other. The user-facing difficulty slider, it turned out, steered nothing — a dead knob rendering faithfully. The validation harness — the thing whose job was to catch problems — ran sessions through a code path production never used. Even the anti-cheat re-simulator had a hole: it verified the replays my own seeding script uploaded perfectly, and choked on a compression step for replays uploaded the way a real user's client does — which is to say, it was "live-verified" against exactly the inputs that couldn't expose it. And the deepest one: the engine measured every single target engagement in beautiful detail, and then the model averaged a run into one scalar and learned from that. The best data in the system was being produced and then destroyed before the part that learns ever saw it.

None of these were visible from the outside. All of them were the same species of rot I'd built the project to fight. So the last act of the week was to start a ground-up rewrite of the data-and-model layer — specced first, honestly, with the same citation discipline as the science. I generated four independent candidate architectures, had them scored against weighted criteria by a judge panel, and synthesized the winner. (Yes, I use AI agents for this. A solo dev shipping a Bayesian coach, a deterministic replay verifier, and an adversarial audit harness in a week is a story about leverage, and I'd rather be plain about it.)

The rewrite is called the **ledger**, and it's built on one sentence: _one fact stream, one fold, one spec._

<ledger-fig></ledger-fig>

The atomic fact becomes the **engagement row** — one target's full story: the geometry you actually faced (not the nominal spec — the realized spawn distance, the sampled size, the measured speed), what you did about it, how long it took, and where every shot landed. Timeouts are rows too, as ground truth instead of statistical inference. The model updates once per engagement instead of once per run, which sounds like an implementation detail and is actually the statistical heart: a 40-kill run finally carries ten times the evidence of a 4-kill run, the natural within-run variation in spawn geometry gives the model the leverage to tell "you got better overall" apart from "this axis got cheaper" (a confound the old run-scalar model papered over with patches), and per-run mood — warm-up, tilt, fatigue — is modeled explicitly instead of leaking into your skill estimate.

Player state stops being a thing that's stored and becomes a thing that's _computed_: a deterministic fold over the event stream. The same fold code runs in your browser (live, offline-first) and on the server (canonical, for leaderboards) — client and server agree because they compute the same function on the same facts, which deletes the four-copy math problem outright rather than disciplining it. It's also quietly a stronger anti-cheat: the client never uploads a skill estimate at all, only facts, so there is no posterior to forge.

And the scenario→skill mapping — the hand-tuned table that says "this geometry loads that axis this much" — becomes data the population can correct: a learned loading matrix that starts exactly equal to today's hand-coded map and is only allowed to depart from it on gated, held-out-validated evidence, behind a publish guard that _blocks_ instead of warning. The hand-coded science stays as the prior; the crowd's data earns the right to overrule it.

As I write this, the shared math package is extracted and the engine is emitting engagement rows with a live shadow check proving they reproduce the old grades; the app you'd play today still runs on the v1 brain while the ledger lands stage by stage underneath it. And the reason a ground-up rewrite of the model layer is even affordable: the `.oar` replays. Because every run since the second commit is raw telemetry with a documented format, the new model doesn't cold-start — it back-fills. Every engagement row is recomputable from the archive. Past-me accidentally did future-me the biggest favor in the project.

<timeline-fig></timeline-fig>

---

## the one thing I refuse to fake: transfer

Here's the part where every other trainer either lies or goes quiet, so I want to be loud about it.

Does aim-trainer practice actually make you better at the real game? For skilled players, _there is no verified study that says yes._ It's not that the answer is no — it's that nobody has properly measured it. The surrounding evidence is genuinely sobering: video-game training shows near-zero far transfer to general cognitive ability across a 359-effect meta-analysis.[^sala] KovaaK's scores are extremely _reliable_ (test-retest ICC 0.947–0.995), but the study's authors explicitly warn this does not license inferences about in-game FPS performance, because the trainer strips out real gameplay's cognitive load.[^kovaaks] Voltaic itself disclaims it — the benchmarks are "just one piece of the puzzle."[^voltaic] And Lumosity paid the FTC $2 million for marketing exactly this kind of unproven transfer claim.[^ftc]

The one genuinely encouraging result is Neri et al. (2021): novices on _adaptive-difficulty_ CS:GO training improved in-game faster than a fixed-difficulty group.[^neri] But n=21, the "adaptive algorithm" was a researcher manually swapping bot configs, and they were novices, not plateaued enthusiasts. It supports the thesis. It does not prove my system.

So openaim's stance is: transfer is the central open question, not a settled premise. The product is built to _measure_ it — spaced retention on frozen probes instead of same-session scores, test-retest reliability reported for every metric, and (opt-in, eventually) linkage to in-game stats so the correlation can actually be computed. The honest line is _"I measure X reliably; whether it transfers is what I'm studying — here's the current data,"_ and that line is the entire difference between this and a Lumosity.

This is also why the north star is train the player, not the score. Wherever "get a better number on this scenario" and "become a fundamentally better aimer" point in different directions — and they diverge constantly — openaim follows the second, even when it lowers your score today. The sens that gives your best score is often the one you've overfit muscle memory to. The schedule that makes your in-session number climb fastest is worse for durable learning.[^cretton][^ammar] A benchmark you can grind is a benchmark you'll cheese (see: the robot sprayer). So the system optimizes the latent capability the score is a proxy for, and treats the score as an instrument reading, not the target.

(Yes. The minmaxer built an anti-minmaxing machine. Character growth.)

There's also one claim I had to kill during my own research. I really wanted to use a square-root difficulty law — it's a cleaner metric than log-Fitts — but when I adversarially fact-checked the sources, it didn't survive (it overreaches the 1988 paper and later work contradicts it).[^meyer] So it's out. Every number ships with a citation, and citations that don't hold up get cut, even the convenient ones. That's the deal I made with myself.

---

## what's honestly not there yet

In the spirit of every other build post I've written — here's what's held together with tape:

- **The transfer study doesn't exist yet.** The harness is built; the actual longitudinal, in-game-linked study is the whole point and it's unrun. Everything I claim about transfer is "we're measuring it," not "it works."
- **The commons is a ghost town.** The backend is live and the loop works, but the population is synthetic seed data until real people contribute. Contribution is anonymous and on by default specifically to fix this.
- **The rewrite is mid-flight.** The ledger is specced end-to-end and landing in stages behind shadow checks, but the app you'd play today runs the v1 model. If you're reading this within a few weeks of publication, you're playing the "before" while the "after" backfills.
- **The science is priors, not gospel.** The motor-control laws are validated on static targets and saccades, not FPS tracking. The difficulty models are mostly in-sample, small-n, young-adult. The spacing model is a declarative-memory model, and motor retention isn't the same thing — I reuse the machinery but haven't re-fit the functional forms on real motor-retention data. All flagged in-app.
- **Eye tracking is vaporware-adjacent.** The quiet-eye idea[^vickers] is scoped and honest, but webcam gaze is too low-accuracy to be in the loop, so it isn't.
- **The tracking speed ceiling.** The coach can't yet generate the fastest elite tracking scenarios (~129°/s); its speed axis caps lower.

None of these are secrets in the app. That's sort of the whole bit.

---

## conclusion

I set out to answer a stupidly simple question — _why did I miss that shot?_ — and it turned into a measurement instrument: a submovement decomposer, a Bayesian model of a mouse hand, a deterministic engine that can re-simulate any run to catch cheaters, a robot burglar crew for auditing my own scoring, and, when the audit finally pointed inward, a rewrite honest enough to admit the first version's brain wasn't good enough.

The thing I actually believe, under all the machinery: aim training deserves to be a measurement science, not a scoreboard with vibes. Every mouse movement is a signal about your motor system, and if you take that seriously — segment it, fit it, cite it, and refuse to lie about what it means — you can build something that tells you the truth about your own hands. Whether that truth carries into the game is the honest open question, and I'd rather ship the question with a ruler attached than ship a promise.

It will never produce a perfect aimer. But it tells you, today, exactly where your noise lives.

That's the end. Thanks for reading ✦

— pramit ✦ mazumder

---

## references & footnotes

_Every load-bearing claim above traces to one of these. Confidence is flagged honestly: where the science is foundational I lean on it; where it's single-study, contested, or borrowed from an adjacent field, it's a prior to re-validate, and I say so._

[^meyer]: Meyer, Abrams, Kornblum, Wright & Smith (1988). "Optimality in human motor performance: Ideal control of rapid aimed movements." _Psychological Review_ 95(3), 340–370. [link](https://www.researchgate.net/publication/232518277_Speed-Accuracy_tradeoffs_in_aimed_movements_Toward_a_theory_of_rapid_voluntary_action). _The stochastic optimized-submovement model — ballistic primary + corrections; endpoint SD grows linearly with velocity. The backbone of the diagnosis. **Strong/foundational**, but on static discrete targets; its √-law framing was the one claim I refuted._

[^harris]: Harris & Wolpert (1998). "Signal-dependent noise determines motor planning." _Nature_ 394, 780–784. [link](https://www.nature.com/articles/29528). _A single minimum-variance / signal-dependent-noise principle predicts both saccades and reaches and derives Fitts's law. Grounds σᵥ and the four hand-space axes. **Strong/foundational.**_

[^challengepoint]: Guadagnoli & Lee (2004). "Challenge Point: A framework for conceptualizing the effects of various practice conditions in motor learning." _J. Motor Behavior_ 36(2). [link](https://www.researchgate.net/publication/8574634_Challenge_Point_A_Framework_for_Conceptualizing_the_Effects_of_Various_Practice_Conditions_in_Motor_Learning). _Learning peaks at a per-performer optimal challenge point; difficulty is functional, not fixed. The theoretical backbone of the coach's difficulty targeting. **Strong theory; hard to operationalize exactly.**_

[^cretton]: Cretton et al. (2025). "When Random Practice Makes You More Skilled: Applying the Contextual Interference Principle to a Simple Aiming Task." _J. Cognitive Enhancement._ [link](https://link.springer.com/article/10.1007/s41465-025-00317-5). _Random-order mouse-aiming practice: worse during training, better at retention/transfer. Motivates variable practice; corollary that in-session score misleads. **Contested** (single, n=36, y-axis only)._

[^ammar]: Ammar et al. (2023). "The myth of contextual interference…" _Educational Research Review_ 39, 100537. [link](https://www.sciencedirect.com/science/article/abs/pii/S1747938X23000301). _37 studies: no significant blocked-vs-random difference in applied settings. The counterweight — why variable practice is never marketed as proven. **Strong meta-analysis (applied null).**_

[^vickers]: Vickers (2009). "The quiet eye as a bidirectional link…" _Progress in Brain Research_ 174. [link](https://www.sciencedirect.com/science/article/abs/pii/S0079612309013223). _Pre-shot fixation as a measurable expertise marker → the (experimental, gated) eye-tracking idea. **Established construct; not aim-trainer-specific.**_

[^sala]: Sala, Tatlidil & Gobet (2018). "Video Game Training Does Not Enhance Cognitive Ability." _Psychological Bulletin_ 144(2). [link](https://pubmed.ncbi.nlm.nih.gov/29239631/). _Near-zero far transfer (k=359). Why openaim makes zero cognitive/far-transfer claims. **Strong meta-analysis.**_

[^ftc]: FTC (2016). "Lumosity to Pay $2 Million to Settle FTC Deceptive Advertising Charges." [link](https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program). _Unsubstantiated transfer claims are legally actionable; standard = "competent and reliable scientific evidence." The claims policy. **Primary/authoritative.**_

[^doclick]: Do, Chang & Lee (2021). "A Simulation Model of Intermittently Controlled Point-and-Click Behaviour." _CHI '21._ [link](https://dl.acm.org/doi/10.1145/3411764.3445514). _Generative sim of point-and-click on moving+static targets; a-priori difficulty + the perceptual-vs-motor ablation fingerprints behind miss attribution. **Strong-but-caveated** (in-sample, young adults)._

[^icp]: Lee, Kim, Oulasvirta et al. (2020). "Intermittent Click Planning model (ICP)." _CHI '20._ [link](https://dl.acm.org/doi/10.1145/3313831.3376725). _Predicts click error rate; localizes the elite-vs-novice gap to internal-clock timing precision. The timing axis + submovement pipeline. **Strong-but-caveated.**_

[^servo]: Park, Lee et al. (2020). "Servo-Gaussian model" for continuous tracking. _UIST/VRST '20._ [link](https://dl.acm.org/doi/10.1145/3379337.3415896). _Predicts success in steering & pursuit; positioned for game difficulty tuning. The tracking axes (smoothPursuit, reactivity). **Strong-but-caveated**; personalize corrective RT._

[^ternary]: (2019). Ternary-Gaussian + Temporal Pointing for moving-target selection. _CHI '19 EA._ [link](https://dl.acm.org/doi/10.1145/3290607.3313077). _Moving-target selection is spatial AND temporal. Why moving-target difficulty always carries a temporal term. **Weak/preliminary** (n=12)._

[^pelanek]: Pelánek (2016). "Applications of the Elo Rating System in Adaptive Educational Systems." _Computers & Education._ [link](https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf). _Elo as online Rasch; raw %-correct is biased under adaptive selection; deployed at ~75% target success; sizing (~100 plays/item, ~10/user). The rating layer, wholesale. **Strong, deployed at scale (>15M answers).**_

[^fsrs]: FSRS / DSR model (Open Spaced Repetition wiki, 2026). [link](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm). _Retrievability/Stability/Difficulty; spacing-effect laws; power-law forgetting. The retention/spacing layer. **Strong for declarative memory; re-fit the forms for motor skills.**_

[^kovaaks]: KovaaK's reliability study (2024). _PMC10925653._ [link](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10925653/). _Scores highly reliable (ICC 0.947–0.995) but do not license in-game inferences; average multiple attempts across sessions. The baselining rules + reliability standard. **Strong (small pilot, n=10).**_

[^neri]: Neri et al. (2021). Adaptive-difficulty CS:GO training. _Front. Psychology_ 12:598410. [link](https://www.frontiersin.org/articles/10.3389/fpsyg.2021.598410/full). _Adaptive difficulty → faster in-game skill gain than fixed (Time×Group p=0.017). The one causal pro-adaptive/pro-transfer lead. **Strong-but-caveated** (n=21, novices, manual "adaptation")._

[^autogain]: Kim et al. (2020). "AutoGain: Gain Function Adaptation with Submovement Efficiency." _CHI '20._ [link](https://dl.acm.org/doi/fullHtml/10.1145/3313831.3376244) · [code](https://github.com/SunjunKim/AutoGain). _Auto-individualizes a gain curve from submovement under/overshoot — the exact signal the diagnosis already computes. **Strong-but-caveated** (single source; optimizes a full curve, not a cm/360 scalar)._

[^voltaic]: Voltaic (2024). "Announcing the Season 5 Aiming Benchmarks (Beta) for KovaaK's." [link](https://blog.voltaic.gg/announcing-the-voltaic-season-5-aiming-benchmarks-beta-for-kovaaks/). _Evolving taxonomy; anti-spam scoring; the incumbent standard-bearer self-disclaims in-game transfer. **Primary-vendor.**_

[^aimlabs]: Aimlabs — [product page](https://aimlabs.com/aimlabs) · ["Discovery" generative AI](https://medium.com/aimlabs/welcome-to-discovery-aimlabs-generative-ai-for-gaming-9af1bb275c09) · [Steam Aimlabs+](https://store.steampowered.com/app/2253310). _Markets an AI coach / adaptive tasks / kinematic sub-scores, but "49% faster" has no published study and the metrics no published formula; in hands-on use, a manually-operated veneer, not an integrated system. **Primary-vendor (marketing).**_

[^aimer7]: AIMER7 KovaaK's routine guide (2019). [link](https://steamcommunity.com/sharedfiles/filedetails/?id=1679977919). _The community's foundational routine — published once, never updated, a static external PDF. The static-routine pain point openaim targets. **Primary artifact.**_

[^sini]: Sini — routine-author commentary (2023). [link](https://x.com/sinizap/status/1734652450080989497). _No single "ideal sens" (a range, playstyle-dependent); transfer is conditional on deliberate practice; changing sens recruits different effectors. The range-not-number framing. **Practitioner opinion (informed).**_
