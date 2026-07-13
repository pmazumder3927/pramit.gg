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
    challenge-point, sens-spectrum, aim-model-playground, ledger-collapse.
-->

hello.

A lot has happened in my life recently, and as it happens I'm accepting a new position in the birthplace of fallen dreams (san francisco).

Exciting as this is, it means I will have to work again. I've been trying to take advantage of my freedom while I have it, so I have returned to my love/hate relationship with the video game Valorant. There is one issue with this: I'm bad at it.

When I look at a game, I tend to divide it into micro and macro (for a much better explanation of what that means, [this video](https://www.youtube.com/watch?v=NgHvdCcmQ4o) is helpful). Applied to Valorant, this means that I am paranoid about having good aim. Unfortunately, I am very naturally uninclined towards this end.

The normal tool for this is an aim trainer, or just getting good. I've used aim trainers for quite a while. My favorite routine right now is the [Viscose benchmarks](https://evxl.app/u/joyfired/Viscose%20Benchmarks%20S2/Easier?tab=leaderboards) in KovaaK's, and I think they are honestly really good.

However, as a perception engineer with a Cognitive Science degree and some dabbling in brain-computer interfaces, I felt like I may be uniquely equipped to make this problem much more complicated than it needed to be.

## tl;dr

Most aim training works like so: somebody makes a playlist of scenarios, each one targets a certain skill, and you replay them until the number goes up. The hope being that this number represents better mouse control, which hopefully represents better aim, which even more hopefully transfers to the game you're playing.

I had two hangups with this norm. First, the scenarios are usually fixed while the player is not. Anyone that's played an older Voltaic playlist knows this feeling, where the gap between the scenarios in the easiest playlist and the next one sometimes feels insurmountable. However, humans generally improve quickest at a slight challenge point, and this is very sensitive per player. This is one of the good parts of Viscose, difficulty jumps much less and keeps the player anchored on improvement. Second, scores give an overall read of the targets you clicked, but not _how_. If you clicked on a target late, or your wrist was shaky, or you just got tired, the end result is still just a single number that provides insight on only the peak of your performance on this one specfic scenario.

So I made [openaim](https://openaim.pramit.gg/), a (free!) aim trainer that records your raw mouse movements and tries to estimate your actual motor proficiency skills with the mouse, instead of a score on a scenario. Then, an algorithmically-motivated coach generates drills to make scenarios that are just hard enough to foster improvement, in all the specific skills you're the worst at.

I wanted this article to be interesting to anyone interested in FPS games and aim trainers, as well as giga nerds like myself. This lended itself to a difficult to balance and technically dense writeup, so buckle up.

![OpenAim's menu](https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/1dae03d422a3922f-menu.webp)

---

## a score is a very small answer

Before the specifics, here is a player who does not exist.

<video autoplay muted loop playsinline poster="https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/1d4e73ff2993b396-2tap-intermediate-24s-poster.webp">
  <source src="https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/1d3ae7fccc8a8bc5-2tap-intermediate-24s-stage-web.mp4" type="video/mp4" />
</video>

_This is a 24-second run from a synthetic generated player on 2-Tap Strafe_

In order to get here, we have to start from the data. With my industry being where it is, it was incredibly tempting to jump to a transformer, but it's good practice to first find the simplest model that can accurately represent your objective. So the first natural question is, given a player's mouse inputs and an aim scenario, what can we estimate? The underlying system is, of course, a human, using a chain of very complicated muscles, including a feedback loop between your brain, arm, wrist, and fingertips. The output is literally just how much the mouse went up and down. So, given our run's raw mouse samples, camera angle, scenario targets, and sensitivity, we can make a decent back estimation of what your actual hand is.

In order to do this I tackled first the goliath that Riot Games dared not to till recently: a replay system. This would allow me to make a dataset of myself, then test the fit of models without losing data. This means a run is not frozen to whatever scoring rule I happened to like when I played it. I can open it later, reconstruct the same view, and ask a better question later on.

The first better question was simple: what does a miss contain?

Imagine two identical misses. In the first, the crosshair launches in the wrong direction. In the second, it launches correctly, reaches the target, and the click arrives 40 ms late. A leaderboard compresses both into zero points. As training data, they are almost opposites.

# reminder that I went to college for this

Human motor control theory has been around for a long time, and scientists have been building models for how your perception-motor stack responds to inputs for decades. I decided that in the spirit of my background this would be a good place to start.

The pointing-device literature gives a useful way to pull them apart. A fast aimed movement is not one perfectly smooth gesture. It usually has a large initial movement, often called the ballistic primary, followed by smaller corrections if the first landing was not good enough.[^meyer] Most members of the aim training community know this already, and there's a popular approach called the bardoz method that rests on this principle. This principle is actually quantifiably true, looking at a (smoothed) graph of one of my own flicks:

<submovement-fig></submovement-fig>

There is a second idea underneath this. Motor commands carry signal-dependent noise: as the command gets larger and faster, its endpoint becomes less consistent.[^harris] This does not mean every person's hand obeys one magical straight line forever. It gives me a testable starting model:

$$
\sigma_{\text{endpoint}}(v)
=
\sigma_{\text{baseline}}
+
\sigma_{\text{speed}}(v)
$$

where $v$ is movement speed, $\sigma_{\text{baseline}}$ is the player's speed-independent endpoint scatter, and $\sigma_{\text{speed}}(v)$ is the additional scatter associated with moving faster.

The useful word there is _testable_. The motor head fits this per shot in physical hand space, then checks whether the radial errors actually look like the distribution it assumes. If the points are heavy-tailed, directional, or full of occasional lapses, the acceptance dashboard complains instead of turning the mismatch into a personality trait. `you have bad left aim` is not an acceptable conclusion if the real answer is `my spawn geometry was lopsided`.

Tracking has its own version of this problem. The Servo-Gaussian work models continuous tracking as a chain of intermittent corrections with a corrective reaction time, instead of one continuous perfect feedback loop.[^servo] That model predicts the experiments in its paper very well, but its population constants fit 3 of 12 participants poorly. That is not a footnote I want to hide. It is exactly why reaction time and model mismatch should be measured per player.

The little experiment below is not the paper's full equation. It is a picture of the assumptions. Make the target smaller, slow the correction loop, add irregular reversals, or introduce occasional lapses. The clean Gaussian story gets ugly fairly quickly.

<servo-lab></servo-lab>

Thus, with the help of some 50 (!)+ year old literature, we have some useful bootstraps for creating a model of a person's aim.

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

I had built an instrument to explain my aim, and the fake player used it to explain a bug in the instrument. This should have been foreshadowing.

There is one large caveat. The synthetic aimer uses many of the same motor assumptions as the model being evaluated. It is very good at finding plumbing errors, broken scoring, trivial drills, and mismatches against a known player. It cannot prove that the assumed noise law describes a human, because it was born inside that law. The harness therefore also runs Rayleigh, lognormal, Student-t, and lapse-heavy players, and checks whether the model raises an alarm when its favorite assumptions are false.

---

## what now?

So we have a lot of data to form a diagnosis of a player. A dignosis is only useful if you can do something with it, however, so what now?

Most aim trainers organize practice around named scenarios. OpenAim also has a small free-play menu, but underneath it a drill is a point in a continuous parameter space: target size, movement amplitude, speed, reversal rate, smoothness, target count, hold time, hits to kill, vertical motion, sensitivity, and a few stranger mechanics like blinking and depth movement. A `Reactive Flick` is a convenient neighborhood in that space, not a special species.

Say my last few runs were weak on unpredictable tracking. The player model first asks a fairly ordinary question over this unusual drill space:

$$
P(\text{clear the drill})
=
\operatorname{sigmoid}(a-c)
=
\frac{1}{1+e^{-(a-c)}}
$$

where $a$ is overall ability and $c$ is the player-specific cost of the drill's demands.

There are fourteen rated demand axes in the player model, plus warm-up and fatigue terms that are deliberately excluded from your ratings. The names are less important than the split. Landing a far flick, intercepting a moving target, staying attached to a smooth one, reacting to a reversal, choosing between four live targets, and firing three controlled shots in a row are all different requests. Large physical mouse travel and tiny endpoint precision are different requests too.

This is not fourteen new scores stapled to the end of a run. Each target engagement is projected into a fourteen-number **demand vector**: how much that moment asked for spatial precision, timing, reactivity, stability, switching, vertical control, arm-range control, micro control, fine-hand precision, hand speed, pace, smooth pursuit, reacquisition, and cadence. The player model learns which of those demands are expensive _for you_. That distinction matters: a bar below can say `this drill strongly loads reactivity`; only your history can say `reactivity is one of your weaknesses`.

The playground is the closest visual translation of the model I could make. Pick a familiar scenario shape, then change its geometry. The left side is what happens on screen. The right side is a scaled proxy for the physical mouse displacement. Underneath, the same scenario lights up the fourteen demands the coach sees.

<aim-model-playground></aim-model-playground>

The first version updated that model once per run. Its coach sampled candidates and added hand-tuned bonuses for uncertainty, weakness, coverage, and variety. It worked well enough to generate a useful session. It was also exactly the kind of stack of heuristics that becomes difficult to defend after the fifth emergency weight named `REGION_FATIGUE`.

The shipped coach now asks what the next minute could teach both my hand and its model. It draws one plausible version of my uncertain profile (Thompson sampling), then values each candidate for two reasons:

$$
V(d)
=
\underbrace{\mathbb{E}[\Delta \text{skill}\mid d]}_{\text{expected skill gain}}
+
\underbrace{\operatorname{EIG}(d)}_{\text{expected information gain}}
$$

where $d$ is a candidate drill and $\operatorname{EIG}(d)$ is the expected information gain: how much the outcome of that drill is expected to teach the player model.

Everything enters through one sampler interface. A generated focus drill goes through the constrained search: for my tracking example it can make the target smaller, faster, or less predictable, but it cannot quietly turn tracking into a click task. A fixed probe passes through unchanged because changing the ruler would defeat the point. Variety is a hard rail rather than another bonus the search can ignore. There is finally one answer to `why did the coach serve this?`

The difficulty target begins around 70% predicted success. That number is a cold-start prior, not a universal law extracted from the Challenge Point paper.[^challenge][^pelanek] If the model predicts I will clear the tracking drill 95% of the time, the sampler can tighten its geometry until it reaches the intended challenge. Probe-bracketed training intervals update a posterior over the learning peak, so the target eventually belongs to the player instead of the source code.

<challenge-point></challenge-point>

### sensitivity is not one magic number

Sensitivity is where the hand-space idea gets interesting. OpenAim stores it as **cm/360**: how many centimeters the mouse must travel to turn the camera once. A larger number means a lower sensitivity. Unlike `0.27 in Valorant`, it means the same physical thing after you change games. That physical conversion is exact when DPI is supplied; without it, the trainer labels the hand-space value as an estimate from its assumed DPI.

For a movement of $A$ degrees, a target $W$ degrees wide, moving at $v$ degrees per second, the hand-space version is just:

$$
A_{cm}=A\frac{C}{360},\qquad
W_{cm}=W\frac{C}{360},\qquad
v_{cm}=v\frac{C}{360}
$$

where $C$ is cm/360. The arithmetic is simple; the consequences are not. The same 24° flick takes 1.33 cm at 20 cm/360 and 4 cm at 60 cm/360. At the faster sensitivity, the move is short but the target becomes a tiny physical landing window, loading micro control and fine-hand precision. At the slower sensitivity, the visual target is unchanged but the mouse has to travel farther and faster, loading arm-range control and hand speed. Neither is universally harder. They expose different parts of the movement.

<sens-spectrum></sens-spectrum>

The hand drawing is intentionally a displacement proxy, not a claim that a browser can see my fingers. OpenAim observes mouse motion. It uses physical thresholds to reason about finger/wrist-scale, transitional, and arm-range demands; it does not reconstruct my joints from JavaScript.

This is also why sensitivity is not a second curriculum bolted onto the coach. It is one coordinate of the same drill vector as target size, distance, speed, and reversals. Most candidate seeds stay at my comfortable anchor. A controlled share are drawn off-anchor across a wide physical range; for those candidates, cm/360 is free to move while the sampler searches for a drill that loads the chosen capability at my current challenge point.

That makes sensitivity an intelligent demand choice, not a ladder rung. If the model wants fine-hand precision, a faster sensitivity can shrink the physical landing window. If it wants arm-range control or hand speed, a slower one can stretch the same angular task across more mousepad. The sensitivity still has to earn its place inside the whole decision: expected teaching gain, expected information gain, predicted success, and the session's variety constraints all count. Warm-ups and fixed probes stay pinned to the anchor because changing the ruler would ruin the measurement.

The **mastered band** shown on the profile is derived from the posterior rather than advanced as progression state. The model solves a canonical flick at the anchor, sweeps that frozen geometry across cm/360, and reports the contiguous range where predicted capability still holds. It can widen as the underlying hand-space capabilities improve; ordinary focus drills are not scheduled as edge clears.

The useful result is not `37.4 cm/360 is your destiny`. It is closer to `this candidate exposes your fine-hand precision without making the drill impossible`, with the served cm/360 and the reason logged beside every other demand. AutoGain is an inspiration for using under- and overshoot as evidence around the anchor, not a claim that its full per-speed gain curve has been reproduced.[^autogain]

The first-session plan below uses a fixed calibration battery before the adaptive coach starts making decisions. After that battery, the same sampler plans the whole session and every block carries its predicted success, pace budget, and reason for being there.

![The first-session calibration plan. Fixed probes establish a baseline before adaptation starts.](https://urfeanhummwzxrqvjxkm.supabase.co/storage/v1/object/public/images/uploads/openaim/01de5121677a4193-coached-briefing.webp)

---

## then I audited the instrument

The premise of this project is that the formulas should be inspectable and the claims should be capable of losing. Eventually it occurred to me that I had applied much more suspicion to Aimlabs than I had to the code I wrote at 2 a.m.

I audited the repository as if it belonged to somebody I did not trust. Every store, formula, publisher, and data path went into a defect register with file and line references.

It did not go great.

The engine already knew the story of every target, including its realized size, spawn position, timing window, shots, and landing errors. At the end of a run, the player model averaged most of that into one scalar and performed one update. A run with 40 engagements was treated as the same fixed amount of evidence as a run with four. I was producing the best data in the system and destroying it immediately before the part that learns.

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
