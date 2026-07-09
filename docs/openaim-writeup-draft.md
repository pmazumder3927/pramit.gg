<!--
  DRAFT — openaim writeup for pramit.gg
  voice: lowercase-leaning, honest, deep, self-aware, ✦, tl;dr, setbacks section, sign-off.

  TWO VISUAL LAYERS:
  1) Static inline SVG figures — self-contained + theme-neutral (light card / dark ink),
     so they render anywhere, even in a plain markdown preview.
  2) FIVE INTERACTIVE WIDGETS — custom tags that render real React components on pramit.gg
     via the same custom-tag → component mapping the site already uses for <plotly-graph>:
       <submovement-lab>   → app/components/openaim/SignalNoiseLab.tsx   (signal-dependent noise, live)
       <noise-frontier>    → app/components/openaim/NoiseFrontier.tsx    (drag your operating point)
       <challenge-point>   → app/components/openaim/ChallengePoint.tsx   (solve difficulty to 0.68)
       <capability-radar>  → app/components/openaim/CapabilityRadar.tsx  (14 cited axes, run a session)
       <sens-spectrum>     → app/components/openaim/SensSpectrum.tsx      (expand your mastered band)
     Wiring: app/post/[id]/PostContent.tsx (imports + `components` map + `blockTags`).
     Preview all five at /dev/openaim-preview. Shared kit: app/components/openaim/kit.tsx.
     AUTHORING CAVEAT: always use explicit closing tags (<noise-frontier></noise-frontier>),
     never self-closing — HTML parsing does not self-close custom elements.
  Replace <!-- SCREENSHOT --> placeholders with real captures when you want them.
-->

# i built an aim trainer that tells you *why* you miss

*a science-based, open, adaptive aim trainer — reverse-engineered from the motor-control literature, built over one very caffeinated weekend, and honest about the one thing the whole industry hand-waves.*

`journey` · ~25 min read

---

## tl;dr

every aim trainer on the market hands you a number and a shrug. you run a scenario, you get a score, you compare it to a benchmark, and then you *guess* what to do about it. i got tired of guessing.

so i built **openaim**: a trainer that treats every mouse movement as a signal about your motor system, reconstructs *how* you actually aim from that signal, and closes the loop from "here's what's wrong" to "here's what to train next." it's grounded in ~50 years of motor-control science, every number it shows you has a published formula and a citation, the entire analysis engine runs *in your browser* so your data never leaves your machine, and it's honest about the one thing everyone else fudges: **whether any of this transfers to the actual game is unproven, so it measures that instead of claiming it.**

the whole thing — empty repo to a deployed, backend-backed adaptive trainer — happened in **79 commits over 3 days**. this is the long version of how it works, and why i built it the way i did.

---

## the itch

i'm the exact person this is for. i run Voltaic benchmarks, i grind Viscose playlists, and a while ago i hit the wall every intermediate aimer hits: the scores stop moving and nobody can tell you why.

here's the thing that actually bothers me. you finish a clicking scenario and you get, say, an 84. what does the 84 *mean*? did you miss because you flicked faster than your hand can actually land? because your micro-corrections are shaky? because your click timing lags the target by 30ms? because you literally didn't see the target for 40ms longer than the player ranked above you? **four completely different problems. same score. opposite fixes.** the number can't tell them apart, and neither can you.

and the "solutions" don't solve it:

- **the routines are frozen.** the community's canonical guide — AIMER7's KovaaK's routine — was published in **March 2019 and never updated**, distributed as a Dropbox PDF that's broken and been re-hosted by hand.[^aimer7] it's genuinely brilliant. it's also a static list that hands a Gold wrist-aimer and a Nova arm-aimer the exact same homework.
- **the "smart" commercial stuff is a costume.** Aimlabs' store page lists AI coaching, adaptive tasks, generative scenarios, a sensitivity finder, and eight kinematic sub-scores. in the hand: you configure every "adaptive" setting yourself, nothing persistent is modeled about your *ability* (it logs scores, not skill), the sub-scores ship with no published formula, and the flagship "improve **49% faster**" claim has no study, sample size, or methodology anywhere on the live page.[^aimlabs] the integrated diagnostic trainer the marketing *implies* — nobody actually built it.

i kept coming back to an analogy. cycling had vibes-based training for decades until the power meter showed up and replaced "i feel strong today" with a watt number tied to the thing you were actually trying to improve. **aim training is pre-power-meter.** it has scoreboards. it doesn't have an instrument that measures the underlying thing.

