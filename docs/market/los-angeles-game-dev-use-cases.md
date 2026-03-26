# Cue For Los Angeles Game Development

Status: market-research memo  
Last updated: 2026-03-26  
Owner: product strategy / GTM

## Scope

This memo asks a narrow question: if Cue wants to become a must-have tool for game developers and designers living in Los Angeles, which use cases is it best positioned to serve materially better than the current incumbent?

These are **positioning hypotheses**, not measured product benchmarks. In this document, "`10x better`" means Cue can plausibly remove an entire tool handoff, compress a multi-step review loop into one surface, or make a repetitive workflow reusable through receipts and generated tools.

This revision sorts the use cases by **marketplace gap**, not by TAM or easiest initial GTM story. A use case ranks higher when teams are still forced to stitch together multiple partial tools, when the incumbent solves only markup or only image generation, or when no category leader preserves both executable edits and provenance.

The ranking still privileges areas where Cue's product definition is unusually differentiated:

- image-first, text-free-first editing
- design review that can become a real edit
- single-image-first speed
- reproducible receipts
- follow-on tool creation from successful work
- PSD now, `.ai` / `.fig` at the release bar

## Why Los Angeles First

Los Angeles is not a generic "creative professional" market. It is a dense, high-cost cluster of game studios spanning console, PC, mobile, VR, and live-service work. Built In LA describes the city as "a major hub for video game development."[1] Riot's Los Angeles office page showed 82 open roles when this memo was compiled, including UX, art, and tools/pipeline positions.[2]

The local labor economics also matter. Public salary ranges on relevant Los Angeles-area roles are high:

- Riot Principal UX Designer, Los Angeles: $206,700 to $289,000[3]
- Riot Principal Tools & Pipeline Technical Artist, Los Angeles: $185,900 to $258,400[4]
- PlayStation Concept Art Lead, Santa Monica: $178,800 to $268,200[5]
- Naughty Dog Senior UI Artist, Santa Monica: $145,100 to $181,400[6]

That makes iteration speed, review compression, and self-serve workflow automation unusually valuable in this market.

## Top 10 Ranked By Marketplace Gap

| Rank | Use case | Current incumbent | Marketplace-gap read |
| --- | --- | --- | --- |
| 1 | External vendor feedback packets that become executable edits | PDF + Photoshop + ShotGrid/Ftrack | Teams still rely on markup stacks, not tools that turn review intent into scoped executable change. |
| 2 | Localization-safe regional art packages | Photoshop + Figma branches | There are many design tools, but very few products built around image-first regional adaptation with explicit protected regions, space planning, and provenance. |
| 3 | Accessibility and safe-area screenshot sweeps before cert | Jira + screenshots + redraws | Guidelines and ticketing exist, but the review-to-fix workflow is still fragmented and screenshot-bound. |
| 4 | Screenshot-first HUD/UI polish between designer and engineer | Figma | Collaboration tools exist, but the exact-frame, image-first, exportable workflow is still awkward. |
| 5 | Confidential concept exploration on unreleased IP | Midjourney | There are many idea generators, but relatively few suitable tools for private, image-anchored, reproducible concept work on unreleased IP. |
| 6 | Executable art-direction paintovers on real game frames | Photoshop | Photoshop is strong, but it still treats paintover and execution as separate artifacts. |
| 7 | Esports, showcase, and broadcast overlay rehearsals on real frames | Figma + After Effects | Good creative tools exist, but they are still split across frame capture, layout, and motion review. |
| 8 | Self-serve micro-tools for repetitive art chores without waiting on a TA backlog | Photoshop Actions + bespoke internal tools | Teams have partial automation, but it is usually either too technical or weak on provenance. |
| 9 | Live-ops key art and store/event variant production from one approved image | Photoshop | This workflow is painful, but it is already heavily served by broad incumbent toolchains. |
| 10 | Fundraising, publishing, and reveal kits from rough gameplay captures | Photoshop + slideware + outsourced polish | The job is underserved strategically, but not because the market lacks general-purpose tools. |

The table above is the canonical sort for marketplace gap. The detailed writeups below stay grouped for narrative flow rather than strict rank order.

## Executable Art-Direction Paintovers On Real Game Frames

**Who this is for**

- concept art leads
- art directors
- UI leads
- gameplay engineers doing visual polish with design

**The underlying job**

Start from a real screenshot, key art frame, or concept pass. Mark what should change. Generate a few plausible directions. Apply one. Keep the result editable and attributable.

**Why this pain is real**

