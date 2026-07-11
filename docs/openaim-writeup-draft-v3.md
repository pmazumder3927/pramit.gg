<!--
  NEW DRAFT

  suggested title: i built an aim trainer because i'm bad at valorant
  suggested dek: a browser aim trainer, several fake players, and the mildly
  embarrassing process of auditing my own measurements.
  suggested type: journey
  suggested tags: #valorant #motor-control #statistics #open-source

  publishing notes:
  - This draft is intentionally written from the post-ledger state of the app.
    The original run-level model appears only as the failure that motivated it.
  - Publishable media is stored as content-addressed Supabase Storage objects;
    capture outputs are not committed to the site repository.
  - Custom figures used here: harness-replay, submovement-fig, servo-lab,
    challenge-point, ledger-collapse.
-->

hello.

A lot has happened in my life recently, and as it happens I'm accepting a new position in the birthplace of fallen dreams (san francisco).

I've been trying to take advantage of my freedom while I have it, so I have returned to my love/hate relationship with the video game Valorant. There is one issue with this. I'm bad at it.

When I look at a game, I tend to divide it into micro and macro (for a much better explanation of what that means, [this video](https://www.youtube.com/watch?v=NgHvdCcmQ4o) is helpful). Applied to Valorant, this means that I am paranoid about having good aim. Unfortunately, I am very naturally uninclined towards this end.

The normal tool for this is an aim trainer, or just getting good. I've used aim trainers for quite a while. My favorite routine right now is the [Viscose benchmarks](https://evxl.app/u/joyfired/Viscose%20Benchmarks%20S2/Easier?tab=leaderboards) in KovaaK's, and I think they are honestly really good.

However, as a perception engineer with a Cognitive Science degree and some dabbling in brain-computer interfaces, I felt like I may be uniquely equipped to make this problem much more complicated than it needed to be.

## tl;dr

Most aim training works like this: somebody makes a playlist of scenarios, each one targets a certain skill, and you replay it until the number goes up. The hope is that the number represents better mouse control, which hopefully represents better aim, which even more hopefully transfers to the game.

I had two hangups. First, the scenarios are usually fixed while the player is not. A useful drill for me this week may be too hard now and uselessly easy a month from now. Second, the score tells me that I did badly, but not _how_. A late click, a noisy flick, and a bad prediction of a moving target can all produce the same red number and require completely different practice.

So I made [OpenAim](https://github.com/pmazumder3927/openaim), a browser aim trainer that records the movement underneath the score, tries to explain what failed, and chooses another drill from that explanation. Then I built fake players to test it, discovered several of them were better at cheating my score than I was at aiming, and eventually turned the audit back on the trainer itself.

That last part changed the project quite a bit.

![OpenAim's menu. The coached session is the front door; free play and the analysis tools use the same engine.](https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/1dae03d422a3922f-menu.webp)

---

## a score is a very small answer

Before the math, here is a player who does not exist.

<video autoplay muted loop playsinline poster="https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/1d4e73ff2993b396-2tap-intermediate-24s-poster.webp">
  <source src="https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/1d3ae7fccc8a8bc5-2tap-intermediate-24s-stage-web.mp4" type="video/mp4" />
</video>

_This is a complete 24-second run from an intermediate synthetic player on 2-Tap Strafe: 21 kills from 64 shots, with 67% accuracy. It moves the mouse through the same input path as a person, the engine decides every hit, and the result is saved as a normal replay._

I originally built the replay system because I wanted nicer run history. It ended up becoming the spine of the project.

Every run records the raw mouse samples, rendered camera path, target tracks, scenario seed, sensitivity, and the events that happened. The result is an open `.oar` file. The current format also records when each target actually became hittable, where each shot landed, and the realized target engagements. This means a run is not frozen to whatever scoring rule I happened to like when I played it. I can open it later, reconstruct the same view, and ask a better question.

The first better question was simple: what does a miss contain?

Imagine two identical misses. In the first, the crosshair launches in the wrong direction. In the second, it launches correctly, reaches the target, and the click arrives 40 ms late. A leaderboard compresses both into zero points. As training data, they are almost opposites.

The pointing-device literature gives a useful way to pull them apart. A fast aimed movement is not one perfectly smooth gesture. It usually has a large initial movement, often called the ballistic primary, followed by smaller corrections if the first landing was not good enough.[^meyer]

<submovement-fig></submovement-fig>

There is a second idea underneath this. Motor commands carry signal-dependent noise: as the command gets larger and faster, its endpoint becomes less consistent.[^harris] This does not mean every person's hand obeys one magical straight line forever. It gives me a testable starting model:

```text
endpoint scatter = baseline scatter + speed-dependent scatter
```

The useful word there is _testable_. The motor head fits this per shot in physical hand space, then checks whether the radial errors actually look like the distribution it assumes. If the points are heavy-tailed, directional, or full of occasional lapses, the acceptance dashboard complains instead of turning the mismatch into a personality trait. `you have bad left aim` is not an acceptable conclusion if the real answer is `my spawn geometry was lopsided`.

Tracking has its own version of this problem. The Servo-Gaussian work models continuous tracking as a chain of intermittent corrections with a corrective reaction time, instead of one continuous perfect feedback loop.[^servo] That model predicts the experiments in its paper very well, but its population constants fit 3 of 12 participants poorly. That is not a footnote I want to hide. It is exactly why reaction time and model mismatch should be measured per player.

The little experiment below is not the paper's full equation. It is a picture of the assumptions. Make the target smaller, slow the correction loop, add irregular reversals, or introduce occasional lapses. The clean Gaussian story gets ugly fairly quickly.

<servo-lab></servo-lab>

This is how I now think about most of the science in OpenAim: useful priors that have to survive contact with a person's data. Not commandments.

---

## putting the hand inside a browser

For any of this to work, the input has to be good enough to inspect. I chose the browser because the trainer should be a link, replays should be easy to share, and open-source software is much less open if the first interaction is downloading a mystery executable.

Browsers are not really designed as laboratory equipment, but they expose a surprisingly useful stack. Pointer Lock gives unbounded relative mouse movement. `pointerrawupdate` avoids some of the processing applied to a normal pointer event. `getCoalescedEvents()` recovers the samples that were bundled together before one render callback. On my current hardware I have observed roughly 2 kHz capture through this path. I have _not_ proved that every browser and operating system preserves every sample from an 8 kHz mouse, so the app reports what it actually observed instead of placing `8000 Hz` on a badge and hoping nobody asks.

Latency gets the same treatment. The app can measure two software-visible proxies: how stale an input event was when JavaScript saw it, and how long the frame command waited before submission. It cannot see the mouse sensor, compositor, display scanout, or photons. It shows the proxies and labels the missing region. Nothing currently subtracts an imaginary input-to-photon number from your reaction time.

The run review is intentionally quicker than the research analysis, but it no longer owns a second definition of the movement. The engine closes each engagement through one shared measurement module, and the replay analyzer calls that same module over the recorded series. Separately, the browser and server use the same fold over those finished engagement rows. The Python package is an offline research harness for trying slower fits; it cannot publish a player state.

This distinction sounds pedantic until two versions of a metric disagree about why you missed. Then it becomes the entire product.

---

## i hired fake players to break it

At some point I had a trainer whose entire personality was `the numbers mean something`. This raised an obvious question: says who?

Testing an adaptive trainer with only my own hand is awful. I do not know my true skill, I get tired, I learn, and sometimes I simply decide I would rather be eating. I needed a player whose ground truth I controlled.

So I built a synthetic aimer. It has a reaction delay, a ballistic planner, corrective movements, tracking lag, and signal-dependent endpoint noise. It only sees the same target information a player could see and only acts by producing mouse deltas and button events. Those inputs go through the real engine, recorder, scoring, and replay path. The engine is still the referee.

Then I gave it bad ideas.

The **camper** parks near a high-traffic location and waits for the game to come to it. The **sprayer** fires at the maximum allowed cadence and hopes volume can substitute for aim. The honest player reacts, moves, corrects, and waits until the target is actually acquired. If one of the first two gets most of the reward while doing a fraction of the intended mouse work, the drill fails the audit.

Try them below. The playfield is extracted from real `.oar` files created by the harness, not a separate animation made to look plausible.

<harness-replay></harness-replay>

This was extremely productive and a little humiliating.

The first audit made several dishonest players look brilliant. Most of those results were bugs in the _honest_ player. Its flick planner had a dead path, and it was not properly following moving targets before clicking. My baseline was bad, so the attacks looked good by comparison. This is an easy mistake to make with synthetic evaluation: a test opponent is only useful if the player it is supposed to beat is competent.

After fixing that, the real scoring holes became obvious. The worst was a multi-tap drill where a sprayer could beat the honest player by 4.7 times. The score liked rhythm and volume more than it liked moving the crosshair. I changed the grader and scenario constraints so excess shots cost pace, multi-tap targets require actual reacquisition, and a mechanic cannot sit harmlessly dormant at spawn.

On the current 8-second 2-Tap audit, averaged over three seeds, the honest advanced player scores 2072. The camper scores 467 and the sprayer 595. This is not proof that nobody can invent a better exploit; it means these two known attacks no longer win. The suite now has more than 500 tests so they at least stay dead when I change something else.

The harness also reproduced a `left-side aim bias` that two of my visualizations had confidently attributed to my hand. A simulated player with no left side preference showed the same bias. The culprit was asymmetric spawn geometry plus within-run variance.

I had built an instrument to explain my aim, and the fake player used it to explain a bug in the instrument. This should have been foreshadowing.

There is one large caveat. The synthetic aimer uses many of the same motor assumptions as the model being evaluated. It is very good at finding plumbing errors, broken scoring, trivial drills, and mismatches against a known player. It cannot prove that the assumed noise law describes a human, because it was born inside that law. The harness therefore also runs Rayleigh, lognormal, Student-t, and lapse-heavy players, and checks whether the model raises an alarm when its favorite assumptions are false.

---

## from an explanation to another drill

Diagnosis is only useful if it changes what happens next.

Most aim trainers organize practice around named scenarios. OpenAim also has a small free-play menu, but underneath it a drill is a point in a continuous parameter space: target size, movement amplitude, speed, reversal rate, smoothness, target count, hold time, hits to kill, vertical motion, sensitivity, and a few stranger mechanics like blinking and depth movement. A `Reactive Flick` is a convenient neighborhood in that space, not a special species.

I checked the range against the Viscose Season 2 files by parsing their scenario definitions and reconstructing the central distributions of target size, motion, and mechanics. Of 156 benchmark slots, 132 can be reproduced on the engine. The coverage test brackets the useful middle and most of the expert tracking range. It does not cover every outlier: the generator caps target speed at 72 degrees per second while one extreme benchmark reaches roughly 129. I would rather draw the missing tail than describe the space as infinite.

Say my last few runs were weak on unpredictable tracking. The player model first asks a fairly ordinary question over this unusual drill space:

```text
P(clear the drill) = sigmoid(overall ability - cost of its demands for you)
```

There are fourteen rated demand axes in the player model, plus warm-up and fatigue terms that are deliberately excluded from your ratings. The names are less important than the split. Large physical mouse travel, fine hand precision, click timing, predictable pursuit, and reaction to reversals do not have to move together. Sensitivity is stored as cm/360 so the model can reason about actual hand travel instead of treating screen pixels as muscle.

The first version updated that model once per run. Its coach sampled candidates and added hand-tuned bonuses for uncertainty, weakness, coverage, and variety. It worked well enough to generate a useful session. It was also exactly the kind of stack of heuristics that becomes difficult to defend after the fifth emergency weight named `REGION_FATIGUE`.

The shipped coach now asks what the next minute could teach both my hand and its model. It draws one plausible version of my uncertain profile (Thompson sampling), then values each candidate for two reasons:

```text
value(drill) = expected skill gain + value of what it would teach the model
```

Everything enters through one sampler interface. A generated focus drill goes through the constrained search: for my tracking example it can make the target smaller, faster, or less predictable, but it cannot quietly turn tracking into a click task. A fixed probe passes through unchanged because changing the ruler would defeat the point. Variety is a hard rail rather than another bonus the search can ignore. There is finally one answer to `why did the coach serve this?`

The difficulty target begins around 70% predicted success. That number is a cold-start prior, not a universal law extracted from the Challenge Point paper.[^challenge][^pelanek] If the model predicts I will clear the tracking drill 95% of the time, the sampler can tighten its geometry until it reaches the intended challenge. Probe-bracketed training intervals update a posterior over the learning peak, so the target eventually belongs to the player instead of the source code.

<challenge-point></challenge-point>

Sensitivity follows the same philosophy. I did not make a `sens finder` that announces one correct number. The trainer records every run in physical units and fits baseline scatter separately from speed-dependent scatter across sensitivity. The mastered band is a readout over the engagement ledger, not a little progress variable that can drift away from the evidence. When the coach changes sensitivity, it logs the intervention, holds the comparison geometry still, and measures what part of the hand becomes expensive. AutoGain is an inspiration here, not a claim that its full per-speed gain curve has been reproduced.[^autogain]

The first-session plan below uses a fixed calibration battery before the adaptive coach starts making decisions. After that battery, the same sampler plans the whole session and every block carries its predicted success, pace budget, and reason for being there.

![The first-session calibration plan. Fixed probes establish a baseline before adaptation starts.](https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/01de5121677a4193-coached-briefing.webp)

---

## then I audited the instrument

The premise of this project is that the formulas should be inspectable and the claims should be capable of losing. Eventually it occurred to me that I had applied much more suspicion to Aimlabs than I had to the code I wrote at 2 a.m.

I audited the repository as if it belonged to somebody I did not trust. Every store, formula, publisher, and data path went into a defect register with file and line references.

It did not go great.

The engine already knew the story of every target, including its realized size, spawn position, timing window, shots, and landing errors. At the end of a run, the player model averaged most of that into one scalar and performed one update. A run with 40 engagements was treated as the same fixed amount of evidence as a run with four. I was producing the best data in the system and destroying it immediately before the part that learns.

The core math existed in four representations across the client, server, Python, and a rating inverse. There were three definitions of kill time. Player state was spread across more than a dozen localStorage keys with several writers. The visible difficulty setting did not reach the solver at all. The validation harness planned sessions through a path that production never called. The replay verifier worked on the uncompressed fixtures my seed script uploaded and failed on the compressed `.oarz` files created by the real client. Even when it ran, it checked the first target track, not the full result.

None of these bugs looked dramatic in the UI. Together they meant the system was asking for more trust than its architecture had earned.

This is why the back half of the project became a rewrite instead of another feature.

<ledger-collapse></ledger-collapse>

The rebuilt architecture starts with one sentence: **one fact stream, one fold, one spec.** Here is what that means without the architecture-document voice.

Take target seven from the replay above. It became hittable at one moment, at one actual size and distance, while one sensitivity was active. I fired three times and killed it 846 ms later. That story becomes one engagement row. A timeout becomes a row too. A run and a session are folders around those facts, not replacements for them.

That row is appended to an on-device ledger. To produce my profile, the browser replays the ledger through one deterministic update function. Convex runs the same function over the rows that pass its ingest checks. The client sends what happened, never `trust me, my rating is 2400`. Ratings, weaknesses, and scenario difficulty are views of the result, so they can be recomputed instead of becoming separate numbers that slowly disagree.

The scenario-to-skill map is data too. A physical basis describes what happened in the drill, and a loading matrix maps that basis onto the fourteen rated axes. It starts at exact parity with my hand-written scientific prior. Population data only gets permission to move it when held-out predictions improve. A single server publisher owns that model spec, and its guard blocks a bad one instead of logging a brave warning and continuing anyway.

For a public score, the server folds the checked rows itself. A replay earns verified status only when deterministic re-simulation regenerates those rows and they match, not because the seed produced one convincing target track. The parity monitor stops both sides at the same ledger position and checks that they reached the same profile.

The nice part is that existing profiles survived the move. Replay-backed runs were expanded into detailed engagement rows. Older runs without replays became reduced-weight legacy summaries instead of being granted detail they never recorded. Past-me accidentally made most of the rewrite possible before current-me understood why it was necessary.

---

## what this does not prove

There is a much larger question underneath every aim trainer: does getting better here make you better in Valorant?

For skilled players, there is no study that lets me answer that cleanly. KovaaK's scores have shown excellent test-retest reliability, but the authors explicitly warn that an isolated trainer does not contain the cognitive load of an FPS match.[^kovaaks] A large meta-analysis of video-game training found almost no far transfer to general cognitive ability.[^sala] That is farther than the claim I care about, but it is a good warning against converting `measured reliably` into `improves everything nearby`.

The most encouraging direct result I found is a small CS:GO study where novices given manually adjusted adaptive training improved in-game faster than a fixed-difficulty group.[^neri] There were 21 participants. It supports trying adaptive difficulty. It does not validate OpenAim, and it says very little about a player who has already spent hundreds of hours aiming.

OpenAim has frozen probes and a calibration view, so it can ask whether predicted 70% drills actually produce roughly 70% outcomes and whether improvement survives outside the session. It also logs difficulty jitter, propensities, and a small number of off-policy drills so the teaching model has some causal leverage. There is still no longitudinal Valorant transfer study hiding behind the menu, and calibration inside OpenAim is not the same thing as transfer outside it.

The Commons has a similar limitation. Contribution uses a pseudonymous install ID with no account or public handle required; aggregate contribution is on by default, while raw replay upload and leaderboards are opt-in. Raw mouse traces are potentially biometric data, so replay sharing stays off unless a player deliberately enables it. Learned heads stay dormant until the corpus clears their sample and held-out gates. A crowd cannot rescue a model until there is a crowd, which is why the hand-written map remains the day-one prior rather than being ceremonially deleted.

Finally, the scientific papers are priors from adjacent tasks. Most motor-control work uses laboratory pointing, reaches, steering, or simplified pursuit. It is not a randomized trial of Valorant players. The point of the ledger, the varied synthetic noise laws, fixed probes, and blocking publish guards is to make those assumptions falsifiable with the data OpenAim actually sees.

I do think aim training deserves better measurement than a scoreboard and a vibes-based PDF. I do not yet know how much better measurement transfers. Those are compatible beliefs.

---

## conclusion

I started this because I wanted to know why I missed a shot. I ended up with a browser input recorder, a replay format, a motor model, a scenario engine, a Bayesian coach, several fake players with bad intentions, and a defect register explaining why half of those things needed to be rebuilt.

The part I am happiest with is not that the trainer can produce a precise answer. It is that the project has become better at noticing when the answer is not deserved.

OpenAim may or may not make me good at Valorant. It has already made it considerably harder for me to lie to myself about why I'm bad.

good enough for a weekend.

that's the end. thanks for reading ✦

— pramit ✦ mazumder

---

## references & footnotes

[^meyer]: Meyer, Abrams, Kornblum, Wright & Smith (1988). “Optimality in human motor performance: Ideal control of rapid aimed movements.” _Psychological Review_, 95(3), 340–370. [paper](https://www.researchgate.net/publication/232518277_Speed-Accuracy_tradeoffs_in_aimed_movements_Toward_a_theory_of_rapid_voluntary_action)

[^harris]: Harris & Wolpert (1998). “Signal-dependent noise determines motor planning.” _Nature_, 394, 780–784. [paper](https://www.nature.com/articles/29528)

[^servo]: Park, Lee et al. (2020). “Servo-Gaussian model” for continuous tracking. [ACM](https://dl.acm.org/doi/10.1145/3379337.3415896)

[^challenge]: Guadagnoli & Lee (2004). “Challenge Point: A framework for conceptualizing the effects of various practice conditions in motor learning.” _Journal of Motor Behavior_, 36(2). [paper](https://www.researchgate.net/publication/8574634_Challenge_Point_A_Framework_for_Conceptualizing_the_Effects_of_Various_Practice_Conditions_in_Motor_Learning)

[^pelanek]: Pelánek (2016). “Applications of the Elo Rating System in Adaptive Educational Systems.” _Computers & Education_. [paper](https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf)

[^autogain]: Kim et al. (2020). “AutoGain: Gain Function Adaptation with Submovement Efficiency.” _CHI '20_. [paper](https://dl.acm.org/doi/fullHtml/10.1145/3313831.3376244)

[^kovaaks]: KovaaK's reliability study (2024). Test-retest ICC 0.947–0.995, with an explicit warning against treating trainer scores as in-game performance. [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10925653/)

[^sala]: Sala, Tatlidil & Gobet (2018). “Video Game Training Does Not Enhance Cognitive Ability.” _Psychological Bulletin_, 144(2). [PubMed](https://pubmed.ncbi.nlm.nih.gov/29239631/)

[^neri]: Neri et al. (2021). Adaptive-difficulty CS:GO training. _Frontiers in Psychology_, 12:598410. [paper](https://www.frontiersin.org/articles/10.3389/fpsyg.2021.598410/full)