so, in the grand tradition of [the minmaxer's dilemma](/post/the-minmaxer-s-dilemma), i decided the correct response to "just play more" was to spend a weekend building a measurement instrument instead. the irony that a chronic score-minmaxer built a tool whose entire north star is *stop optimizing the score* is not lost on me. we'll get there.

---

## the thesis: a flick is not a black box

the whole thing rests on one idea from motor-control science, and it's worth sitting with, because everything else is downstream of it.

when you snap your crosshair to a target, that movement is not one smooth motion. fifty years of research says a rapid aimed movement **decomposes into a ballistic *primary* submovement — a big pre-programmed launch — plus optional *corrective* submovements** that clean up the landing.[^meyer] and the reason you *need* those corrections is the second half of the idea: your neural control signals carry **signal-dependent noise**. the bigger and faster the motor command, the more noise rides along with it, so **endpoint error grows linearly with movement speed.**[^harris]

that second paper — Harris & Wolpert, *Nature*, 1998, 3000+ citations — is the load-bearing one. a single "minimize the variance caused by signal-dependent noise" principle predicts the trajectories of *both* eye saccades and arm reaches, and it *derives* Fitts's law from first principles instead of just curve-fitting it.

<figure>
<svg viewBox="0 0 720 380" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="One flick, decomposed. Top: mouse-speed profile with one large ballistic primary hump and two small corrective humps. Bottom: crosshair error over the same time, overshooting the target then settling into the hit window." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="380" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">one flick, decomposed</text>
  <text x="24" y="47" font-size="10.5" fill="#6b7280">the atomic unit of diagnosis — segment the speed profile, then blame the phase that failed</text>
  <text x="24" y="78" font-size="9.5" fill="#6b7280" transform="rotate(-90 24 78)" text-anchor="middle">mouse speed °/s</text>
  <line x1="70" y1="70" x2="70" y2="175" stroke="#cfd7d6"/>
  <line x1="70" y1="175" x2="694" y2="175" stroke="#cfd7d6"/>
  <line x1="266" y1="70" x2="266" y2="175" stroke="#d8dedd" stroke-dasharray="3 3"/>
  <line x1="359" y1="70" x2="359" y2="175" stroke="#d8dedd" stroke-dasharray="3 3"/>
  <line x1="452" y1="70" x2="452" y2="175" stroke="#d8dedd" stroke-dasharray="3 3"/>
  <path d="M70,175 C110,175 140,58 163,54 C188,50 240,160 266,162 C288,164 300,120 308,120 C320,120 345,161 359,162 C378,163 395,142 401,142 C415,142 440,167 452,167 L694,168" fill="none" stroke="#d9351d" stroke-width="2.4"/>
  <circle cx="163" cy="54" r="4.5" fill="#d9351d"/>
  <circle cx="308" cy="120" r="3.5" fill="#2b6cb0"/>
  <circle cx="401" cy="142" r="3.5" fill="#2b6cb0"/>
  <circle cx="266" cy="162" r="3" fill="none" stroke="#6b7280"/>
  <circle cx="359" cy="162" r="3" fill="none" stroke="#6b7280"/>
  <text x="163" y="44" font-size="9.5" fill="#d9351d" text-anchor="middle">primary (ballistic launch)</text>
  <text x="355" y="104" font-size="9.5" fill="#2b6cb0" text-anchor="middle">corrective submovements</text>
  <text x="24" y="290" font-size="9.5" fill="#6b7280" transform="rotate(-90 24 290)" text-anchor="middle">crosshair error °</text>
  <line x1="70" y1="215" x2="70" y2="340" stroke="#cfd7d6"/>
  <line x1="70" y1="340" x2="694" y2="340" stroke="#cfd7d6"/>
  <rect x="70" y="300" width="624" height="26" fill="#1f7a4d" opacity="0.10"/>
  <line x1="70" y1="313" x2="694" y2="313" stroke="#1f7a4d" stroke-dasharray="4 3" opacity="0.7"/>
  <text x="688" y="297" font-size="8.5" fill="#1f7a4d" text-anchor="end">target hit window</text>
  <path d="M70,232 C120,236 150,332 175,336 C210,341 250,338 266,336 C300,332 300,318 308,318 C330,318 345,314 359,314 C385,312 395,311 401,311 C430,311 450,311 452,311 L694,311" fill="none" stroke="#7a4fd0" stroke-width="2.4"/>
  <circle cx="175" cy="336" r="3.5" fill="#7a4fd0"/>
  <text x="188" y="332" font-size="9" fill="#7a4fd0">overshoot — signal-dependent noise</text>
  <text x="382" y="366" font-size="9.5" fill="#6b7280" text-anchor="middle">time after target appears (ms) →</text>
  <text x="70" y="366" font-size="8.5" fill="#8b9793" text-anchor="middle">0</text>
  <text x="266" y="366" font-size="8.5" fill="#8b9793" text-anchor="middle">190</text>
  <text x="452" y="366" font-size="8.5" fill="#8b9793" text-anchor="middle">370</text>
</svg>
<figcaption><em>fig — every engagement is split into a ballistic primary submovement plus optional corrections. a miss gets blamed on whichever phase failed: a bad launch is a different problem than shaky corrections, and they need different drills.</em></figcaption>
</figure>

here's why this matters for a *browser aim trainer* specifically: **all of that is estimable from raw mouse telemetry.** i don't need a lab, EMG electrodes, or an eye tracker. i need your mouse deltas at a high enough sample rate, and i can reconstruct the submovement structure, fit your personal noise-vs-speed line, and read off the single most useful number in your whole profile — the slope of that line, your **motor-noise coefficient σᵥ**. that number *is* your personal speed-accuracy frontier: the fastest you can flick before noise, not skill, dominates the outcome.

the anatomy above is static; the *behavior* is the fun part. here's the whole thesis in one toy — drag the flick speed and watch endpoint spread grow linearly with it, then flip corrections on to see the corrective submovements haul the near-misses back in (and time out the far ones):

<!-- INTERACTIVE WIDGET — signal-dependent noise, live. -->
<submovement-lab></submovement-lab>

that's the bet. the rest of this post is what i built on top of it.

**one honesty note up front, because it's the whole ethos:** these laws were validated on *discrete movements to static targets* — Fitts tapping, saccades, reaches — **not** on FPS tracking or moving targets. so openaim treats them as *strong priors to recalibrate on real telemetry*, not settled fact. wherever i use a model outside the domain it was validated in, i say so, in the app and in the docs. more on that at the end.

---

## the shape of the thing

before the parts, the whole. openaim is not five features stapled together — it's **one player model, observed through four engines**, wired into a loop that never stops turning.

<figure>
<svg viewBox="0 0 720 340" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The closed loop: telemetry feeds diagnosis, which updates the player model and feeds the coach, which asks the scenario engine for a drill, which produces new telemetry. The sensitivity engine reads the same submovement stream." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="340" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">one model, four engines, one loop</text>
  <!-- center player model -->
  <rect x="286" y="140" width="148" height="60" rx="8" fill="#d9351d" opacity="0.10" stroke="#d9351d"/>
  <text x="360" y="166" font-size="11" fill="#17211f" text-anchor="middle" font-weight="700">the player model</text>
  <text x="360" y="184" font-size="8.5" fill="#6b7280" text-anchor="middle">σᵥ · 14 demand axes · pace · gain</text>
  <!-- four boxes -->
  <g>
    <rect x="70" y="60" width="150" height="52" rx="8" fill="#fff" stroke="#cfd7d6"/>
    <text x="145" y="82" font-size="10.5" fill="#17211f" text-anchor="middle" font-weight="700">0 · telemetry</text>
    <text x="145" y="98" font-size="8.5" fill="#6b7280" text-anchor="middle">raw mouse @ ~2 kHz</text>
  </g>
  <g>
    <rect x="500" y="60" width="150" height="52" rx="8" fill="#fff" stroke="#cfd7d6"/>
    <text x="575" y="82" font-size="10.5" fill="#17211f" text-anchor="middle" font-weight="700">1 · diagnosis</text>
    <text x="575" y="98" font-size="8.5" fill="#6b7280" text-anchor="middle">why you missed</text>
  </g>
  <g>
    <rect x="500" y="228" width="150" height="52" rx="8" fill="#fff" stroke="#cfd7d6"/>
    <text x="575" y="250" font-size="10.5" fill="#17211f" text-anchor="middle" font-weight="700">3 · the coach</text>
    <text x="575" y="266" font-size="8.5" fill="#6b7280" text-anchor="middle">what to train next</text>
  </g>
  <g>
    <rect x="70" y="228" width="150" height="52" rx="8" fill="#fff" stroke="#cfd7d6"/>
    <text x="145" y="250" font-size="10.5" fill="#17211f" text-anchor="middle" font-weight="700">2 · scenario engine</text>
    <text x="145" y="266" font-size="8.5" fill="#6b7280" text-anchor="middle">generate the drill</text>
  </g>
  <!-- arrows cycle -->
  <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#8b9793"/></marker></defs>
  <path d="M220,86 L500,86" fill="none" stroke="#8b9793" stroke-width="1.6" marker-end="url(#ar)"/>
  <path d="M575,112 L575,228" fill="none" stroke="#8b9793" stroke-width="1.6" marker-end="url(#ar)"/>
  <path d="M500,254 L220,254" fill="none" stroke="#8b9793" stroke-width="1.6" marker-end="url(#ar)"/>
  <path d="M145,228 L145,112" fill="none" stroke="#8b9793" stroke-width="1.6" marker-end="url(#ar)"/>
  <!-- model links -->
  <path d="M500,98 C470,120 450,150 434,158" fill="none" stroke="#d9351d" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#ar)"/>
  <path d="M434,182 C470,200 490,220 500,240" fill="none" stroke="#d9351d" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#ar)"/>
  <text x="252" y="180" font-size="9.5" fill="#7a4fd0">4 · sensitivity engine</text>
  <text x="252" y="196" font-size="8" fill="#6b7280">reads the same submovement stream</text>
  <path d="M286,172 C260,172 245,175 235,178" fill="none" stroke="#7a4fd0" stroke-width="1.3" marker-end="url(#ar)"/>
  <text x="336" y="120" font-size="8" fill="#6b7280" text-anchor="middle">updates ↑ · reads ↓</text>
</svg>
<figcaption><em>fig — telemetry → diagnosis updates the model and names your limiting sub-skill → the coach picks what to train and how hard → the scenario engine generates a drill predicted to hit that difficulty for <strong>you</strong> → back to telemetry. the sensitivity engine runs continuously off the same signal. diagnosis and prescription are the same math.</em></figcaption>
</figure>

let's walk the loop.

---

## engine 0: getting clean signal out of a browser

before any of the science matters, i have to actually *capture* the movement — and i chose to do it in a browser, which sounds insane for a latency-sensitive input problem. the reasons: zero install, the whole thing is a link you can send someone, replays are shareable, and "open" only means something if there's nothing to download and trust.

the trick that makes it possible is a stack of three web APIs most people never touch:

- **Pointer Lock** hides the cursor and gives you unbounded relative `movementX/Y` — mandatory for an FPS feel.
- **`pointerrawupdate`** delivers pointer events *without* the coalescing normal `pointermove` applies.
- **`getCoalescedEvents()`** is the actual magic. browsers batch input samples into one animation-frame callback, but this method hands you back *every underlying sample* with its own timestamp. a 1000–8000 Hz mouse produces many samples per rendered frame, and this is how you recover them. **i validated real capture at ~2000 Hz on actual hardware.**

<figure>
<svg viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A 60 Hz render frame is 16.7 milliseconds wide and contains about 33 raw mouse samples at 2000 Hz. getCoalescedEvents recovers all of them." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="200" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">what getCoalescedEvents() gives back</text>
  <text x="24" y="47" font-size="10.5" fill="#6b7280">one 60 Hz frame = 16.7 ms = ~33 raw samples you'd otherwise never see</text>
  <!-- frame regions -->
  <rect x="70" y="80" width="200" height="60" fill="#2b6cb0" opacity="0.06" stroke="#2b6cb0" stroke-dasharray="4 3"/>
  <rect x="270" y="80" width="200" height="60" fill="#d9351d" opacity="0.07" stroke="#d9351d" stroke-dasharray="4 3"/>
  <rect x="470" y="80" width="200" height="60" fill="#2b6cb0" opacity="0.06" stroke="#2b6cb0" stroke-dasharray="4 3"/>
  <text x="170" y="74" font-size="8.5" fill="#6b7280" text-anchor="middle">frame n</text>
  <text x="370" y="74" font-size="8.5" fill="#d9351d" text-anchor="middle" font-weight="700">frame n+1 (expanded)</text>
  <text x="570" y="74" font-size="8.5" fill="#6b7280" text-anchor="middle">frame n+2</text>
  <!-- ticks in the emphasized frame -->
  <g stroke="#d9351d" stroke-width="1">
    <line x1="276" y1="88" x2="276" y2="132"/><line x1="282" y1="88" x2="282" y2="132"/><line x1="288" y1="88" x2="288" y2="132"/><line x1="294" y1="88" x2="294" y2="132"/><line x1="300" y1="88" x2="300" y2="132"/><line x1="306" y1="88" x2="306" y2="132"/><line x1="312" y1="88" x2="312" y2="132"/><line x1="318" y1="88" x2="318" y2="132"/><line x1="324" y1="88" x2="324" y2="132"/><line x1="330" y1="88" x2="330" y2="132"/><line x1="336" y1="88" x2="336" y2="132"/><line x1="342" y1="88" x2="342" y2="132"/><line x1="348" y1="88" x2="348" y2="132"/><line x1="354" y1="88" x2="354" y2="132"/><line x1="360" y1="88" x2="360" y2="132"/><line x1="366" y1="88" x2="366" y2="132"/><line x1="372" y1="88" x2="372" y2="132"/><line x1="378" y1="88" x2="378" y2="132"/><line x1="384" y1="88" x2="384" y2="132"/><line x1="390" y1="88" x2="390" y2="132"/><line x1="396" y1="88" x2="396" y2="132"/><line x1="402" y1="88" x2="402" y2="132"/><line x1="408" y1="88" x2="408" y2="132"/><line x1="414" y1="88" x2="414" y2="132"/><line x1="420" y1="88" x2="420" y2="132"/><line x1="426" y1="88" x2="426" y2="132"/><line x1="432" y1="88" x2="432" y2="132"/><line x1="438" y1="88" x2="438" y2="132"/><line x1="444" y1="88" x2="444" y2="132"/><line x1="450" y1="88" x2="450" y2="132"/><line x1="456" y1="88" x2="456" y2="132"/><line x1="462" y1="88" x2="462" y2="132"/>
  </g>
  <!-- naive single sample in other frames -->
  <line x1="170" y1="88" x2="170" y2="132" stroke="#2b6cb0" stroke-width="2.2"/>
  <line x1="570" y1="88" x2="570" y2="132" stroke="#2b6cb0" stroke-width="2.2"/>
  <text x="170" y="158" font-size="8" fill="#6b7280" text-anchor="middle">naive pointermove:</text>
  <text x="170" y="169" font-size="8" fill="#6b7280" text-anchor="middle">1 sample / frame</text>
  <text x="370" y="158" font-size="8" fill="#d9351d" text-anchor="middle">coalesced: every underlying</text>
  <text x="370" y="169" font-size="8" fill="#d9351d" text-anchor="middle">sample, timestamped</text>
</svg>
<figcaption><em>fig — the whole diagnostic premise dies without this. the browser can recover raw device cadence between animation frames; the replay stores the raw unaccelerated pointer-lock counts, and the rendered crosshair is a pure function of them so a verifier can re-derive the camera exactly.</em></figcaption>
</figure>

and the part i'm weirdly proud of, because no incumbent does it: **the trainer measures its own latency and shows it to you.** since i'm measuring human timing at millisecond scale, the system's own input→photon delay is a confound i have to quantify and subtract, not hide. disclosing your own latency is a transparency win *and* a correctness requirement for any honest timing metric. i'd rather show you the number and its error bars than pretend it's zero. (the in-app probe is honest about its own limits, too — it measures the software pipeline; true input→photon needs hardware, so it says so instead of guessing.)

every run serializes to an open **`.oar` replay**: a little binary with a magic number, a JSON header (the full scenario spec, seed, your sens/dpi/cm360/fov, capture metadata), and then the raw columns packed back-to-back — `mouse_t_ms`, `mouse_dx`, `mouse_dy`, plus the rendered yaw/pitch and any moving-target tracks. it losslessly reconstructs the run so you can re-score it under a new metric later, and the TS and Python codecs are round-trip tested against each other byte-for-byte. your replays are yours; the format is documented; you can export them.

---

## engine 1: the diagnosis — *why* you missed

this is the part that already does something no incumbent does, and it's where the science cashes out. the flow: raw replay → segment every flick → fit your noise curve → attribute each miss to a mechanism → hand you a picture, not a paragraph.

### segmenting the flick

the Python engine (`openaim_analysis`) takes the 1 kHz crosshair trace, low-passes the speed profile with an 8 ms Gaussian, and finds the peaks and valleys using **1D persistence** — a topological way of keeping only the extrema that are "tall" enough to be real (persistence ≥ 5% of the speed range) and throwing away the jitter. submovements are `(min, peak, min)` triplets at least 50 ms long with a peak above 8°/s. this is the exact recipe the AutoGain and ICP papers validated.[^autogain][^icp] then it filters out "unaimed" segments — anything pointing more than 45° off the target or overshooting by more than 0.5× the distance — because those aren't corrections, they're you doing something else.

### the headline number: your speed-accuracy frontier

for each ballistic primary, it records `(mean speed, endpoint error)`, and fits a line:

```
SD(endpoint error) = σ₀ + σᵥ · v
```

that's it. that's the signal-dependent-noise law from the thesis, fit to *your* hand. the fit is a weighted least-squares over speed-quantile bins, with a **1000-sample bootstrap confidence interval** (seeded, so it's deterministic — run it twice, get the same CI). `σᵥ`, the slope, is your motor-noise coefficient. from it the engine reads two things: your **operating point** (the speed you actually flick at, the median primary speed) and your **frontier** (the speed at which predicted error grows past the target radius — the fastest you *should* flick).

<!-- INTERACTIVE WIDGET (renders on pramit.gg via the custom-tag → React mapping). -->
<noise-frontier></noise-frontier>

### which stage failed?

a miss isn't a miss. the engine classifies every failed engagement into one of five mechanisms, each with a **dissociable telemetry fingerprint** (this is the ablation logic from the point-and-click simulation literature run in reverse — perceptual vs motor deficits leave distinguishable traces in the miss-rate-vs-time tradeoff[^doclick][^icp]):

<figure>
<svg viewBox="0 0 720 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A movement timeline from target-appears to trigger-pull, with five failure mechanisms marked at where in the movement each one breaks: perception before onset, planning at the ballistic launch, tracking throughout, correction at the settle, timing at the trigger." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="250" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">five ways to miss, five fingerprints</text>
  <text x="24" y="47" font-size="10.5" fill="#6b7280">each mechanism breaks at a different point in the movement — and needs a different drill</text>
  <!-- timeline -->
  <line x1="70" y1="120" x2="660" y2="120" stroke="#cfd7d6" stroke-width="2"/>
  <text x="70" y="212" font-size="8.5" fill="#8b9793">target appears</text>
  <text x="655" y="212" font-size="8.5" fill="#8b9793" text-anchor="end">trigger</text>
  <!-- markers -->
  <g font-size="9" text-anchor="middle">
    <circle cx="120" cy="120" r="6" fill="#7a4fd0"/><text x="120" y="96" fill="#7a4fd0">perception</text><text x="120" y="146" fill="#6b7280" font-size="7.5">slow reaction</text>
    <circle cx="260" cy="120" r="6" fill="#d9351d"/><text x="260" y="96" fill="#d9351d">planning</text><text x="260" y="146" fill="#6b7280" font-size="7.5">bad launch, big error</text>
    <circle cx="400" cy="120" r="6" fill="#2b6cb0"/><text x="400" y="96" fill="#2b6cb0">correction</text><text x="400" y="146" fill="#6b7280" font-size="7.5">shaky settle, 2+ subs</text>
    <circle cx="560" cy="120" r="6" fill="#1f7a4d"/><text x="560" y="96" fill="#1f7a4d">timing</text><text x="560" y="146" fill="#6b7280" font-size="7.5">on target, wrong instant</text>
  </g>
  <!-- tracking spans -->
  <line x1="120" y1="176" x2="560" y2="176" stroke="#8b9793" stroke-width="6" opacity="0.35" stroke-linecap="round"/>
  <text x="340" y="172" font-size="8.5" fill="#6b7280" text-anchor="middle">tracking — error accrues the whole time the target moves</text>
</svg>
<figcaption><em>fig — perception (reaction &gt; ~350 ms) · planning (primary lands outside the target radius) · correction (2+ corrective submovements or a slow settle) · timing (on-target but the trigger fires at the wrong instant — the thing that separates elite from novice clickers[^icp]) · tracking (on-target fraction drops across a moving engagement). the app scores all five continuously and blames the dominant one.</em></figcaption>
</figure>

### the "why you missed" screen (the report that isn't a report)

my first version of this was a Python markdown report — a wall of cited text. it was *correct* and *boring*, and it violated a rule i care about: don't hand someone an AI-ish essay when you could hand them the thing itself. so i deleted it. now diagnosis lives inside an interactive **Replay Lab**:

- **3D playback** of your run — reconstructed from the recorded camera path and target tracks, rendered through the *same* renderer the live trainer uses (no re-simulation, just replay).
- a **per-flick scope**: your crosshair's path drawn in the target's own frame of reference, colored by phase (reaction / ballistic / correction / settle), with the launch vector, the landing dot, and the kill-or-miss marker. it's the literal picture of figure 1, for one real flick.
- a **speed fingerprint** chart with the movement phases shaded behind it, and a click-through attribution dashboard: click "correction," it seeks the scrubber to your *worst* corrective flick and shows you.

<!-- SCREENSHOT: the Replay Lab — 3D playback + per-flick scope + speed fingerprint. -->

there's a subtlety worth admitting: the in-browser diagnosis is a *principled approximation* of the full Python engine (no submovement deconvolution, no bootstrap CI live) — for the rigorous version there's a one-click "full engine report." i'd rather ship the honest fast version and label it than pretend the quick client math is the deep fit.

---

## engine 2: a drill is a point in space, not a name

the incumbents think in scenarios: "Reactive Flick," "Strafe Track," a named list you scroll. the second-biggest idea in openaim (after the noise model) is throwing that out. on day one i wrote a scenario generator; by the end of day one i'd deleted it, because **a drill is not a category — it's a point in a parameter space.**

concretely, a drill is a **13-number vector**: amplitude, target width, target speed, reversal rate, motion smoothness, hold-to-kill time, simultaneous target count, verticality, **absolute sensitivity in cm/360**, pace pressure, hits-to-kill, blink/dash rate, and jump/bounce. every community category — flicks, micro, wall/moving/stability switching, moving clicks, reactive vs smooth tracking, multi-tap, blink reflex, bounce, air tracking — is a *region* of that space. and configurations no human ever hand-authored are just as reachable.

all of it compiles down to **one bot simulation**. this is the part that keeps the whole thing honest. generated coach drills, built-in scenarios, and reverse-engineered benchmark replicas all execute on a single engine with real mechanics: acceleration-based movement in a Quake/UE style, gravity and jump/bounce physics, flyers, blink dashes with charge systems, HP pools with regen, dodge state machines, and hitscan weapons with cadence, magazines, and reloads — plus faithful KovaaK's scoring. **a demand the model prices is a demand that actually runs**, because the same instrumentation reads every run identically no matter where the drill came from.

to make sure the generator's reach actually *covers* real training, i reverse-engineered the **Viscose Season 2 benchmarks** straight from the KovaaK's workshop `.sce` files — a Python extractor that parses the INI-ish scenario format, digests two different map formats into a player-local frame, and reconstructs the bot physics, dodge profiles, and weapon tables. that's 156 benchmark slots (39 scenarios × 4 difficulties), of which 132 are faithfully reproduced, riding on the exact same engine as the generated drills. the coach's sampling ranges are pinned — by an actual unit test — to bracket the demand distributions measured from that real Viscose data. "the coach can form any benchmark-shaped drill" is a tested property, not a hope.

(one honest ceiling: elite tracking scenarios like RawControlSphere run at ~129°/s, and the coach's target-speed axis caps lower. i know. it's a documented ceiling, not a bug — for now.)

then, the payoff of the whole engine: because every drill is a parameter vector, and because i have your motor parameters, i can predict **how hard a specific drill will be for you, before you play it** — using the validated HCI difficulty models (the point-and-click simulation and its `D_click` bits for clicking/timing[^doclick][^icp]; the Servo-Gaussian success model for tracking[^servo]; Fitts throughput per class for static flicks[^swipiness]; always a temporal term for moving targets[^ternary]). the *same* spec is a different difficulty for a different player. that's exactly what the next engine needs.

---

## engine 3: the coach — one model of you, fourteen axes deep

here's where it stops being a diagnostic tool and starts being a *coach*. the core is a model that i'm genuinely happy with: a **multidimensional online Rasch model** (the multi-axis generalization of Elo) that predicts your probability of success on any drill in the space.

```
P(success | drill x) = σ( w₀ − Σⱼ wⱼ · fⱼ(x) )
```

read it like this: `w₀` is your general skill. each `fⱼ(x)` is a **demand feature** — how much the drill loads axis *j*. each `wⱼ` is *what that demand costs you* (lower = more capable). the dot product is "how much this specific drill taxes this specific player," squashed through a sigmoid into a hit probability.

<!-- INTERACTIVE WIDGET — the logistic surface + a "solve to 0.68" button (Guadagnoli & Lee 2004; Pelánek 2016). -->
<challenge-point></challenge-point>

a few things i'm proud of in how this actually works:

- **it's a real Bayesian filter, not a scalar.** the model carries a full 15×15 posterior covariance. every drill result is folded in with an assumed-density (Laplace/EKF) update — a rank-1 update to the mean and a PSD-safe downdate to the covariance. the important consequence: **the off-diagonals route one axis's surprise to its correlated neighbours.** do well on a hard micro-flick drill and your fine-hand-precision estimate sharpens *and* your related axes shift, because the model knows they move together.
- **it forgets on a clock, not per drill.** idle axes slowly drift back toward uncertainty (a small process-noise bump per day, capped so a two-week layoff can't erase what it knows), so the coach re-probes skills you haven't touched. a stationary session, by contrast, converges.
- **a second head predicts your kill time.** `ln E[kill-time] = tᵥ₀ + Σ tᵥⱼ·fⱼ`, fit online, which gives each drill a personal *pace budget* — so outcomes are graded on pace + quality, never raw accuracy (a multi-tap kill is graded on cleanliness against its hits-to-kill, not on whether you eventually connected).

the fourteen demand axes are all cited, and this is the table i'd actually put on a fridge:

| axis | what it measures | grounded in |
|---|---|---|
| `fitts` | spatial precision — log index of difficulty, **sens-invariant by construction** | Fitts / SDN[^harris] |
| `temporal` | interception timing — crossing rate ≈ inverse click window | ICP `D_click`[^icp] |
| `reactivity` | reactive-correction load from *unpredictable* motion | Servo-Gaussian[^servo] |
| `stability` | sustained on-target hold | tracking hold |
| `switching` | simultaneous-target planning load | multi-target |
| `vertical` | vertical spread / motion (jump-aware) | — |
| `armControl` | **hand-space** travel per flick → arm recruitment | SDN in motor coords[^harris] |
| `microControl` | **hand-space** finger-scale flicks | SDN in motor coords[^harris] |
| `handPrecision` | **hand-space** endpoint precision (fine hand) | SDN in motor coords[^harris] |
| `handSpeed` | **hand-space** required hand velocity | SDN in motor coords[^harris] |
| `pacePressure` | time pressure (signed — relaxed can be negative) | — |
| `smoothPursuit` | *predictable* pursuit, dissociated from reactivity | Servo-Gaussian[^servo] |
| `reacquire` | post-blink / displacement re-lock | submovement re-plan[^meyer] |
| `cadence` | repeat-shot commitment at a rhythm | ICP internal clock[^icp] |

those four `hand-space` axes are the quiet heart of the whole sensitivity philosophy: they're computed in **absolute physical centimetres of mouse travel**, because signal-dependent noise lives in *motor* coordinates, not screen pixels.[^harris] which means being a good aimer at 20 cm/360 and at 60 cm/360 are *separate, separately-measured capabilities* — not the same skill times a multiplier. more on that in engine 4.

<!-- INTERACTIVE WIDGET — click an axis for its formula + citation; "run a session" improves the weakest axes most. -->
<capability-radar></capability-radar>

### deciding what to train

rating you is half of it. the other half is *choosing* the next drill, which is a little multi-objective search. for each axis, the coach computes a **training value** — and this is the actual acquisition function, weights and all:

```
value(axis j) = wUncert·σ²ⱼ            (how unsure am i about you here)
              + wLp·max(0, learningProgressⱼ)   (are you improving fastest here)
              + wDue·dueRatioⱼ          (is this skill decaying, FSRS-style)
              + wWeak·max(0, wⱼ − populationBaselineⱼ)  (relative weakness)
              + wMech·[flagged by diagnosis]     (did engine 1 blame this)
              − use·usedⱼ               (don't over-serve one thing)
```

three of those deserve a callout, because they're where the education research earns its keep:

- **learning progress, not lowest score.** the bandit routes you to the sub-skill where you're *improving fastest*, not the one where you're worst — because grinding your worst skill is demoralizing and inefficient if you're not actually moving on it.[^zpdes] the reward is the slope of your recent success rate, measured on frozen **measurement probes** (fixed-geometry drills, never adapted, scored against a locked pace budget), so it's honest ground, not model drift.
- **spacing.** each axis has a lightweight FSRS-style memory state; a skill becomes "due" as it decays, and revisiting it *after* partial decay consolidates more than hammering it fresh.[^fsrs] a static PDF fundamentally cannot come back to a skill at the right moment. this one does.
- **a hard variety cap.** an early, very real bug was the coach falling in love with one mechanic and serving me smooth-pursuit drills all session (there is a commit literally titled `stop giving me smooth pursuit`). the fix: no single axis can own more than 35% of a session, and no more than 4 in a row. weakness is measured against a *population* baseline now, not a single pilot, so "weak" means weak-relative-to-people, not weak-relative-to-my-own-best-axis.

and then the session itself is *assembled*, not authored — a transparent **plan** at real playlist scale (default 30 × 60-second drills, the length of a Viscose routine):

<figure>
<svg viewBox="0 0 720 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A session plan as a horizontal spine: a warm-up block, a measurement probe, several themed 3-drill blocks each with a rising rung ladder, a stretch drill about a third of the way in, and a sens ladder near the end." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="220" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">a session is a plan, not a bag of picks</text>
  <text x="24" y="47" font-size="10.5" fill="#6b7280">warm-up → probe → themed blocks (with rung ladders) → stretch → sens ladder</text>
  <!-- spine blocks -->
  <g>
    <rect x="40" y="80" width="60" height="34" rx="5" fill="#1f7a4d" opacity="0.5"/><text x="70" y="101" font-size="8" fill="#17211f" text-anchor="middle">warm-up</text>
    <rect x="106" y="80" width="46" height="34" rx="5" fill="#7a4fd0" opacity="0.45"/><text x="129" y="101" font-size="8" fill="#17211f" text-anchor="middle">probe</text>
    <rect x="158" y="80" width="120" height="34" rx="5" fill="#d9351d" opacity="0.16" stroke="#d9351d"/><text x="218" y="101" font-size="8" fill="#17211f" text-anchor="middle">focus block ×3</text>
    <rect x="284" y="80" width="120" height="34" rx="5" fill="#d9351d" opacity="0.16" stroke="#d9351d"/><text x="344" y="101" font-size="8" fill="#17211f" text-anchor="middle">focus block ×3</text>
    <rect x="410" y="80" width="44" height="34" rx="5" fill="#2b6cb0" opacity="0.4"/><text x="432" y="101" font-size="8" fill="#17211f" text-anchor="middle">stretch</text>
    <rect x="460" y="80" width="120" height="34" rx="5" fill="#d9351d" opacity="0.16" stroke="#d9351d"/><text x="520" y="101" font-size="8" fill="#17211f" text-anchor="middle">focus block ×3</text>
    <rect x="586" y="80" width="94" height="34" rx="5" fill="#7a4fd0" opacity="0.28" stroke="#7a4fd0"/><text x="633" y="101" font-size="8" fill="#17211f" text-anchor="middle">sens ladder</text>
  </g>
  <!-- rung ladder under one block -->
  <text x="218" y="150" font-size="8" fill="#6b7280" text-anchor="middle">rung ratchets up on success (×1.18), down on fail (×0.92)</text>
  <g stroke="#d9351d" stroke-width="2">
    <line x1="170" y1="185" x2="190" y2="185"/><line x1="205" y1="178" x2="225" y2="178"/><line x1="240" y1="169" x2="260" y2="169"/>
  </g>
  <path d="M170,185 L260,169" stroke="#d9351d" stroke-dasharray="2 2" stroke-width="1" fill="none"/>
  <text x="470" y="150" font-size="8" fill="#6b7280">every drill: sampled from the space, solved to 0.68 success, scored by training value</text>
</svg>
<figcaption><em>fig — the plan (real "briefing" screen). progressive overload made explicit: within a themed block the difficulty rung ratchets up on success and carries into that axis's next block. it <em>looks</em> like a curated playlist. it's generated for you, today, and it's different tomorrow.</em></figcaption>
</figure>

---

## engine 4: sensitivity as a lever, not a magic number

sensitivity is where the "train the player, not the score" thing gets concrete, and where i most consciously refused to build the feature everyone expects (a "sens finder" that spits out your One True Number).

openaim treats sensitivity as an **absolute physical dimension** — cm/360, on a spectrum from 10 to 100 (Valorant pros live around 84, so it has to fit). the goal isn't "your best sens"; it's a player who is *objectively capable across the whole spectrum*. three pieces:

- **an AutoGain anchor.** the same under/overshoot signal engine 1 already computes tells you if your gain is mismatched: land consistently short in a speed band and your gain there is too low; overshoot and it's too high.[^autogain] the coach nudges your anchor toward *learnable* errors — a gain matched to your motor system so a miss reflects *your noise*, not you fighting a bad transfer function. (a well-matched gain can even *lower* your score at first while you stop compensating. that's allowed. that's the point.)
- **a mastered band** around that anchor, and a **sens ladder** in the session plan that replays one solved geometry at the band's *edges*. hold an edge and the band expands outward toward the full spectrum. "a good aimer at every sensitivity" becomes a *measurable state* — capability held across the band — instead of a slogan.
- **prescribed sensitivities are honored.** some Viscose fingertip work mandates ≤ 50 cm/360; the trainer runs it at that, badges it in the menu, and stamps it in the replay.

<!-- INTERACTIVE WIDGET — drag the anchor; "cleared a rung" expands your mastered band toward the full spectrum. -->
<sens-spectrum></sens-spectrum>

---

## the aim commons: from a sample size of one to a population

everything so far works for a single player. but a single player has a cold-start problem — the first session, the model knows nothing, and Pelánek's education work says you need ~100 plays to calibrate a drill and ~10 to rate a person.[^pelanek] the fix is to let the crowd teach the model, carefully.

the **Aim Commons** is an opt-in shared data pool with three independent consent scopes: de-identified per-engagement feature rows (for the population fit), raw replays (for verification), and a public handle (for leaderboards). heavy ML runs *offline in Python*; the backend (Convex) just handles ingestion, a cheap integrity gate, storage, and — crucially — revocation. aggregate rows are stored under a salted SHA-256 of a client-minted id, so there's no reversible identity in the corpus and a revoke actually purges you.

the interesting math is the population model. it's a **factor model** over players × the 14 axes:

```
θ_c = μ_pop + L·z_c + ε_c
Σ_pop = L·Lᵀ + diag(ψ)      ← the shipped correlated prior
```

each contributor's own fit noise (their Laplace posterior covariance) is *subtracted* before estimating the between-player covariance, so the manifold `L` is real human variation, not fitting artifacts. the number of latent factors `k` is chosen by a scree/parallel-analysis cut. and `μ_pop` is precision-weighted, so sharp fits count more than noisy ones.

<figure>
<svg viewBox="0 0 720 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three panels: a wide fuzzy blob labelled you, session one; a tilted narrow ellipse labelled the population manifold; and a smaller tilted ellipse labelled your sharpened estimate, showing the correlated prior pulling the single-player uncertainty onto the population axis." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="240" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">a correlated prior beats a lonely guess</text>
  <text x="24" y="47" font-size="10.5" fill="#6b7280">the population manifold pulls your noisy day-one estimate onto the axis people actually vary along</text>
  <defs><marker id="ar4" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#8b9793"/></marker></defs>
  <!-- panel 1 -->
  <circle cx="130" cy="150" r="55" fill="#2b6cb0" opacity="0.10"/><circle cx="130" cy="150" r="34" fill="#2b6cb0" opacity="0.10"/>
  <circle cx="130" cy="150" r="4" fill="#2b6cb0"/>
  <text x="130" y="220" font-size="9" fill="#6b7280" text-anchor="middle">you, session 1</text>
  <text x="130" y="232" font-size="8" fill="#8b9793" text-anchor="middle">wide, uncorrelated</text>
  <!-- arrow -->
  <path d="M200,150 L260,150" stroke="#8b9793" stroke-width="1.4" marker-end="url(#ar4)"/>
  <!-- panel 2 population manifold -->
  <g transform="translate(360,150) rotate(-28)"><ellipse rx="70" ry="22" fill="#7a4fd0" opacity="0.14"/><ellipse rx="45" ry="13" fill="#7a4fd0" opacity="0.14"/></g>
  <text x="360" y="220" font-size="9" fill="#6b7280" text-anchor="middle">population manifold</text>
  <text x="360" y="232" font-size="8" fill="#8b9793" text-anchor="middle">Σ_pop = LLᵀ + diag(ψ)</text>
  <path d="M430,150 L490,150" stroke="#8b9793" stroke-width="1.4" marker-end="url(#ar4)"/>
  <!-- panel 3 sharpened -->
  <g transform="translate(590,150) rotate(-28)"><ellipse rx="42" ry="12" fill="#d9351d" opacity="0.16" stroke="#d9351d"/></g>
  <circle cx="590" cy="150" r="4" fill="#d9351d"/>
  <text x="590" y="220" font-size="9" fill="#6b7280" text-anchor="middle">your sharpened estimate</text>
  <text x="590" y="232" font-size="8" fill="#8b9793" text-anchor="middle">correlated, tighter</text>
</svg>
<figcaption><em>fig — a newcomer is cold-started on the population manifold; once ≥25 contributors exist, ratings and weakness get renormalized against the crowd. difficulty stays absolute (a hard drill is hard for everyone) — only the "where do you sit" changes. this is also how "weakness" stopped meaning "your worst axis" and started meaning "worse than people."</em></figcaption>
</figure>

and because the whole thing is public-facing, it needs teeth. the coach's **BALD** acquisition (`infoGain = κs/(1+κs)`) uses the *full* predictive variance, so two correlated axes don't get double-counted when the coach goes looking for the most informative drill — active learning, not just "do the uncertain thing." leaderboards get a two-tier integrity model: every submission is re-checked for feature parity (the 15 features are recomputed on the server and must match to 1e-6), sanity-ranged, and screened for superhuman kill times — but **`verified` is only earned by re-simulation.** the engine is a pure function of `(spec, sens, seed, inputs)` with no wall-clock, so a determinism verifier can re-run your recorded inputs and demand a bit-exact track. a forged seed or geometry can't reproduce even the first target's motion. rate limits are keyed by endpoint class, not identity, because a rotating anonymous UUID can't be trusted as a key.

honest status: the backend is deployed and the full train → publish → serve loop is live-verified, but the data is still synthetic seed — the population is basically the pilot prior until real people contribute. and the raw-replay tier (T2) is built but *gated*, because uploading raw human kinematics is a biometric/consent question i'm not going to hand-wave. the verifier, the codec, the encoder all exist and are wired; flipping on raw-trace ingestion is a deliberate, unmade decision.

---

## the whole analysis engine runs in your browser

this is the piece i think is quietly the coolest. the diagnosis engine is a real Python package — numpy, submovement deconvolution, bootstrap CIs, the works. and it runs **client-side, in your browser**, with zero setup.

<figure>
<svg viewBox="0 0 720 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A pipeline: the browser trainer produces an .oar replay, which goes to a Web Worker running Pyodide plus numpy, which reads a corpus from IndexedDB and returns a capability profile to the coach. An optional native server at localhost 8317 is preferred when present." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="250" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">your data never leaves your machine</text>
  <text x="24" y="47" font-size="10.5" fill="#6b7280">the Python analysis engine, compiled to WASM, running in a Web Worker</text>
  <defs><marker id="ar5" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#8b9793"/></marker></defs>
  <rect x="34" y="90" width="128" height="50" rx="7" fill="#fff" stroke="#cfd7d6"/><text x="98" y="112" font-size="9.5" fill="#17211f" text-anchor="middle" font-weight="700">trainer</text><text x="98" y="127" font-size="8" fill="#6b7280" text-anchor="middle">.oar replay</text>
  <path d="M162,115 L200,115" stroke="#8b9793" stroke-width="1.5" marker-end="url(#ar5)"/>
  <rect x="200" y="82" width="150" height="66" rx="7" fill="#d9351d" opacity="0.09" stroke="#d9351d"/><text x="275" y="106" font-size="9.5" fill="#17211f" text-anchor="middle" font-weight="700">Web Worker</text><text x="275" y="121" font-size="8" fill="#6b7280" text-anchor="middle">Pyodide + numpy</text><text x="275" y="134" font-size="8" fill="#6b7280" text-anchor="middle">openaim_analysis</text>
  <path d="M275,148 L275,180" stroke="#8b9793" stroke-width="1.5" marker-end="url(#ar5)"/>
  <rect x="200" y="182" width="150" height="42" rx="7" fill="#fff" stroke="#cfd7d6"/><text x="275" y="200" font-size="9" fill="#17211f" text-anchor="middle" font-weight="700">IndexedDB corpus</text><text x="275" y="214" font-size="8" fill="#6b7280" text-anchor="middle">your replays, local</text>
  <path d="M350,115 L392,115" stroke="#8b9793" stroke-width="1.5" marker-end="url(#ar5)"/>
  <rect x="392" y="90" width="150" height="50" rx="7" fill="#fff" stroke="#cfd7d6"/><text x="467" y="112" font-size="9.5" fill="#17211f" text-anchor="middle" font-weight="700">capability profile</text><text x="467" y="127" font-size="8" fill="#6b7280" text-anchor="middle">→ back into the coach</text>
  <!-- optional native -->
  <rect x="560" y="90" width="128" height="50" rx="7" fill="#fff" stroke="#7a4fd0" stroke-dasharray="4 3"/><text x="624" y="110" font-size="8.5" fill="#7a4fd0" text-anchor="middle" font-weight="700">native server</text><text x="624" y="124" font-size="7.5" fill="#6b7280" text-anchor="middle">:8317 · preferred</text><text x="624" y="135" font-size="7.5" fill="#6b7280" text-anchor="middle">if running</text>
  <path d="M542,105 L560,105" stroke="#7a4fd0" stroke-width="1.2" stroke-dasharray="3 2" marker-end="url(#ar5)"/>
</svg>
<figcaption><em>fig — a Pyodide WASM worker bundles the actual Python package, mounts your replay corpus from IndexedDB, and refits your Bayesian profile in the background after every run. if you happen to be running the optional native server on localhost, the router prefers it for speed; either way the corpora converge and telemetry never leaves your machine. a static build of the site <em>is</em> the full product.</em></figcaption>
</figure>

so the loop, in practice: you finish a run → it auto-syncs to your local corpus → the engine refits your capability profile in the background → at session end, the sharpened profile flows back into the coach *live*, and the summary shows you exactly which axes moved. no server round-trip, no account, no upload. the thing that would normally be a backend is sitting in a WASM sandbox in your tab.

---

## how it was built (a.k.a. the earlier versions)

i want to be honest about the timeline because it's kind of absurd: **the entire thing above is 79 commits across 3 days** — a weekend, basically. here's the arc, because the earlier versions are genuinely different animals.

<figure>
<svg viewBox="0 0 720 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="A three-day timeline (July 6 to 8) split into six phases: the toy, the engine, going scientific and 3D on day one; the unified engine, profile, and WASM on day two; the commons and the replay lab on day three." font-family="ui-monospace, 'Cascadia Mono', Consolas, monospace">
  <rect x="0" y="0" width="720" height="250" rx="10" fill="#fbfbf9" stroke="#e2e6e5"/>
  <text x="24" y="30" font-size="13" fill="#17211f" font-weight="700">empty repo → deployed adaptive trainer, in 3 days</text>
  <text x="24" y="47" font-size="10.5" fill="#6b7280">79 commits · jul 6–8 2026 · ≈26 commits/day</text>
  <!-- day bands -->
  <rect x="40" y="70" width="206" height="24" rx="4" fill="#d9351d" opacity="0.08"/><text x="143" y="86" font-size="9" fill="#6b7280" text-anchor="middle">jul 6 · 19 commits</text>
  <rect x="250" y="70" width="206" height="24" rx="4" fill="#2b6cb0" opacity="0.08"/><text x="353" y="86" font-size="9" fill="#6b7280" text-anchor="middle">jul 7 · 18 commits</text>
  <rect x="460" y="70" width="220" height="24" rx="4" fill="#7a4fd0" opacity="0.08"/><text x="570" y="86" font-size="9" fill="#6b7280" text-anchor="middle">jul 8 · 42 commits</text>
  <line x1="40" y1="118" x2="680" y2="118" stroke="#cfd7d6" stroke-width="2"/>
  <g font-size="8.5">
    <circle cx="70" cy="118" r="5" fill="#d9351d"/><text x="70" y="140" fill="#17211f" text-anchor="middle" font-weight="700">the toy</text><text x="70" y="153" fill="#6b7280" text-anchor="middle" font-size="7.5">canvas + replay</text>
    <circle cx="160" cy="118" r="5" fill="#d9351d"/><text x="160" y="168" fill="#17211f" text-anchor="middle" font-weight="700">the engine</text><text x="160" y="181" fill="#6b7280" text-anchor="middle" font-size="7.5">continuous space</text>
    <circle cx="240" cy="118" r="5" fill="#d9351d"/><text x="240" y="140" fill="#17211f" text-anchor="middle" font-weight="700">offline fit + 3D</text><text x="240" y="153" fill="#6b7280" text-anchor="middle" font-size="7.5">PERSPECTIVE</text>
    <circle cx="360" cy="118" r="5" fill="#2b6cb0"/><text x="360" y="168" fill="#17211f" text-anchor="middle" font-weight="700">unified + profile</text><text x="360" y="181" fill="#6b7280" text-anchor="middle" font-size="7.5">viz layer</text>
    <circle cx="440" cy="118" r="5" fill="#2b6cb0"/><text x="440" y="140" fill="#17211f" text-anchor="middle" font-weight="700">WASM worker</text><text x="440" y="153" fill="#6b7280" text-anchor="middle" font-size="7.5">python in-browser</text>
    <circle cx="540" cy="118" r="5" fill="#7a4fd0"/><text x="540" y="168" fill="#17211f" text-anchor="middle" font-weight="700">the commons</text><text x="540" y="181" fill="#6b7280" text-anchor="middle" font-size="7.5">convex backend</text>
    <circle cx="650" cy="118" r="5" fill="#7a4fd0"/><text x="650" y="140" fill="#17211f" text-anchor="middle" font-weight="700">replay lab</text><text x="650" y="153" fill="#6b7280" text-anchor="middle" font-size="7.5">+ coach rollout</text>
  </g>
</svg>
<figcaption><em>fig — the git history, six phases deep.</em></figcaption>
</figure>

- **the toy** (`initial concept`). the very first commit is already opinionated: 5,000+ lines dropping a Canvas2D renderer, a TypeScript game loop, *and* a full Python analysis package all at once — plus a `vision.md` manifesto arguing aim training has "a feedback problem, not a content problem." three hand-named scenarios: Triple Click, Reactive Flick, Strafe Track. commit #2 is `ADD REPLAY` — replay was foundational, not bolted on.
- **the engine** (`continuous task spaces`). this is the day-one leap that defines the project: the generator gets deleted, and a drill becomes a point in a parameter space instead of a name. every hand-named family becomes a region. the coach can now train configurations no human authored.
- **going scientific & 3D** (`OFFLINE FIT!` → `PERSPECTIVE`). the Python capability fit gets wired in, the Viscose extractor lands, and the flat 2D projection grows a real perspective room — floor lines, ground shadows as depth cues, focal length and FOV. the toy starts looking like an FPS.
- **the unified engine & profile** (day two). `unified engine` collapses everything into one engine abstraction; `profile page` is a 4,500-line stats/insights/run-log system with the whole ECharts + micro-viz layer (every chart in this post descends from here). then the showstopper: **`webassembly worker!`** — the Python moves *into the browser*.
- **the backendening** (day three). Convex stands up: population factor model, task-Elo, the determinism verifier, the leaderboard, rate limiting, anti-abuse. the "Aim Commons" is born.
- **the replay lab & coach** (day three, 42 commits — the densest day). `remove report, add dashboard, less text` **retires the Python markdown report** for the interactive client-side dashboard. the coach matures into a forward-simulated rollout planner (`COACK ROLLOUT`, yes that's the real commit name), with a pre-session briefing and that hard-won variety cap.

things that died along the way, for the record: the standalone "report" pipeline, a `verify-celebrate.html` results screen, a static multi-tap scenario, and the entire concept of discrete named scenarios — all absorbed into the continuous space, the in-browser WASM, and the live dashboard.

---

## the one thing i refuse to fake: transfer

here's the part where every other trainer either lies or goes quiet, so i want to be loud about it.

**does aim-trainer practice actually make you better at the real game?** for skilled players, *there is no verified study that says yes.* it's not that the answer is no — it's that nobody has properly measured it. the surrounding evidence is genuinely sobering:

- video-game training shows **near-zero far transfer** to general cognitive ability across a 359-effect meta-analysis.[^sala]
- KovaaK's scores are extremely *reliable* (test-retest ICC 0.947–0.995) but the authors explicitly warn this **does not license inferences about in-game FPS performance**, because the trainer strips out real gameplay's cognitive load.[^kovaaks]
- Voltaic itself disclaims it — the benchmarks are "just one piece of the puzzle."[^voltaic]
- and **Lumosity paid the FTC $2 million** for marketing exactly this kind of unproven transfer claim.[^ftc]

the one genuinely encouraging result is Neri et al. (2021): novices on *adaptive-difficulty* CS:GO training improved in-game faster than a fixed-difficulty group.[^neri] but n=21, the "adaptive algorithm" was a researcher manually swapping bot configs, and they were novices, not plateaued enthusiasts. it supports the *thesis*. it does not prove *my system*.

so openaim's stance is: **transfer is the central open question, not a settled premise.** the product is built to *measure* it — spaced retention tests instead of same-session scores, test-retest reliability reported for every metric, and (opt-in) linkage to in-game stats so the correlation can eventually be computed. the honest line is *"i measure X reliably; whether it transfers is what i'm studying — here's the current data,"* and that line is the entire difference between this and a Lumosity.

this is also why the north star is **train the player, not the score.** wherever "get a better number on this scenario" and "become a fundamentally better aimer" point in different directions — and they diverge constantly — openaim follows the second, even when it *lowers* your score today. the sens that gives your best score is often the one you've overfit muscle memory to. the schedule that makes your in-session number climb fastest is worse for durable learning. a benchmark you can grind is a benchmark you'll cheese. so the system optimizes the latent capability the score is a proxy for, and treats the score as an instrument reading, not the target.

(yes. the minmaxer built an anti-minmaxing machine. character growth.)

there's also one claim i had to *kill* during my own research. i really wanted to use a square-root difficulty law — `√(D/W)` is a cleaner metric than log-Fitts — but when i adversarially fact-checked the sources, it didn't survive (it overreaches the 1988 paper and later work contradicts it).[^meyer] so it's out. openaim uses log-Fitts and the submovement/SDN model, not the pretty thing i wanted. that's the deal i made with myself: every number ships with a citation, and citations that don't hold up get cut, even the convenient ones.

---

## setbacks & what's honestly not there yet

in the spirit of every other build post i've written — here's what's held together with tape:

- **the transfer study doesn't exist yet.** the *harness* is built; the actual longitudinal, in-game-linked study is the whole point and it's unrun. everything i claim about transfer is "we're measuring it," not "it works."
- **the commons is a ghost town.** the backend is live and the whole train→publish→serve loop works, but the population is synthetic seed data — it's basically the pilot prior wearing a population costume until real people contribute. contribution is on by anonymous default specifically to fix this.
- **the science is priors, not gospel.** the motor-control laws are validated on static targets and saccades, not FPS tracking. the difficulty models are mostly in-sample, small-n, young-adult. FSRS is a *declarative*-memory model and motor retention isn't the same thing — i reuse the machinery but haven't re-fit the functional forms on real motor-retention data. all flagged in-app.
- **the docs drifted from the code.** writing this, my own extraction pass caught that some docstring formulas no longer match the shipped feature functions, and the target success rate quietly moved from 0.72 to 0.68 when the offline sim retuned it. the code is the truth; the prose is catching up. (the irony of a "radical transparency" project having stale docs is noted and being fixed.)
- **eye tracking is vaporware-adjacent.** the quiet-eye idea[^vickers] is scoped and honest, but webcam gaze is too low-accuracy to be in the loop, so it isn't.
- **the tracking speed ceiling.** the coach can't yet generate the fastest elite tracking scenarios (~129°/s); its speed axis caps lower.

none of these are secrets in the app. that's sort of the whole bit.

---

## conclusion

i set out to answer a stupidly simple question — *why did i miss that shot?* — and it turned into a measurement instrument with four engines, a Bayesian filter, a population model, a WASM-hosted science package, and a leaderboard that re-simulates your inputs to catch cheaters.

the thing i actually believe, under all the machinery: aim training deserves to be a *measurement science*, not a scoreboard with vibes. every mouse movement is a signal about your motor system, and if you take that seriously — segment it, fit it, cite it, and refuse to lie about what it means — you can build something that tells you the truth about your own hands. whether that truth carries into the game is the honest open question, and i'd rather ship the question with a ruler attached than ship a promise.

it never produces a *perfect* aimer. but it tells you, today, exactly where your noise lives.

that's the end. thanks for reading ✦

— pramit ✦ mazumder

---

## references & footnotes

*every load-bearing claim above traces to one of these. confidence is flagged honestly: where the science is foundational i lean on it; where it's single-study, contested, or borrowed from an adjacent field, it's a prior to re-validate, and i say so.*

[^meyer]: Meyer, Abrams, Kornblum, Wright & Smith (1988). "Optimality in human motor performance: Ideal control of rapid aimed movements." *Psychological Review* 95(3), 340–370. [link](https://www.researchgate.net/publication/232518277_Speed-Accuracy_tradeoffs_in_aimed_movements_Toward_a_theory_of_rapid_voluntary_action). *The stochastic optimized-submovement model — ballistic primary + corrections; endpoint SD grows linearly with velocity. The backbone of Engine 1. **Strong/foundational**, but on static discrete targets; its √-law framing was the one claim I refuted.*

[^harris]: Harris & Wolpert (1998). "Signal-dependent noise determines motor planning." *Nature* 394, 780–784. [link](https://www.nature.com/articles/29528). *A single minimum-variance / signal-dependent-noise principle predicts both saccades and reaches and derives Fitts's law. Grounds σᵥ and the four hand-space axes. **Strong/foundational.***

[^challengepoint]: Guadagnoli & Lee (2004). "Challenge Point: A framework for conceptualizing the effects of various practice conditions in motor learning." *J. Motor Behavior* 36(2). [link](https://www.researchgate.net/publication/8574634_Challenge_Point_A_Framework_for_Conceptualizing_the_Effects_of_Various_Practice_Conditions_in_Motor_Learning). *Learning peaks at a per-performer optimal challenge point; difficulty is functional, not fixed. The theoretical backbone of the coach targeting ~0.68 success. **Strong theory; hard to operationalize exactly.***

[^cretton]: Cretton et al. (2025). "When Random Practice Makes You More Skilled: Applying the Contextual Interference Principle to a Simple Aiming Task." *J. Cognitive Enhancement.* [link](https://link.springer.com/article/10.1007/s41465-025-00317-5). *Random-order mouse-aiming practice: worse during training, better at retention/transfer. Motivates opt-in variable practice; corollary that in-session score misleads. **Contested** (single, n=36, y-axis only).*

[^ammar]: Ammar et al. (2023). "The myth of contextual interference…" *Educational Research Review* 39, 100537. [link](https://www.sciencedirect.com/science/article/abs/pii/S1747938X23000301). *37 studies: no significant blocked-vs-random difference in applied settings. The counterweight — why variable practice is opt-in and A/B'd, never marketed as proven. **Strong meta-analysis (applied null).***

[^vickers]: Vickers (2009). "The quiet eye as a bidirectional link…" *Progress in Brain Research* 174. [link](https://www.sciencedirect.com/science/article/abs/pii/S0079612309013223). *Pre-shot fixation as a measurable expertise marker → the (experimental, gated) eye-tracking idea. **Established construct; not aim-trainer-specific.***

[^sala]: Sala, Tatlidil & Gobet (2018). "Video Game Training Does Not Enhance Cognitive Ability." *Psychological Bulletin* 144(2). [link](https://pubmed.ncbi.nlm.nih.gov/29239631/). *Near-zero far transfer (k=359). Why OpenAim makes zero cognitive/far-transfer claims. **Strong meta-analysis.***

[^ftc]: FTC (2016). "Lumosity to Pay $2 Million to Settle FTC Deceptive Advertising Charges." [link](https://www.ftc.gov/news-events/news/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges-its-brain-training-program). *Unsubstantiated transfer claims are legally actionable; standard = "competent and reliable scientific evidence." The claims policy. **Primary/authoritative.***

[^doclick]: Do, Chang & Lee (2021). "A Simulation Model of Intermittently Controlled Point-and-Click Behaviour." *CHI '21.* [link](https://dl.acm.org/doi/10.1145/3411764.3445514). *Generative sim of point-and-click on moving+static targets; the `D_click` bits difficulty index; perceptual-vs-motor ablation fingerprints. A-priori difficulty (Engine 2) + miss fingerprinting (Engine 1). **Strong-but-caveated** (in-sample, young adults).*

[^icp]: Lee, Kim, Oulasvirta et al. (2020). "Intermittent Click Planning model (ICP)." *CHI '20.* [link](https://dl.acm.org/doi/10.1145/3313831.3376725). *Predicts click error rate; localizes the elite-vs-novice gap to internal-clock timing precision. The timing axis + real-time submovement pipeline. **Strong-but-caveated.***

[^servo]: Park, Lee et al. (2020). "Servo-Gaussian model" for continuous tracking. *UIST/VRST '20.* [link](https://dl.acm.org/doi/10.1145/3379337.3415896). *Predicts success in steering & pursuit; positioned for game difficulty tuning. The tracking axes (smoothPursuit, reactivity). **Strong-but-caveated**; personalize corrective RT.*

[^swipiness]: Huang / Lee et al. (2022). FPS-aim telemetry & Fitts across scenarios. *Front. Hum. Neurosci.* 16:979293. [link](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9744923/). *Fitts fits within but not across flicking tasks; skilled players shift strategy; the "swipiness" feature. No single global throughput number. **Strong-but-caveated** (32 pro/semi-pro males).*

[^ternary]: (2019). Ternary-Gaussian + Temporal Pointing for moving-target selection. *CHI '19 EA.* [link](https://dl.acm.org/doi/10.1145/3290607.3313077). *Moving-target selection is spatial AND temporal. Why moving-target difficulty always carries a temporal term. **Weak/preliminary** (n=12).*

[^pelanek]: Pelánek (2016). "Applications of the Elo Rating System in Adaptive Educational Systems." *Computers & Education.* [link](https://www.fi.muni.cz/~xpelanek/publications/CAE-elo.pdf). *Elo as online Rasch; raw %-correct is biased under adaptive selection; deployed at ~75% target success; sizing (~100 plays/item, ~10/user). The rating layer, wholesale. **Strong, deployed at scale (>15M answers).***

[^zpdes]: Clement, Roy, Oudeyer & Lopes (2015). "Multi-Armed Bandits for Intelligent Tutoring Systems (ZPDES)." *JEDM.* [link](https://files.eric.ed.gov/fulltext/EJ1115278.pdf). *A learning-progress bandit over a zone of proximal development; knowledge-light beats model-heavy with real kids. The curriculum layer. **Strong (RCT, 400 children).***

[^fsrs]: FSRS / DSR model (Open Spaced Repetition wiki, 2026). [link](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm). *Retrievability/Stability/Difficulty; spacing-effect laws; ease-hell mean-reversion; power-law forgetting. The retention/spacing layer. **Strong for declarative memory; re-fit the forms for motor skills.***

[^lichess]: Lichess Puzzles (wiki). [link](https://lichess.fandom.com/wiki/Puzzles). *Glicko-2-rated puzzles mined from real games + an "Improvement Areas" weakness view — in-the-wild proof of rating-based drills + weakness targeting. **Deployed product reference.***

[^kovaaks]: KovaaK's reliability study (2024). *PMC10925653.* [link](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10925653/). *Scores highly reliable (ICC 0.947–0.995) but do not license in-game inferences; average multiple attempts across sessions. The baselining rules + reliability standard. **Strong (small pilot, n=10).***

[^neri]: Neri et al. (2021). Adaptive-difficulty CS:GO training. *Front. Psychology* 12:598410. [link](https://www.frontiersin.org/articles/10.3389/fpsyg.2021.598410/full). *Adaptive difficulty → faster in-game skill gain than fixed (Time×Group p=0.017). The one causal pro-adaptive/pro-transfer lead. **Strong-but-caveated** (n=21, novices, manual "adaptation").*

[^autogain]: Kim et al. (2020). "AutoGain: Gain Function Adaptation with Submovement Efficiency." *CHI '20.* [link](https://dl.acm.org/doi/fullHtml/10.1145/3313831.3376244) · [code](https://github.com/SunjunKim/AutoGain). *Auto-individualizes a gain curve from submovement under/overshoot — the exact signal Engine 1 already computes. Engine 4. **Strong-but-caveated** (single source; optimizes a full curve, not a cm/360 scalar).*

[^voltaic]: Voltaic (2024). "Announcing the Season 5 Aiming Benchmarks (Beta) for KovaaK's." [link](https://blog.voltaic.gg/announcing-the-voltaic-season-5-aiming-benchmarks-beta-for-kovaaks/). *Evolving taxonomy; anti-spam scoring; the incumbent standard-bearer self-disclaims in-game transfer. **Primary-vendor.***

[^aimlabs]: Aimlabs — [product page](https://aimlabs.com/aimlabs) · ["Discovery" generative AI](https://medium.com/aimlabs/welcome-to-discovery-aimlabs-generative-ai-for-gaming-9af1bb275c09) · [Steam Aimlabs+](https://store.steampowered.com/app/2253310). *Markets an AI coach / adaptive tasks / kinematic sub-scores, but "49% faster" has no published study and the metrics no published formula; in hands-on use, a manually-operated veneer, not an integrated system. **Primary-vendor (marketing).***

[^aimer7]: AIMER7 KovaaK's routine guide (2019). [link](https://steamcommunity.com/sharedfiles/filedetails/?id=1679977919). *The community's foundational routine — published once, never updated, a static external PDF. The static-routine pain point OpenAim targets. **Primary artifact.***

[^sini]: Sini — routine-author commentary (2023). [link](https://x.com/sinizap/status/1734652450080989497). *No single "ideal sens" (a range, playstyle-dependent); transfer is conditional on deliberate practice; changing sens recruits different effectors. Engine 4's range-not-number framing. **Practitioner opinion (informed).***