- PlayStation's Santa Monica concept art lead role explicitly asks for "quick iterations," "paint overs," and "scalable art workflows" that "force multiply the team."[5]
- Naughty Dog's Santa Monica senior UI artist role asks for "context-rich mock-ups" and faster "production and iteration" while collaborating directly with Design, Art, and Engineering.[6]
- GDC's 2025 State of the Game Industry survey found that 11% of developers had been laid off in the prior year and 41% had felt the impact of layoffs, which usually means fewer people absorbing more review cycles.[7]

**Why the incumbent breaks**

The incumbent here is Photoshop because it already sits inside the local hiring stack. The problem is not that Photoshop cannot edit pixels. It is that the review artifact and the executable change are usually separate things:

- screenshot in one place
- notes or paintover in another
- rebuild of the change in another pass
- weak provenance once variants start multiplying

**10x thesis for Cue**

This is an inference from Cue's product definition, not a measured benchmark. Cue is unusually well positioned to collapse the classic loop of:

`capture -> paintover -> comment thread -> rebuild -> export`

into:

`mark -> review -> proposal -> apply -> receipt`

Cue's right-rail communication tools (`Marker`, `Protect`, `Magic Select`, `Make Space`) and review/apply flow are specifically designed to make visual feedback executable inside the same canvas, with tab-local history and export receipts.[7][8]

**Why it still matters**

It fits both the current Mac slice and the long-term product. It also speaks directly to LA teams that already pay premium salaries for people whose time is consumed by review translation rather than actual decision-making.

**Cue proof to gather**

- median minutes from screenshot to approved alternative
- percentage of accepted review proposals applied without leaving Cue
- number of review cycles eliminated per task versus Photoshop-based workflow

## Confidential Concept Exploration On Unreleased IP

**Who this is for**

- concept artists
- visual development teams
- art directors
- creative directors handling licensed or unreleased content

**The underlying job**

Explore visual directions rapidly while keeping proprietary characters, environments, monetization beats, and crossover assets private.

**Why this pain is real**

- Google Cloud's 2026 game developer AI survey reports that 90% of game developers are already using AI, but 63% say data ownership concerns slow generative AI adoption and 61% cite legal/compliance concerns.[9]
- GDC's 2026 State of the Game Industry report says 52% of developers believe generative AI is having a negative impact on the industry, rising to 64% among respondents in visual arts roles.[10]
- Riot's Los Angeles UX job listing explicitly calls out "Safeguarding confidential and sensitive Company data" as a core duty.[3]
- Midjourney's own docs say creations in public channels are "visible to everyone," and private "Stealth Mode" requires a Pro or Mega plan.[11]

**Why the incumbent breaks**

Midjourney is the nearest incumbent when the job is "show me directions fast." It is strong at quick ideation, but weak where game studios care most:

- confidentiality
- editability of the exact source image
- reproducibility of how a decision was reached
- staying anchored to the studio's actual asset instead of a loosely related generation

**10x thesis for Cue**

This is an inference from the PRD plus the market data above. Cue's local-first direction, image-first workflow, and reproducible receipts are a much better match for unreleased game IP than a public-by-default generation product. The strongest wedge is not "better image generation." It is:

- iterate on the studio's real image
- avoid public prompt trails
- keep decisions attached to the canvas state
- preserve a receipt for what happened

That combination speaks directly to the specific adoption blockers cited in game-industry AI research.[9][10]

**Marketplace-gap read**

It is one of the few AI-adjacent wedges where privacy and provenance are not minor features; they are purchase criteria.

**Cue proof to gather**

- percentage of concept sessions completed in local-only or approved-private mode
- time to generate 3 acceptable confidential directions from an internal source image
- ratio of accepted directions that remain editable downstream

## Live-Ops Key Art And Store/Event Variant Production From One Approved Image

**Who this is for**

- live-ops artists
- marketing designers embedded in game teams
- product and community teams who need art refreshes without opening a full art sprint

**The underlying job**

Take one approved hero image and spin it into event, platform, store, seasonal, or regional variants quickly, while preserving the original look and maintaining a clean handoff package.

**Why this pain is real**

- GDC's 2025 survey reports that one in three AAA developers are working on a live-service title.[7]
- Google Cloud's 2026 survey says 95% of developers believe AI reduces repetitive tasks and 83% believe it speeds content creation.[9]
- LA's studio mix spans console, mobile, VR, and esports, which increases the odds that teams are shipping frequent promotional and in-product asset variations.[1]
- PlayStation's concept art lead role asks for scalable workflows, not just beautiful one-off images.[5]

**Why the incumbent breaks**

Photoshop is still the default tool, but the workflow around repetitive single-image changes is heavy:

- duplicate file trees
- manual layer hunting
- repeated crop / remove / reframe passes
- weak repeatability unless a technical artist or designer creates extra automation

**10x thesis for Cue**

This is an inference from Cue's seeded job set and follow-on tool creation path. Cue's launch slice is already aligned with the repetitive live-ops loop:

- `Cut Out`
- `Remove`
- `New Background`
- `Reframe`
- `Variants`

Those map cleanly to the actual work of event art, store capsules, sale banners, and social crops. Add session tabs for alternate directions, review/apply for faster approvals, `Save Shortcut` for repeated transformations, and PSD plus receipt export, and Cue becomes less like an AI toy and more like a live-ops asset workstation.[8]

**Marketplace-gap read**

It is high-frequency work with obvious budget. It also fits Cue's single-image-first wedge better than broad multi-image composition.

**Cue proof to gather**

- number of ship-ready variants produced per approved source image
- time from approved hero art to first three deliverable variants
- reuse count for live-ops shortcuts created from prior sessions

## Screenshot-First HUD/UI Polish Between Designer And Engineer

**Who this is for**

- UX designers
- UI artists
- gameplay or client engineers making visual adjustments with design

**The underlying job**

Start from the actual in-engine or captured screen, mark what needs to change, iterate on the exact image the player will see, then hand off layered assets without losing the relationship to the original frame.

**Why this pain is real**

- Riot's Los Angeles principal UX designer role expects collaboration with designers, engineers, and product managers and asks for Adobe Creative Suite plus Figma proficiency.[3]
- The same Riot role specifically values experience designing tooling for publishing workflows.[3]
- Naughty Dog's senior UI artist role requires maintaining clarity and consistency "across platforms and screen sizes" and lists Photoshop, Illustrator, Figma, and After Effects.[6]
- Figma's official import documentation lists `.sketch`, `.fig`, `.jam`, `.deck`, `.buzz`, `.site`, `.make`, PNG, JPG, and PPTX, but not PSD or AI.[12]

**Why the incumbent breaks**

Figma is the nearest incumbent for collaborative interface work, but it becomes awkward when the real job is screenshot-bound visual polish:

- the source of truth is the captured screen, not a clean design-system frame
- handoff often still needs raster or layered art
- teams bounce between Figma, Photoshop, engine captures, and comments

**10x thesis for Cue**

This is an inference from Cue's current slice plus release bar. Cue can win by being the tool that starts with the actual game frame instead of abstracting away from it too early. That matters for:

- HUD cleanup
- store overlays
- console-safe-area tweaks
- event banners inserted over gameplay imagery
- last-mile polish where exact pixels matter

The current slice already supports screenshot-centric review/apply and PSD export; the release bar adds `.fig` and `.ai` round-trip for teams that still need those endpoints.[8]

**Marketplace-gap read**

This is a strong wedge in Los Angeles because major local studios already hire for hybrid designer-engineer collaboration across publishing and client surfaces. Cue's advantage is that it operates on the same visual artifact those teams are actually debating.

**Cue proof to gather**

- reduction in screenshot-to-implemented mockup time
- reduction in number of tools touched per UI polish task
- percentage of UI polish tasks completed from a captured frame without detouring through Figma first

## Self-Serve Micro-Tools For Repetitive Art Chores Without Waiting On A TA Backlog

**Who this is for**

- technical artists
- art leads
- designers and developers who repeatedly do the same visual cleanup or preparation tasks

**The underlying job**

Once a transformation works, capture it as reusable workflow logic so the next artist or developer does not need to rebuild it from scratch.

**Why this pain is real**

- Riot's Los Angeles principal tools and pipeline technical artist role is explicitly about identifying "shared pain points and redundancies," then designing and implementing "new tools and workflows" that improve creator efficiency, quality, and sustainability.[4]
- Google Cloud's 2026 survey found that 95% of developers say AI tools reduce repetitive tasks.[9]
- Cue's own PRD says generated custom tools are core product value, not a plugin afterthought.[8]

**Why the incumbent breaks**

The incumbent here is a mix of Photoshop Actions, ad hoc scripts, and whatever the technical art team can fit into its backlog. That model has three structural problems:

- only a small part of the org can author new automation
- local scripts often break provenance and reproducibility
- valuable one-off edits die as tribal knowledge instead of becoming reusable capability

**10x thesis for Cue**

This is an inference from Cue's `Save Shortcut` / `Create Tool` direction. Cue is best positioned to turn successful image work into reusable one-click tools because the source material, the edit, and the receipt all already live in the same runtime.

That is a meaningful jump over both Photoshop Actions and internal TA requests, especially for recurring game-team chores such as:

- subject isolation for store art
- repeatable crop/outpaint patterns
- common badge or frame cleanup
- background cleanup on captured gameplay or concept frames
- identity-preserving style variants for recurring events

**Marketplace-gap read**

This use case is strategically important, but it ranks slightly lower because Cue's tool-creation path still needs hardening to fully deliver the promise at scale. The upside is large once the core single-image loop is stable.

**Cue proof to gather**

- number of user-authored shortcuts reused 5 or more times
- reduction in TA-request backlog for repeatable image chores
- percentage of recurring asset tasks automated by non-programmers

## Additional Underserved Use Cases

These are not the cleanest homepage messages, but they are high-value second-wave wedges for Los Angeles studios with dense cross-functional pipelines.

| Rank | Unconventional use case | Current incumbent | Why Cue can win |
| --- | --- | --- | --- |
| 6 | External vendor feedback packets that become executable edits | PDF + Photoshop + ShotGrid/Ftrack | Cue can turn art feedback into a proposed or applied change instead of another ambiguous markup round. |
| 7 | Esports, showcase, and broadcast overlay rehearsals on real frames | Figma + After Effects | Cue can start from the actual frame the audience sees and iterate overlays in-context. |
| 8 | Localization-safe regional art packages | Photoshop + Figma branches | Cue can preserve the image while explicitly shaping space for text expansion, badges, and region-specific legal/publishing needs. |
| 9 | Accessibility and safe-area screenshot sweeps before cert | Jira + screenshots + redraws | Cue can make real captured frames the review surface for readability, HUD crowding, and safe-area fixes. |
| 10 | Fundraising, publishing, and reveal kits from rough gameplay captures | Photoshop + slideware + outsourced polish | Cue can rapidly upgrade rough captures into presentation-grade stills while preserving provenance for later reuse. |

## External Vendor Feedback Packets That Become Executable Edits

**Who this is for**

- art outsourcing managers
- art leads
- technical artists
- producers coordinating with external vendors

**The underlying job**

Take a vendor submission, mark exactly what needs to change, preserve what should not move, and return feedback that is concrete enough to reduce another full review round.

**Why this pain is real**

- Riot's public Los Angeles hiring slate currently includes roles such as `Concept Art Lead - Valorant`, `Senior Tools & Pipeline Technical Artist`, `Senior Marketing Creative Director`, and `Senior Technical Producer, Esports Platforms`, which is a signal that asset production, pipeline, and partner coordination are active operating concerns in LA.[13]
- Riot's Senior Technical Producer for Esports Platforms says the team uses "a mix of internal development and external partners" and must coordinate dependencies and stakeholder visibility.[14]

**Why the incumbent breaks**

The common stack here is a mix of PDF markup, Photoshop paintovers, ShotGrid/Ftrack comments, and Slack clarifications. That creates a familiar failure mode:

- visual note is separate from the asset
- protected areas are implicit rather than explicit
- the vendor still has to interpret the intent
- there is weak provenance for what changed between review rounds

**10x thesis for Cue**

This is an inference from Cue's current review/apply loop. Cue can turn outsourced feedback from "here is what we mean" into "here is the scoped change we are asking for":

- `Marker` for attention
- `Protect` for non-negotiable areas
- `Magic Select` for precise targets
- review proposals that can preview likely outcomes
- receipts that preserve what instruction was attached to which delivery

That is materially better than a markup-only tool for vendor-heavy teams.

**Cue proof to gather**

- reduction in review rounds per external asset
- percentage of vendor notes expressed with explicit protected regions
- time from vendor submission to approved revision direction

## Esports, Showcase, And Broadcast Overlay Rehearsals On Real Frames

**Who this is for**

- esports product and design teams
- marketing creatives
- event producers
- publishing designers working on watch surfaces

**The underlying job**

Start from a real stream frame, event slate, or reveal image. Test overlay treatments, sponsor/schedule placement, visual hierarchy, and fan-facing callouts without rebuilding the frame in a separate design tool first.

**Why this pain is real**

- Riot's live Los Angeles roles include `Esports Partner Solutions Strategist`, `Senior Technical Producer, Esports Platforms`, and `Network Engineer II Infrastructure Esports`, showing that fan-facing esports presentation work is operationally anchored in LA.[13]
- Riot's Senior Technical Producer for Esports Platforms is responsible for delivery across internal teams and external partners, with product and design tooling including Miro and Figma already in the stack.[14]
- Summer Game Fest describes its flagship event as "Live from Dolby Theatre" with "thousands of fans" and a packed schedule of showcase moments.[15]
- The Game Awards said its 2024 show reached 154 million global livestreams.[16]

**Why the incumbent breaks**

The incumbent is usually a Figma plus After Effects workflow. It works, but it is indirect:

- frame grab in one place
- overlay comp in another
- motion rehearsal elsewhere
- stakeholder feedback detached from the exact pixels viewers will actually see

**10x thesis for Cue**

This is an inference from Cue's screenshot-first strengths. Cue can win when the real debate is not "what should the design system be?" but "does this overlay work on this exact frame?":

- test watch-surface ideas on real captures
- protect critical gameplay areas
- try alternate placements in adjacent session tabs
- review and apply in the same canvas
- export receipts that explain which frame and treatment got approved

That is especially useful in LA because so much game marketing and esports presentation work is tied to tentpole show moments.

**Cue proof to gather**

- time from raw broadcast frame to approved overlay variant
- number of stakeholder rounds before a watch-surface treatment is locked
- percentage of overlay revisions made on captured frames instead of abstract mockups

## Localization-Safe Regional Art Packages

**Who this is for**

- localization producers
- publishing designers
- regional marketing teams
- product teams shipping simultaneous global beats

**The underlying job**

Create regional variants of the same approved image while handling text expansion, ratings/legal badges, regional promotions, and platform-specific packaging constraints.

**Why this pain is real**

- Riot's Senior Localization Producer in Los Angeles is responsible for embedding "global readiness" into products and activations, ensuring regional requirements and publishing constraints are incorporated early and that launches align across regions, channels, and platforms.[17]
- The same role emphasizes reducing upstream and downstream friction and supporting scalable global launches.[17]

**Why the incumbent breaks**

Photoshop and Figma can produce regional variants, but the process tends to fork into fragile branches:

- duplicate files for each region
- late-stage text expansion collisions
- manual badge placement
- unclear history of why one market's version diverged from another

**10x thesis for Cue**

This is an inference from Cue's communication tools plus session-tab model. Cue is well-suited to regional packaging work because the user can keep the exact same image as the anchor and explicitly shape where localized content is allowed to grow:

- `Protect` keeps hero art from being touched
- `Make Space` communicates where regional copy or labels need room
- session tabs hold region-specific branches
- export receipts preserve which variant maps to which market

That is a sharper fit for regional image adaptation than a general-purpose canvas with no built-in review provenance.

**Cue proof to gather**

- number of regional variants produced from one approved master image
- reduction in late localization rework
- percentage of regional differences captured in receipts instead of ad hoc comments

## Accessibility And Safe-Area Screenshot Sweeps Before Cert

**Who this is for**

- UI artists
- UX designers
- gameplay engineers
- QA and accessibility reviewers

**The underlying job**

Review actual captured gameplay and menu frames for unreadable text, HUD crowding, unsafe edge placement, and other visual issues that only show up in context.

**Why this pain is real**

- GDC's 2024 State of the Game Industry report highlighted a 26% increase in games with accessibility measures.[18]
- Microsoft's Xbox Accessibility Guideline 101 explicitly calls out HUD text, instructions, subtitles, chat, and notifications as areas where unreadable text can block players, and recommends a minimum default console text size of 26 px at 1080p.[19]
- Microsoft's 10-foot experience guidance says HDTV title-safe area is the inner 90 percent of the frame buffer and recommends keeping critical UI and HUD indicators within the inner 85 percent for greatest compatibility.[20]

**Why the incumbent breaks**

The incumbent is usually screenshot capture plus Jira ticket plus redraw:

- QA files a bug with a screenshot
- design redraws the issue in another tool
- engineering reinterprets the redraw back into the game

That is slow and lossy when the issue is deeply tied to the exact frame.

**10x thesis for Cue**

This is an inference from Cue's screenshot-native workflow. Cue can turn accessibility and safe-area review into a visually executable pass on real frames:

- mark unreadable HUD text directly
- protect gameplay-critical regions
- create room for safer placements
- generate applied alternatives from the exact screenshot under discussion

That makes Cue a practical pre-cert triage tool, not just a concept tool.

**Cue proof to gather**

- number of readability and safe-area issues resolved from captured frames
- reduction in turnaround time from accessibility finding to revised mockup
- percentage of HUD fixes reviewed on actual screenshots rather than recreated comps

## Fundraising, Publishing, And Reveal Kits From Rough Gameplay Captures

**Who this is for**

- indie founders
- creative directors
- publishing leads
- designers preparing greenlight, pitch, or reveal materials

**The underlying job**

Take rough vertical-slice captures and turn them into convincing stills for investor decks, publisher conversations, showcase submissions, store pages, or reveal beats.

**Why this pain is real**

- GDC's 2025 survey says 56% of developers have put their own money into funding the creation of their game, while 28% cite project-based or publishing deals as a funding source.[7]
- Summer Game Fest positions itself as a tentpole place to show "what's next in video games."[17]
- The Game Awards reported 154 million global livestreams for the 2024 show, which shows the scale at which first-impression frames are now judged.[18]

**Why the incumbent breaks**

The incumbent is a scramble across Photoshop, Keynote or Slides, and whatever last-minute freelance polish a team can afford. The result is usually:

- rough captures that do not quite sell the game
- no clean record of what was altered for presentation
- polished pitch stills that are hard to reuse later in production

**10x thesis for Cue**

This is an inference from Cue's seeded job set. Cue is unusually aligned with the work of upgrading a rough gameplay capture into a pitch-grade still:

- `Remove` to clear temporary clutter
- `Reframe` to improve composition
- `New Background` or cleanup where appropriate
- `Variants` for alternative presentation directions
- receipts so teams know what was changed for the deck or reveal package

That is a better story than using a general-purpose image tool plus hand-written notes when the studio is fighting for funding or attention.

**Cue proof to gather**

- time from rough gameplay capture to presentation-grade still
- number of reusable pitch/reveal assets produced from one vertical slice
- percentage of presentation assets that can be traced back to a reproducible edit receipt

## A Thiel-Style Read Of The Opportunity Map

This is an inference from Peter Thiel's `Zero to One` style framework, not a claim about his actual opinion. He would likely not organize this list by "what sounds coolest" or even by raw market size. He would organize it by:

- where Cue can start as a monopoly in a small market
- where incumbents are structurally weak or disinterested
- which wedge compounds into a platform
- which opportunities are crowded feature markets instead of company-defining categories

### 1. Monopoly Wedges Hidden Inside Boring Work

These are the most Thiel-like opportunities because they look narrow, unfashionable, and commercially meaningful.

- `External vendor feedback packets that become executable edits`
- `Localization-safe regional art packages`
- `Accessibility and safe-area screenshot sweeps before cert`

Why they fit the lens:

- incumbents solve fragments of the workflow, not the whole job
- buyers already have budget and urgency
- the work is operationally painful but not glamorous, which keeps competition thinner
- success creates switching costs through receipts, review history, and embedded team process

Thiel-style conclusion:

This is where Cue can look like a monopoly in a small market before it tries to look like a platform in a big one.

### 2. Beachheads That Can Expand Into A System Of Record

These are stronger as opening products than as pure whitespace bets because they are easier for users to understand and demo.

- `Executable art-direction paintovers on real game frames`
- `Screenshot-first HUD/UI polish between designer and engineer`
- `Self-serve micro-tools for repetitive art chores without waiting on a TA backlog`

Why they fit the lens:

- the pain is obvious on first use
- the workflow is frequent enough to change behavior
- the byproducts compound into defensibility: receipts, tab history, accepted proposals, reusable shortcuts, and team-specific tool graphs

Thiel-style conclusion:

These are not just features. They are candidates for Cue to become the visual workflow operating system inside a studio.

### 3. Large Markets With Loud Competition Where Positioning Must Be Contrarian

These are attractive markets, but dangerous starting points if Cue describes itself too generically.

- `Confidential concept exploration on unreleased IP`
- `Live-ops key art and store/event variant production from one approved image`
- `Esports, showcase, and broadcast overlay rehearsals on real frames`

Why they fit the lens:

- many teams already use broad incumbents
- generic "AI for images" positioning collapses Cue into a crowded market
- Cue only wins if it is framed around privacy, executability, provenance, and workflow compression rather than novelty output

Thiel-style conclusion:

These are good expansion markets after Cue owns a narrower category. They are worse as the first company-defining claim unless Cue is deliberately contrarian.

### 4. Revenue Opportunities That Look More Like Services Than Monopoly

- `Fundraising, publishing, and reveal kits from rough gameplay captures`

Why it sits here:

- real need, especially for indies and publishing beats
- but the job can be absorbed by agencies, freelancers, Photoshop, or ad hoc polish
- hard to build durable monopoly positioning around this alone

Thiel-style conclusion:

Useful adjacency, weak core thesis.

### The Likely Thiel Hierarchy

If he compressed the list to a company-building order, it would likely read like this:

1. Own a narrow monopoly wedge in overlooked operational work.
2. Use that wedge to become the system of record for visual review and applied change.
3. Expand into louder markets only after Cue has a proprietary workflow graph and embedded distribution inside studios.

Under that logic, the most interesting initial company thesis is probably:

`Cue is the executable visual review system for game studios, starting where existing tools are weakest: outsourced asset feedback, regionalized asset adaptation, and screenshot-native cert/accessibility cleanup.`

## Recommendation: Move On Screenshot-First HUD/UI Polish Next

If the question is **which use case Cue is best positioned to move on next from the product slice already in the repo**, the answer is:

`Screenshot-first HUD/UI polish between designer and engineer`

This is not the highest-ranked whitespace wedge in the table above. It is the best **execution-fit wedge** for the current Cue product.

## Plain-English Translation For A Product Person New To Game Dev

- `HUD` means the game information layered on top of play, such as the health bar, minimap, ammo count, quest text, subtitles, or button prompts.
- `UI polish` means the last-mile work of making those on-screen elements clearer, cleaner, better placed, and more visually coherent on the exact screen the player will see.
- A `client engineer` or `gameplay engineer` is often the person who implements those final on-screen changes inside the game after design signs off.

The current game-team workflow is often:

`capture screen -> mark it up in one tool -> discuss it in another -> rebuild it somewhere else -> hand it to engineering`

Cue is already organized around the right primitive for collapsing that loop:

`one real frame -> visual marks -> review proposals -> applied change -> receipt`

That matches the current PRD unusually well because Cue already centers on a single image, communication marks, review/apply, session tabs, PSD export, and follow-on shortcut creation.[8]

## Why This Comes Before The Higher-Gap Wedges

- `External vendor feedback packets` are strategically attractive, but they require stronger packetization, sharing, and round-based approval flows than Cue currently treats as first-class.
- `Localization-safe regional art packages` require more explicit variant management, market/package constraints, and eventually text-aware space planning across many branches.
- `Accessibility and safe-area triage` is compelling, but it becomes credible only after Cue has platform-aware guides, readability measurement, and audit-style outputs.
- `Screenshot-first HUD/UI polish` can be shipped as a narrower, more legible move using capabilities Cue already has or is already committed to shipping: screenshot-native review/apply, session tabs, PSD export now, and `.fig` / `.ai` endpoints later.[8]

## What Core Product Work This Choice Actually Means

This is not "add a game template pack." The next phase is to make Cue feel native to the workflow of polishing a captured game screen and handing that decision to the person who implements it.

### 1. Make The Screenshot A First-Class Unit Of Work

Need:

- a session type optimized for one captured frame plus metadata such as game/build, platform, resolution, aspect ratio, capture time, and optional screen name
- a clear distinction between the immutable source frame and the editable overlay or replacement layers generated in Cue
- receipts that store not just which edit ran, but which exact frame and screen context the team approved

Why it matters:

A game team is usually arguing about one exact frame. If the frame loses identity, the feedback becomes ambiguous and harder for engineering to trust.

### 2. Add Frame-Aware Targeting For UI, Not Just Generic Image Regions

Need:

- stronger targeting for interface clusters such as top-left stat blocks, subtitle bands, minimap corners, call-to-action buttons, and store overlays
- a way to protect gameplay-critical regions separately from UI regions so Cue understands what must never be altered
- `Make Space` behavior tuned for HUD movement and spacing, not only general image composition

Why it matters:

For a product person new to game dev, the simplest mental model is: "move or clean up the stuff on top of the game without damaging the game image underneath."

### 3. Add Platform-Aware Guides And Constraints

Need:

- safe-area guides for common game targets such as console or TV layouts versus desktop monitor layouts
- resolution and aspect-ratio presets so a review on `1920x1080` versus `3840x2160` is explicit and reproducible
- optional readability overlays for crowded corners, subtitle zones, or edge violations

Why it matters:

Game UI often breaks only in context. The corner may be unsafe on a TV, the overlay may compete with gameplay, or the text may be readable on a monitor but poor from couch distance.[19][20]

### 4. Make Review Output Implementation-Ready, Not Just Visually Convincing

Need:

- proposal cards that show before and after on the exact frame, not just an isolated crop
- an exportable handoff package containing a flattened preview, layered PSD, changed-region asset output, receipt, and a short rationale for what moved and why
- a later release-bar path for `.fig` and `.ai` round-trip for teams that still finish work in those systems.[8]

Why it matters:

The next person in the loop is often an engineer, not another designer. They need something implementable, not merely persuasive.

### 5. Turn Repeated HUD Polish Into Reusable Shortcuts And Tools

Need:

- `Save Shortcut` flows that can capture repeatable moves such as "push top-right badge inward," "clean subtitle treatment," or "increase space around store CTA"
- parameters that let the same shortcut adapt across different frames instead of replaying as a brittle macro
- receipts that show the shortcut came from a previously accepted change

Why it matters:

This is how the beachhead becomes a platform. One successful screenshot workflow becomes a reusable studio-specific capability instead of a one-off edit.

### 6. Support Fast Side-By-Side Decision Making

Need:

- session-tab compare patterns for alternate directions on the same frame
- quick before/after and variant comparison without forcing a full export round
- a simple winner-selection state so the approved direction is obvious

Why it matters:

Game teams rarely need unlimited open-ended exploration in this step. They usually need "version A, B, or C on this exact screen" and a fast way to choose one.

### 7. Avoid Three Traps In The First Version Of This Wedge

Do not treat this phase as:

- a full Figma replacement
- a direct game-engine integration project
- a complete certification or compliance suite

The near-term product promise should instead be:

`Start from a real game screen, make the feedback executable, export an implementation-ready result, and save the winning pattern for reuse.`

## Concrete Milestone Shape

1. `Screenshot polish MVP`
   Import one game frame, mark UI problems on the frame, generate and apply 2-3 alternative polish treatments, and export PSD plus receipt.
2. `Engineer handoff MVP`
   Add frame metadata, safe-area guides, compare view, and clearer changed-region export so a non-designer teammate can understand what changed.
3. `Reusable studio workflow MVP`
   Let users save a successful polish pattern as a shortcut and reapply it on other frames from the same game or surface.

## What Success Should Look Like

- a designer can start with a real gameplay screenshot instead of recreating the screen in Figma first
- a PM or art lead can compare alternatives without reading a long comment thread
- an engineer receives one approved direction with enough visual and structural context to implement it
- the same class of fix can be reused on the next screen instead of being reinvented

This use case is not the single biggest whitespace opportunity in the memo. It is where Cue's current product truth and the Los Angeles game-dev market overlap most cleanly right now. If Cue wins here, the product can expand naturally into executable paintovers, accessibility triage, vendor feedback, and later localization-safe regional packages.

## Sources

[1] Built In LA, "23 Video Game Companies Who Call LA Home" (Jan. 5, 2026): https://www.builtinla.com/articles/video-game-studios-know  
[2] Riot Games, Los Angeles office page: https://www.riotgames.com/en/work-with-us/offices/los-angeles-usa  
[3] Riot Games, "Principal UX Designer, Riot Client" (Los Angeles): https://www.riotgames.com/en/work-with-us/job/6899074/principal-ux-designer-riot-client-los-angeles-usa  
[4] Riot Games, "Principal Tools and Pipeline Technical Artist - Central Creative" (Los Angeles): https://www.riotgames.com/en/work-with-us/job/7055424/principal-tools-and-pipeline-technical-artist-central-creative-los-angeles-usa  
[5] PlayStation / Naughty Dog, "Concept Art Lead" (Santa Monica): https://www.playstation.com/en-us/corporate/playstation-careers/#gref  
[6] Naughty Dog, "Senior UI Artist" (Santa Monica): https://job-boards.greenhouse.io/naughtydog/jobs/7067706  
[7] GDC, "2025 State of the Game Industry: Devs Weigh in on Layoffs, AI, and More": https://gdconf.com/article/gdc-2025-state-of-the-game-industry-devs-weigh-in-on-layoffs-ai-and-more/  
[8] Cue PRD: /Users/mainframe/Desktop/projects/Juggernaut/PRD.md  
[9] Google Cloud, "Survey: 90% of video game developers already using AI..." (Mar. 13, 2026): https://cloud.google.com/blog/topics/gaming/new-survey-finds-90-of-game-developers-already-using-ai  
[10] GDC, "GDC 2026 State of the Game Industry: Live Service Games, Generative AI, and More": https://gdconf.com/article/gdc-2026-state-of-the-game-industry-live-service-games-generative-ai-and-more/  
[11] Midjourney Docs, "Privacy and Stealth": https://docs.midjourney.com/hc/en-us/articles/32099348346765-Privacy-and-Stealth  
[12] Figma Help Center, "Import files to the file browser": https://help.figma.com/hc/en-us/articles/360041003114-Import-files-to-the-file-browser  
[13] Riot Games, Careers page: https://www.riotgames.com/en/work-with-us/jobs  
[14] Riot Games, "Senior Technical Producer, Esports Platforms - Publishing Platform" (Los Angeles): https://www.riotgames.com/en/work-with-us/job/7545675/senior-technical-producer-esports-platforms-publishing-platform-los-angeles-usa  
[15] Summer Game Fest, "Events": https://www.summergamefest.com/events  
[16] The Game Awards, "TGA 2024 Shatters Viewership Records: 154 Million Livestreams": https://thegameawards.com/news/tga-shatters-viewership-records-154-million-livestreams  
[17] Riot Games, "Senior Localization Producer" (Los Angeles): https://www.riotgames.com/en/work-with-us/job/7656636/senior-localization-producer-los-angeles-usa  
[18] GDC, "2024 State of the Game Industry Report": https://reg.gdconf.com/state-of-game-industry-2024  
[19] Microsoft Learn, "Xbox Accessibility Guideline 101: Text display": https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101  
[20] Microsoft Learn, "Introduction to the 10-Foot Experience for Windows Game Developers": https://learn.microsoft.com/en-us/windows/win32/dxtecharts/introduction-to-the-10-foot-experience-for-windows-game-developers
