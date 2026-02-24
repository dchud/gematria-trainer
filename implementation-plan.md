# Implementation Plan

This document describes the initial implementation plan for the Gematria Trainer
application. It is based on the objectives in AGENTS.md and the constraints in
CLAUDE.md.

### How this document is organized

The sections before "Implementation Phases" are **specifications** — they
define what the application does and how it works. These are reference
material that informs implementation but should not be treated as a task
list. Key specification sections:

- **Architecture** and **Project Structure**: Technology choices, file
  layout, and build pipeline.
- **Gematria Data Model**: The domain data (letters, values, systems,
  ciphers) and how it is stored and computed. This is the core reference
  for correctness testing.
- **Spaced Repetition Algorithm** and **Difficulty Tiers**: The learning
  engine and progression logic.
- **Session and State Management**: How client-side persistence works.
- **User Interface**: View structure, layout wireframes, keyboard
  shortcuts, accessibility, and responsive design.
- **Offline Behavior**: Requirements for offline-first operation.

The **Implementation Phases** section is the actionable plan. Each phase
groups related work with explicit dependencies noted. When creating epics
and tasks, use the phases as the primary structure and the specification
sections as supporting detail.


## Architecture: Static Site

The application is a static site deployed to GitHub Pages. Flask and Frozen-Flask
generate the HTML at build time from Jinja2 templates. All dynamic behavior
(spaced repetition, session state, card interactions) runs client-side in
JavaScript via Alpine.js. There is no server at runtime. Once the page is
fully loaded, the app requires no further network access — all card logic,
data, and state management run locally in the browser. See "Offline
Behavior" below for details on ensuring reliable operation with
intermittent or no connectivity.

Components from the preferred stack:

| Tool         | Role                                                     |
|--------------|----------------------------------------------------------|
| Flask        | Build-time HTML generation via Jinja2 + Frozen-Flask     |
| Tailwind CSS | Styling                                                  |
| Alpine.js    | Client-side interactivity and state management           |
| Chart.js     | Session statistics visualization (progress view)         |
| uv           | Python environment management                            |
| ruff         | Linting and formatting Python build code                 |
| pytest       | Testing build scripts and data correctness               |
| justfile     | Task automation                                          |
| structlog    | Logging in build scripts                                 |
| dotenv       | Configuration for build scripts                          |


## User Prerequisite

The application assumes users already have basic familiarity with the Hebrew
alphabet. They can recognize the letters and know the aleph-bet, even if they
are not fluent in Hebrew. The app does not teach Hebrew letter recognition —
it teaches gematria (the numerical values assigned to those letters). The
splash screen, card design, and tier progression all reflect this assumption:
Tier 1 starts with letter-to-number mappings, not with letter identification.


## Gematria Data Model

Hebrew Gematria assigns a numerical value to each letter of the Hebrew alphabet.
The standard (mispar hechrachi) values are:

| Letter | Name    | Value | Final Form | Final Value |
|--------|---------|-------|------------|-------------|
| א      | Aleph   | 1     |            |             |
| ב      | Bet     | 2     |            |             |
| ג      | Gimel   | 3     |            |             |
| ד      | Dalet   | 4     |            |             |
| ה      | He      | 5     |            |             |
| ו      | Vav     | 6     |            |             |
| ז      | Zayin   | 7     |            |             |
| ח      | Chet    | 8     |            |             |
| ט      | Tet     | 9     |            |             |
| י      | Yod     | 10    |            |             |
| כ      | Kaf     | 20    | ך          | 500         |
| ל      | Lamed   | 30    |            |             |
| מ      | Mem     | 40    | ם          | 600         |
| נ      | Nun     | 50    | ן          | 700         |
| ס      | Samekh  | 60    |            |             |
| ע      | Ayin    | 70    |            |             |
| פ      | Pe      | 80    | ף          | 800         |
| צ      | Tsade   | 90    | ץ          | 900         |
| ק      | Qof     | 100   |            |             |
| ר      | Resh    | 200   |            |             |
| ש      | Shin    | 300   |            |             |
| ת      | Tav     | 400   |            |             |

Notes on number representation:

- Numbers are formed by combining letters whose values sum to the target. For
  example, 25 = כ״ה (20 + 5).
- The combinations 10+5 (י״ה) and 10+6 (י״ו) are avoided because they form
  divine names. Instead, 15 = ט״ו (9 + 6) and 16 = ט״ז (9 + 7).
- A geresh (׳) after a single letter indicates a number. Gershayim (״) before
  the last letter indicates a multi-letter number.
- Thousands can be represented by the same letters with a geresh, or by
  context. For example, the Hebrew year 5784 is typically written as תשפ״ד
  (400 + 300 + 80 + 4 = 784), with the thousands digit (5) implied.

### Gematria systems

There are several established methods for assigning numerical values to Hebrew
letters. The app supports multiple systems, selectable in settings. Each
system uses the same flashcard and spaced repetition infrastructure, but the
letter-to-value (or letter-to-letter) mappings differ.

**Valuation methods** (letter to number):

| System              | Description                                        | Example: ג |
|---------------------|----------------------------------------------------|------------|
| Mispar Hechrachi    | Standard absolute values. The default system described in the table above. | 3 |
| Mispar Gadol        | Like standard, but final forms use their higher values (ך=500, ם=600, ן=700, ף=800, ץ=900). Non-final letters are unchanged. | 3 |
| Mispar Katan        | Reduced values: drop the zeros from each letter's standard value, yielding single digits. י=1, כ=2, ק=1, ר=2, etc. | 3 |
| Mispar Siduri       | Ordinal: letters numbered by position in the alphabet. א=1, ב=2, ... כ=11, ל=12, ... ת=22. | 3 |

**Cipher methods** (letter to letter):

| System   | Description                                                    | Example: א |
|----------|----------------------------------------------------------------|------------|
| Atbash   | Mirror substitution. First letter maps to last, second to second-last, etc. א↔ת, ב↔ש, ג↔ר, ד↔ק, ה↔צ, ו↔פ, ז↔ע, ח↔ס, ט↔נ, י↔מ, כ↔ל. | ת |
| Albam    | Split the alphabet in half. Each letter in the first half maps to the corresponding letter in the second half and vice versa. א↔ל, ב↔מ, ג↔נ, ד↔ס, ה↔ע, ו↔פ, ז↔צ, ח↔ק, ט↔ר, י↔ש, כ↔ת. | ל |
| Avgad    | Each letter maps to the next letter in the alphabet. א→ב, ב→ג, ... ש→ת, ת→א. | ב |

For valuation methods, cards work as letter↔number (same as the default
system). For cipher methods, cards work as letter↔letter: the prompt is one
letter and the answer is its cipher pair.

For historical background, scholarly context, and controversies surrounding
each system, see "Appendix: Historical Context of Gematria Systems" at the
end of this document.

### Reduced tier structures

The full 8-tier structure applies only to Mispar Hechrachi and Mispar Gadol,
which share the standard Hebrew number encoding system (letters combine to
represent multi-digit numbers). The other systems use reduced tier structures
because they map individual letters to values without compound number encoding.

**Mispar Katan and Mispar Siduri (4 tiers)**

These systems assign a single value to each letter (Katan: digits 1-9;
Siduri: ordinals 1-22). There are no compound number cards — only
letter-to-value and value-to-letter drills.

In Mispar Katan, multiple letters share the same reduced value (e.g.,
א=1, י=1, ק=1). Rather than showing all equivalent letters at once,
the app creates separate number-to-letter cards for each letter that
maps to a given value. A card showing "1" might have א as its answer;
a different card also showing "1" has י; a third has ק. The user
encounters all variants naturally through spaced repetition, building
broad recognition of the equivalences through repeated exposure rather
than rote memorization of a grouped list. If the user mentally answers
"א" but the card reveals "י", they rate themselves accordingly — the
self-assessment model handles the learning naturally. Mispar Siduri has
no such ambiguity (each ordinal 1-22 maps to exactly one letter).

| Tier | Letter | Content                                    | Unlock Condition                   |
|------|--------|--------------------------------------------|------------------------------------|
| 1    | א      | Letters א through ט (first 9)             | Starting tier                      |
| 2    | ב      | Letters י through צ (next 9)              | Tier 1: 80% correct, 3+ reps each |
| 3    | ג      | Letters ק through ת (last 4) + final forms | Tier 2: 80% correct, 3+ reps each |
| 4    | ד      | All letters mixed, both directions         | Tier 3: 80% correct, 3+ reps each |

**Cipher methods (3 tiers)**

Multi-letter number cards (tiers 5-8) are not applicable to cipher methods.
Cipher mode uses a 3-tier structure:

| Tier | Letter | Content                              | Unlock Condition                   |
|------|--------|--------------------------------------|------------------------------------|
| 1    | א      | Letters א through כ (first 11)      | Starting tier                      |
| 2    | ב      | Letters ל through ת (last 11)       | Tier 1: 80% correct, 3+ reps each |
| 3    | ג      | All 22 letters mixed, both directions | Tier 2: 80% correct, 3+ reps each |

"Both directions" in tier 3 means the user may be shown either letter of a
pair and must produce the other. For symmetric ciphers (Atbash, Albam), both
directions are identical. For Avgad (asymmetric), the user must know both
the forward mapping (א→ב) and the reverse (ב→א).

### Separate progress per system

Each gematria system maintains its own independent spaced repetition state in
localStorage. Switching systems does not reset progress — the user can switch
between systems and pick up each where they left off. The localStorage key
structure is namespaced by system (e.g., `progress_hechrachi`, `progress_atbash`).
The progress view shows stats for the currently active system.

### Data storage

Reference data is stored as flat CSV and JSON files. The data is small
enough (22 base letters, 5 final forms, a curated set of examples) that a
database adds unnecessary complexity.

- `src/data/letters.csv` — The letter table above: letter, name, position
  (1-22), standard value, final_form, final_value. One row per letter.
- `src/data/examples.json` — Curated real-world gematria examples (see
  "Real-world examples and procedural generation" below). Examples are tagged
  with the system they apply to (most apply to Mispar Hechrachi; some may be
  system-specific).

At build time, a Python script reads these files, validates them, and embeds
them as a JSON object in the generated HTML page for client-side use.

The different valuation and cipher methods are implemented as pure functions
in `gematria.js`, not as separate data files. Each function takes a letter and
returns its value (for valuation methods) or its paired letter (for cipher
methods). The base data in `letters.csv` provides the inputs; the system
functions compute the outputs.

### Card types

The application uses several card types, introduced progressively. Cards show
only the prompt symbol or number in large centered text, with no English
phrasing like "What is the value of..." — the format is self-evident from
context.

1. **Letter-to-number**: Show a Hebrew letter; answer is its numerical value.
2. **Number-to-letter**: Show one of the 22 standard letter values (1, 2, 3,
   ..., 9, 10, 20, ..., 90, 100, 200, 300, 400); answer is the Hebrew letter.
3. **Multi-letter number**: Show a number (e.g., 25); answer is the Hebrew
   representation (כ״ה). Or show the Hebrew representation; answer is the
   number.
4. **Large numbers**: Numbers in the hundreds and thousands range. At higher
   tiers, these are procedurally generated (see below).
5. **Hebrew year**: Show a Hebrew calendar year in gematria (e.g., תשפ״ד);
   answer is the numerical value (784 or 5784). Or vice versa.
6. **Real-world examples**: Values from traditional literature, liturgy, and
   other sources where gematria appears in practice.
7. **Cipher pair**: Show a Hebrew letter; answer is its paired letter under
   the active cipher (Atbash, Albam, or Avgad). Used only when a cipher
   method is active. For symmetric ciphers (Atbash, Albam), showing either
   letter of the pair is equivalent. For Avgad (asymmetric), the prompt may
   ask for the forward mapping (א→?) or reverse (?→א).

### Card types by tier

The following table shows which card types are used in each tier of the
default 8-tier structure (Mispar Hechrachi and Mispar Gadol). For reduced
tier structures (Katan, Siduri, cipher methods), see "Reduced tier
structures" above.

| Tier | Card types used                                           |
|------|-----------------------------------------------------------|
| 1    | Letter-to-number, number-to-letter (letters א-ט)        |
| 2    | Letter-to-number, number-to-letter (letters י-צ)        |
| 3    | Letter-to-number, number-to-letter (letters ק-ת)        |
| 4    | Letter-to-number, number-to-letter (final forms)         |
| 5    | Multi-letter number (11-99, both directions)              |
| 6    | Multi-letter number and large numbers (100-999)           |
| 7    | Hebrew year and large numbers (1000+)                     |
| 8    | Real-world examples + mixed review from all card types    |

For cipher methods, tiers 1-3 use cipher pair cards exclusively.


## Spaced Repetition Algorithm

The application uses a simplified SM-2 algorithm, running entirely in the
browser. Each card has the following state:

```
{
  "card_id": "letter-gimel-to-number",
  "ease_factor": 2.5,
  "interval_minutes": 1,
  "repetitions": 0,
  "next_review": "2024-01-01T00:00:00Z",
  "last_quality": null
}
```

After each review, the user rates their response on a 4-point scale:

| Rating | Button label | Meaning                        | Quality (q) |
|--------|-------------|--------------------------------|-------------|
| 1      | Wrong       | Incorrect answer               | 1           |
| 2      | Unsure      | Correct, low confidence        | 3           |
| 3      | Good        | Correct, high confidence       | 4           |
| 4      | Easy        | Correct, instant recall        | 5           |

The "Button label" column shows the short text displayed on the rating
buttons in the UI. The keyboard shortcuts table and wireframe use these
same labels.

The SM-2 update rules:

- If q < 3 (wrong): reset repetitions to 0, interval to 1 minute.
- If q >= 3:
  - repetitions = 0: interval = 1 minute
  - repetitions = 1: interval = 6 minutes
  - repetitions >= 2: interval = previous interval * ease_factor
- Ease factor adjustment: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)).
  Minimum ease factor is 1.3.

Because sessions may be short (minutes, not days), the intervals use minutes
rather than days. For returning users who pick up a previous session, elapsed
time since last review is factored in.

### Card selection

When choosing the next card to present:

1. Select any card past its `next_review` time, prioritizing the most overdue.
2. If no cards are due, introduce a new card from the current difficulty tier.
3. If the current tier is exhausted and mastery criteria are met, advance to the
   next tier.


## Difficulty Tiers and Progression

Cards are organized into tiers that correspond to the learning progression
described in AGENTS.md. Each tier is identified by its gematria letter
equivalent:

| Tier | Letter | Content                        | Unlock Condition                   |
|------|--------|--------------------------------|------------------------------------|
| 1    | א      | Letters א through ט (1-9)     | Starting tier                      |
| 2    | ב      | Letters י through צ (10-90)    | Tier 1: 80% correct, 3+ reps each |
| 3    | ג      | Letters ק through ת (100-400)  | Tier 2: 80% correct, 3+ reps each |
| 4    | ד      | Final forms (ך ם ן ף ץ) *     | Tier 3: 80% correct, 3+ reps each |
| 5    | ה      | Compound numbers (11-99)       | Tier 4: 80% correct, 3+ reps each |
| 6    | ו      | Compound numbers (100-999)     | Tier 5: 80% correct, 3+ reps each |
| 7    | ז      | Hebrew years and large numbers | Tier 6: 80% correct, 3+ reps each |
| 8    | ח      | Real-world examples            | Tier 7: 80% correct, 3+ reps each |

*Tier 4 teaches different content depending on the active system. In Mispar
Hechrachi, final forms have the same values as their non-final counterparts
(ך = כ = 20, ם = מ = 40, etc.); tier 4 reinforces recognition that these
are the same letter with the same value. In Mispar Gadol, final forms have
distinct higher values (ך = 500, ם = 600, etc.); tier 4 teaches these new
values. The card prompt is the final-form letter in both cases, but the
expected answer differs by system.

The user's current level is displayed as its tier letter (e.g., "Level ג")
throughout the UI. This reinforces the gematria learning — the tier labels
themselves are part of the lesson.

Mastery criteria (80% accuracy with at least 3 repetitions per card in the
tier) can be tuned based on user testing.

### Completion state

When a user has unlocked all tiers and met mastery criteria in the final tier,
the app enters a review mode. In review mode, the card selection algorithm
draws from all tiers, continuing to use spaced repetition to surface cards
that are due for review. Procedurally generated cards (tiers 5-8) continue
to provide fresh material. The progress view indicates that all tiers are
complete and shows cumulative statistics.

### Initial assessment for returning/experienced users

When a new session starts without existing session data, the app runs a brief
placement sequence:

1. Present 3 cards from Tier 1. If the user answers all correctly with high
   confidence, skip to step 2. Otherwise, start at Tier 1.
2. Present 3 cards from Tier 3 (hundreds letters). If correct, skip to step 3.
   Otherwise, start at Tier 2.
3. Present 2 cards from Tier 5 (compound numbers). If correct, skip to step
   4. Otherwise, start at Tier 4 or 5 based on results.
4. Present 2 cards from Tier 7 (large numbers). Place user at appropriate tier
   based on results.

This assessment takes under a minute for experienced users and places them at
the right difficulty level without tedious review of material they already know.
The assessment should feel low-pressure — incorrect answers during placement
are framed as "let's start here" rather than as failures.

For systems with reduced tier structures, the placement sequence is shortened
to match:

- **Mispar Gadol** (8 tiers): Uses the same placement sequence as Hechrachi.
  The only difference is that final-form cards use higher values (500-900).
- **Mispar Katan and Mispar Siduri** (4 tiers): Present 3 cards from tier 1.
  If correct, present 3 from tier 2, then 3 from tier 3. Place the user at
  the first tier where they struggle, or at tier 4 if all are correct.
- **Cipher methods** (3 tiers): Present 3 cards from tier 1 and 3 from tier
  2, then place the user based on results.


## Real-World Examples and Procedural Generation

### Curated examples

The `examples.json` file contains a curated set of real-world gematria values
drawn from traditional sources. Each entry includes the Hebrew text, its
numerical value, and a brief attribution or context note. Sources include:

- Biblical verse references (e.g., the numerical value of specific words).
- Well-known gematria equivalences from rabbinic literature.
- Historical Hebrew calendar years tied to notable events.
- Liturgical and ritual references.

This curated set provides grounding in authentic usage, but is deliberately
kept limited — the goal is not to show the same small set of examples
repeatedly.

### Procedural generation at higher tiers

To keep higher tiers fresh and varied, the app generates cards procedurally at
runtime in addition to the curated examples:

**Tier 5 (compound numbers, 11-99)**: The client-side code picks random
numbers in the range (excluding the single-letter values 20, 30, ..., 90,
which are already covered in Tier 2) and asks the user to convert in either
direction. The 15/16 special cases (ט״ו and ט״ז) are always included in
the initial batch to ensure early exposure.

**Tier 6 (compound numbers, 100-999)**: The client-side code picks random
numbers in the range, excluding single-letter values already covered in
earlier tiers (100, 200, 300, 400 in Hechrachi; also 500, 600, 700, 800,
900 in Gadol where those are single final-form letters). The user converts
in either direction. The gematria encoding/decoding
logic in `gematria.js` handles the conversion, so no pre-built card list is
needed.

**Tier 7 (Hebrew years and large numbers)**:

- Random Hebrew calendar years from a defined range (e.g., 5000-5900,
  corresponding roughly to 1240-2140 CE). Each session generates a different
  sample. The app converts the year to its conventional Hebrew gematria
  representation (omitting the thousands digit as is standard practice).
- Random large numbers (1000-9999) for general large-number fluency.

**Tier 8 (real-world examples + mixed review)**: Draws from the curated
examples set and intersperses procedurally generated numbers from all
difficulty ranges. This tier serves as a comprehensive review that never
runs out of material.

The procedural generation uses a seeded random number generator. The seed
is generated once when a system's progress is first created and is stored
in localStorage alongside that system's spaced repetition state. This
ensures that procedurally generated cards have stable, predictable IDs
across browser sessions — a card reviewed today will be the same card
when it comes due for review tomorrow, because the same seed produces the
same sequence. Different users (or the same user after a "start from
scratch" reset) get a different seed and therefore a different card set.


## Session and State Management

All session state is stored client-side:

- **localStorage**: Stores the full spaced repetition state (card data, ease
  factors, intervals, tier progress, procedural card seeds, and user settings).
  This persists across browser sessions.
- **Cookie**: A simple flag (`gematria_session=1`) with a configurable
  expiration (default: 30 days). The cookie serves a specific purpose that
  localStorage cannot: automatic expiration. If a user does not return within
  30 days, the cookie expires and the app treats them as a new user (prompting
  the splash screen and placement assessment), even though localStorage data
  may still exist. localStorage items do not expire on their own.

On page load:

1. Check for the session cookie.
2. If present, check localStorage for valid session data.
3. If both exist, show a prompt: "Continue where you left off?" with options
   to continue or start over.
4. If no cookie but localStorage data exists: the session has expired. Clear
   the stale progress data from localStorage (preserve settings only) and
   show the splash screen. This avoids subtle bugs from leftover card state
   that may not match the user's actual recall after a long absence.
5. If neither cookie nor localStorage data exists, show the splash screen
   for new users.

### localStorage unavailability

Some browsers restrict localStorage in private/incognito browsing mode (notably
Safari). If localStorage is unavailable, the app still functions — it operates
as a stateless flashcard tool that always starts from the splash screen and
does not persist progress. On load, the app tests for localStorage access with
a try/catch write. If it fails, a brief notice informs the user that progress
will not be saved in this browsing mode.

### Start from scratch

A "Start from scratch" option is available in two places:

- On the welcome/resume prompt when returning (alongside "Continue").
- In the settings view at any time during a session.

The two placements of this option have different scopes:

- **Welcome/resume prompt**: Clears all localStorage progress data for all
  gematria systems (but preserves user settings such as font, animation, and
  dark mode preference) and the session cookie. Returns the user to the splash
  screen. This is a true fresh start.
- **Settings view**: Clears progress for the currently active gematria system
  only. Other systems' progress and all settings are preserved. The user
  remains in the app and the current system restarts from the placement
  assessment.

Both require a confirmation dialog to prevent accidental resets.


## Progress Display

The progress view shows the user's current tier as its gematria letter, along
with statistics:

- Current tier level displayed as its Hebrew letter (e.g., "Level ד")
- A progress bar indicating advancement toward the next tier
- Per-tier accuracy percentages
- Total cards reviewed and overall accuracy
- A simple visualization of accuracy over the session, using Chart.js
  (preferred for its simplicity — d3 is more powerful but overkill for a
  single chart)


## Card Transition Flow

The interaction flow for each card minimizes unnecessary steps. After the
answer is revealed, the user's rating simultaneously records their
self-assessment and advances to the next card — there is no separate "next"
action.

The sequence:

1. Card prompt appears (Hebrew letter, number, or Hebrew number string).
2. User presses Space (or taps "Show Answer") to reveal the answer.
3. Answer appears below the prompt. Rating buttons become visible.
4. User presses a rating key (1-4) or taps a rating button.
5. The rating is recorded. After a brief animated delay, the next card
   appears automatically.

The transition animation between step 4 and step 5 provides visual feedback
that the rating was registered and gives the user a moment to reset before
the next prompt. The animation style and duration are configurable in
settings (see below).

### Navigating away from an active card

If the user opens a different view (settings, reference, progress, about)
while a card is displayed — whether the answer is hidden or revealed — the
card state is preserved. When the user returns to the flashcard view, the
same card is shown in the same state (answer hidden or revealed). No rating
is recorded for the interruption. This avoids penalizing users for checking
the reference table or adjusting settings mid-session.

**Exception: switching gematria systems.** If the user changes the active
gematria system in settings while a card is displayed, the current card is
discarded without recording a rating (the card belongs to the old system
and has no meaning in the new one). When the user returns to the flashcard
view, the app loads the new system's progress state and presents the
appropriate next card — resuming where the user left off in that system, or
starting the placement assessment if the system has no prior progress.

### Transition animation options

The app ships with the following animation presets:

| Name       | Description                                            | Default duration |
|------------|--------------------------------------------------------|------------------|
| fade       | Current card fades out, next card fades in             | 250ms            |
| slide-left | Current card slides out left, next card slides in right | 300ms            |
| none       | Instant switch, no animation                           | 0ms              |

The default is `fade` at 250ms. All animations use CSS transitions driven
by Alpine.js class toggling. The maximum configurable duration is 500ms.
Duration can be set in increments of 50ms.


## Settings

The settings view is accessible from the navigation bar at any time. Settings
are stored in localStorage and persist across sessions. The settings view
contains:

**Gematria system**:
- Dropdown or radio buttons to select the active system. Grouped into two
  categories: valuation methods (Mispar Hechrachi, Mispar Gadol, Mispar Katan,
  Mispar Siduri) and cipher methods (Atbash, Albam, Avgad). The default is
  Mispar Hechrachi. Each option shows a one-line description. Switching
  systems loads that system's independent progress state — no data is lost.

**Hebrew font**:
- Font family: dropdown or radio buttons to select from `Standard`,
  `Sans-serif`, or `Rashi`. Each option shows a preview of a Hebrew letter
  rendered in that font.

**Card transition**:
- Animation style: dropdown to select from `fade`, `slide-left`, or `none`.
- Animation duration: a slider or set of radio buttons for duration in ms
  (0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500). Only enabled when
  animation style is not `none`.

**Appearance**:
- Dark mode: toggle between "System" (follow OS preference), "Light", and
  "Dark".

**Session**:
- "Start from scratch" button with confirmation dialog. This resets progress
  for the currently active gematria system only (other systems' progress and
  all settings are preserved). See "Start from scratch" in the session
  management section for the full-reset variant on the welcome/resume prompt.

Default settings are applied if no localStorage settings exist. Changing a
setting takes effect immediately (no save button needed).


## Hebrew Font Options

This section provides additional detail on font selection — rationale,
available fonts, and licensing. The font setting's UI controls are
described in "Settings" above.

Hebrew letters can look substantially different across font families. To help
users build recognition across typographic styles, the app offers a font
selection setting. The chosen font applies consistently to all Hebrew text
on all cards — it is not randomized per card. This is deliberate:
randomizing fonts per card would add a letter-recognition challenge on top of
the gematria challenge, conflating two skills and producing noisy spaced
repetition data. A per-session setting lets users deliberately practice with
an unfamiliar script when they choose to, while keeping each session internally
consistent.

### Available fonts

| Setting name   | Font family                | Notes                               |
|----------------|----------------------------|---------------------------------------|
| Standard       | Noto Serif Hebrew (or Frank Ruehl) | Default. Familiar book/print style. |
| Sans-serif     | Noto Sans Hebrew           | Clean, modern. Good for screens.     |
| Rashi          | Noto Rashi Hebrew          | Traditional commentary script. Distinct letter forms — a meaningful challenge for users comfortable with standard print. |

These are loaded as web fonts. The build pipeline includes the font files in
`static/fonts/` and references them via `@font-face` declarations in the
Tailwind input CSS. Only the selected font is applied at runtime (all three
are loaded so switching is instant, but the total payload is small — Hebrew
fonts typically weigh 30-80 KB each in WOFF2 format).

### Font licensing

All three fonts are published by Google under the SIL Open Font License
(OFL), which permits free use, redistribution, and embedding in web
applications. Noto Rashi Hebrew is part of the Noto font family
(available via Google Fonts) and is based on the traditional Rashi script
style. Each font's license file should be included in
`static/fonts/LICENSE`.

### Font setting in the UI

The font selector appears in the settings view as a dropdown or set of radio
buttons. Each option shows a short preview of a Hebrew letter in that font
so the user can see the difference before selecting. The setting is stored in
localStorage and persists across sessions. Changing the font takes effect
immediately on all visible Hebrew text.


## Ko-fi Integration

A small "Buy me a coffee" link using Ko-fi provides a way for users to show
appreciation. The integration is lightweight — just a link and optionally
the Ko-fi floating button widget.

### What is needed

1. **A Ko-fi account**: Create a page at ko-fi.com. The page URL takes the
   form `https://ko-fi.com/<username>`.

2. **Configuration**: The Ko-fi username is injected at build time so it is
   not hardcoded in templates. This is configured via environment variable:

   - `.env` (gitignored): Contains actual values.
     ```
     KOFI_USERNAME=your_kofi_username
     GITHUB_REPO_URL=https://github.com/youruser/gematria-trainer
     ```
   - `.env.example` (committed): Contains placeholders.
     ```
     KOFI_USERNAME=
     GITHUB_REPO_URL=
     ```

   The Flask app reads `KOFI_USERNAME` from the environment via python-dotenv
   and passes it to the Jinja2 template context. If the variable is empty or
   unset, the Ko-fi link is not rendered — the app works fine without it.

3. **GitHub Actions secrets**: For the CD workflow to inject the Ko-fi username
   at build time, it must be stored as a GitHub repository secret:

   - Secret name: `KOFI_USERNAME`
   - Set via: GitHub repo settings > Secrets and variables > Actions > New
     repository secret.

   The deploy workflow passes these as environment variables:
   ```yaml
   env:
     KOFI_USERNAME: ${{ secrets.KOFI_USERNAME }}
     GITHUB_REPO_URL: ${{ vars.GITHUB_REPO_URL }}
   ```

   `GITHUB_REPO_URL` can use a repository variable (not a secret) since it
   is public information.

4. **Template rendering**: The base template includes a small Ko-fi link in the
   footer area, conditionally rendered:
   ```
   {% if kofi_username %}
   <a href="https://ko-fi.com/{{ kofi_username }}">Buy me a coffee</a>
   {% endif %}
   ```

   Optionally, Ko-fi provides a JavaScript widget that renders a floating
   button. If used, the widget script tag is also conditional on
   `kofi_username` being set.

### Privacy considerations

- The Ko-fi username is a public page slug (it appears in the URL when anyone
  visits the Ko-fi page), so it is not sensitive. However, keeping it in
  configuration rather than hardcoded means the same codebase can be forked
  or reused without editing templates.
- No Ko-fi API keys or payment information are involved. Ko-fi handles all
  payment processing on their side.
- The `.env` file is gitignored to establish good habits, even though the
  Ko-fi username is not truly secret.


## Offline Behavior

The app is designed to work fully offline after the initial page load. This
is important for mobile users who may have intermittent connectivity (e.g.,
on a train, in a car, or on a plane). Because all card logic, spaced
repetition, gematria data, and state management run client-side with no
server calls, a user who has loaded the page once can continue reviewing
cards indefinitely without network access.

To ensure this works reliably:

### Bundle all JavaScript dependencies locally

Alpine.js, Chart.js, and any other JS libraries must be served
from `static/js/`, not loaded from CDNs. If a library is loaded from a
CDN, a cache eviction or hard refresh while offline would break the app.
The base HTML template references only local copies of these files.

### Service worker for offline caching

A service worker caches the HTML page, all JS files, the compiled CSS, and
the font files on first load. This ensures the app remains available even
if the browser evicts its HTTP cache. The service worker uses a
cache-first strategy — it serves cached assets immediately and updates the
cache in the background when connectivity is available. This is a natural
fit for a static single-page app with no API calls.

The service worker file (`static/sw.js`) is registered from the base HTML
template. It caches a manifest of assets generated at build time.

### Graceful degradation of external widgets

The optional Ko-fi floating button widget loads a script from Ko-fi's
servers. If the widget script fails to load (due to no connectivity), it
must fail silently without errors or visual artifacts. The conditional
rendering (`{% if kofi_username %}`) already limits the widget to
configured deployments; the script tag should additionally use `async` and
handle load failure gracefully. The static Ko-fi link (a plain `<a>` tag)
always renders correctly regardless of connectivity — it simply will not
navigate until the user is back online.


## User Interface

### Page structure

The application is a single-page layout with the following views, switched via
Alpine.js:

1. **Splash screen**: Shown to first-time users. Introduces the app, explains
   how it works, and provides a "Begin" button.
2. **Welcome/resume view**: Shown to returning users with an existing session.
   Offers "Continue" or "Start from scratch."
3. **Flashcard view**: The main interaction screen. Shows one card at a time.
4. **Progress view**: Shows tier level, accuracy, and session statistics.
5. **Reference view**: A lookup table of all Hebrew letters and their values
   for the currently active gematria system.
6. **Settings view**: Gematria system, font, animation preferences, and
   session reset.
7. **About view**: Background on the app, its purpose, and the developer.
8. **Keyboard shortcuts overlay**: A dismissible overlay listing all shortcuts.

A minimal navigation bar at the top provides access to the progress view,
reference table, settings, about page, and keyboard shortcuts help. The bar
stays out of the way during card review. A Ko-fi link appears in a small
footer area, visible but unobtrusive.

### Splash screen

The splash screen is shown once to new users (no existing session data). It
contains:

- The app name and a one-sentence description of what gematria is.
- A note that the app assumes familiarity with the Hebrew alphabet — it
  teaches numerical values, not letter recognition.
- A brief explanation of how the flashcard system works: cards are shown,
  the user flips to see the answer, then rates their confidence. The system
  adapts to their level.
- A note about keyboard shortcuts (press ? at any time).
- A "Begin" button that starts the placement assessment.

The splash screen does not reappear for returning users unless they choose
"Start from scratch."

### Reference view

A table showing all 22 Hebrew letters plus 5 final forms, their names, and
their values under the currently active gematria system. For valuation methods,
values are numbers. For cipher methods, values are the paired letters. This
is accessible at any time from the navigation bar. It is a read-only lookup —
no interactivity beyond scrolling.

When the active system is Mispar Hechrachi (default), the reference view also
notes the 15/16 special cases and the convention for thousands.

### About view

The about view is accessible from the navigation bar. It contains:

- A brief explanation of the app's purpose: a free tool for practicing Hebrew
  gematria through spaced-repetition flashcards.
- A note that the app is completely free, with no accounts, no tracking, and
  no data collection (all state is stored locally in the browser).
- A short note from the developer: the app was originally built for personal
  use, and is shared in the hope that others find it useful.
- A link to the project's GitHub repository (if public).
- The Ko-fi link (if configured), presented as an optional way to say thanks.

The about view may optionally include a link to a second-level page
covering the historical context, scholarly background, and controversies
surrounding each gematria system and cipher. See "Appendix: Historical
Context of Gematria Systems" at the end of this document.

### Flashcard view layout

```
+------------------------------------------+
|  [Progress] [Ref] [Settings] [About] [?]  |
|                                          |
|                                          |
|                                          |
|                 ג                        |
|           (large, centered)              |
|                                          |
|                                          |
|          Level א  -  Card 3/27          |
|                                          |
|          [ Show Answer (Space) ]         |
|                                          |
+------------------------------------------+
```

After the user taps "Show Answer" or presses Space:

```
+------------------------------------------+
|  [Progress] [Ref] [Settings] [About] [?]  |
|                                          |
|                 ג                        |
|                                          |
|                 3                        |
|           (answer revealed)              |
|                                          |
|  [Wrong] [Unsure] [Good]  [Easy]   |
|   (1)     (2)      (3)     (4)    |
|                                          |
+------------------------------------------+
```

After the user rates the card, the transition animation plays and the next
card appears. There is no separate "next" step.

The card shows only the prompt (a Hebrew letter, a number, or a Hebrew number
string) in large centered text. No English instructions. The format is
self-evident from the active system: for valuation methods, a Hebrew letter
means "what number is this?" and a number means "what Hebrew letter(s)
represent this?"; for cipher methods, a Hebrew letter means "what is the
paired letter?"

The app uses a **self-assessment model** throughout: the user mentally
formulates their answer, flips the card to reveal the correct answer, then
honestly rates how well they did. There is no typed input or answer
validation. This keeps the interaction fast (one tap/keypress to flip, one to
rate) and avoids the complexity of Hebrew keyboard input on varied devices.

The status line ("Level א - Card 3/27") shows the card's position within the
current tier. For tiers with a fixed card set (tiers 1-4), the denominator is
the total cards in the tier. For procedurally generated tiers (tiers 5-8),
the denominator shows the number of cards introduced so far rather than a
fixed total, since new procedural cards are generated as the user progresses.

### Keyboard shortcuts

| Key   | Action                              |
|-------|-------------------------------------|
| Space | Flip card / Show answer             |
| 1     | Rate: Wrong                         |
| 2     | Rate: Unsure                        |
| 3     | Rate: Good                          |
| 4     | Rate: Easy                          |
| p     | Toggle progress view                |
| r     | Toggle reference view               |
| s     | Toggle settings view                |
| a     | Toggle about view                   |
| ?     | Toggle keyboard shortcuts overlay   |

Rating a card (1-4) also advances to the next card after the transition
animation. No separate "next" key is needed.

On mobile, the rating buttons are large tap targets at the bottom of the
screen. The "Show Answer" button spans the full width for easy tapping.

### Responsive design

- Mobile: Cards and buttons are full-width. Text sizes are large. Buttons have
  a minimum tap target of 48x48px.
- Desktop: Content is centered in a container with a maximum width of 640px.
  Keyboard shortcuts are the primary interaction method.

Tailwind CSS breakpoints handle the responsive behavior. No separate mobile
layout is needed; the same HTML adapts via utility classes.

### Right-to-left text

Hebrew is a right-to-left (RTL) script. All elements that display Hebrew text
must have `dir="rtl"` set. This includes the flashcard prompt, the answer
reveal, the reference table's Hebrew columns, and any Hebrew text in
real-world example attributions.

The overall page layout remains LTR (navigation, buttons, English labels).
Only the Hebrew text containers are RTL. Tailwind's `rtl:` variant can be
used for RTL-specific styling. Multi-letter Hebrew numbers (e.g., כ״ה)
include Unicode punctuation (geresh ׳ and gershayim ״) that must render
correctly in an RTL context — the selected Hebrew fonts should be verified
to include these characters.

### Accessibility

- **Reduced motion**: The app respects the `prefers-reduced-motion` media
  query. When the user's OS is set to reduce motion, card transition
  animations default to `none` regardless of the animation setting. The
  settings view notes this override when it is active.
- **Focus management**: When a view changes (e.g., navigating from flashcard
  to settings), keyboard focus moves to the new view's first interactive
  element. When returning to the flashcard view, focus returns to the card
  area so keyboard shortcuts work immediately.
- **ARIA labels**: Interactive elements (rating buttons, navigation links,
  the show-answer button) have descriptive `aria-label` attributes. The
  flashcard prompt area has `role="status"` so screen readers announce new
  cards.
- **Color contrast**: Text and interactive elements meet WCAG AA contrast
  ratios in both light and dark modes.
- **Focus indicators**: All keyboard-focusable elements have visible focus
  rings (Tailwind's `ring` utilities).

### Dark mode

The app supports light and dark color schemes via Tailwind's `dark:` variant.
The mode follows the user's OS preference (`prefers-color-scheme`) by default.
A toggle in the settings view allows the user to override the OS preference
with an explicit light or dark choice. The selected mode is stored in
localStorage.


## Project Structure

```
gematria-trainer/
    pyproject.toml              # Project metadata, dependencies
    justfile                    # Task automation
    .env.example                # Configuration template (KOFI_USERNAME, etc.)
    .env                        # Local config (gitignored)
    .python-version             # Python 3.13+
    src/
        build.py                # Frozen-Flask build script
        app.py                  # Flask app (for dev server and build)
        data/
            gematria.py         # Reads/validates CSV, exports JSON
            letters.csv         # Hebrew letter reference data
            examples.json       # Curated real-world gematria examples
        templates/
            base.html           # Base Jinja2 template (Tailwind, Alpine.js)
            index.html          # Single-page app template
            components/
                splash.html     # First-time user introduction
                welcome.html    # Returning user resume/reset prompt
                flashcard.html  # Flashcard component
                progress.html   # Progress/tier view
                reference.html  # Letter/number lookup table
                settings.html   # Gematria system, font, animation, session settings
                about.html      # About the app and developer
                shortcuts.html  # Keyboard shortcuts overlay
    static/
        sw.js                   # Service worker for offline caching
        js/
            app.js              # Alpine.js application logic
            spaced-repetition.js # SM-2 algorithm implementation
            gematria.js         # Gematria systems: encoding/decoding, ciphers
            session.js          # localStorage/cookie session management
            generator.js        # Procedural card generation for higher tiers
            settings.js         # Settings state and transition animation logic
            vendor/             # Locally bundled third-party JS (gitignored, downloaded during setup)
        css/
            input.css           # Tailwind input file (@font-face declarations)
        fonts/
            LICENSE             # Font license file(s)
            *.woff2             # Hebrew web fonts (standard, sans-serif, Rashi)
        dist/                   # Built CSS output (gitignored)
    tests/
        test_gematria.py        # Tests for gematria data and CSV correctness
        test_build.py           # Tests for build process
        test_examples.py        # Tests for real-world example data
        js/                     # JavaScript tests (if needed)
    docs/                       # mkdocs documentation source
        index.md
    build/                      # Frozen-Flask output (gitignored)
    .github/
        workflows/
            deploy.yml          # CD workflow: build and deploy to GitHub Pages
```


## Build Pipeline

The build process generates a static site from the Flask app. The steps
must run in this order:

1. **Tailwind CSS**: Compile `static/css/input.css` to
   `static/dist/output.css` using the Tailwind standalone CLI. The
   standalone CLI is a single binary that does not require Node.js — it is
   downloaded during project setup (gitignored) and fetched separately in
   CI. This avoids adding Node.js as a build dependency for a Python
   project.
2. **Frozen-Flask**: `uv run python src/build.py` runs Frozen-Flask, which:
   - Starts the Flask app.
   - Reads configuration from `.env` (including `KOFI_USERNAME`).
   - Requests all routes and saves the rendered HTML to `build/`.
   - Copies `static/` (including the compiled CSS and fonts) to
     `build/static/`.
3. The `build/` directory contains the complete static site, ready for
   deployment.

Tailwind must run before Frozen-Flask so that the compiled CSS file exists
when Frozen-Flask copies static assets into the build output.

The justfile provides shortcuts:

```
setup       # Download Tailwind CLI and vendor JS (Alpine.js, Chart.js)
build       # Run full build pipeline (setup + css + freeze)
dev         # Start Flask dev server with auto-reload
css         # Compile Tailwind CSS in watch mode
test        # Run pytest
lint        # Run ruff check
format      # Run ruff format
```


## GitHub Actions Deployment

The CD workflow (`.github/workflows/deploy.yml`):

1. Trigger: push to `main` branch.
2. Set up Python 3.13 and uv.
3. Install dependencies via `uv sync`.
4. Set environment variables from GitHub secrets and variables:
   ```yaml
   env:
     KOFI_USERNAME: ${{ secrets.KOFI_USERNAME }}
     GITHUB_REPO_URL: ${{ vars.GITHUB_REPO_URL }}
   ```
5. Run `just build` (which runs `just setup` to download the Tailwind CLI
   and vendor JS, compiles CSS, then freezes the Flask app).
6. Deploy `build/` to GitHub Pages using `actions/deploy-pages`.

### Required GitHub configuration

- **Repository secret** `KOFI_USERNAME`: Set in the repo's Settings > Secrets
  and variables > Actions. Contains the Ko-fi page slug. If unset, the build
  succeeds but the Ko-fi link is omitted from the generated pages.
- **Repository variable** `GITHUB_REPO_URL`: Set in the repo's Settings >
  Secrets and variables > Actions > Variables tab. Contains the public repo
  URL for the About page. If unset, the GitHub link is omitted.
- **GitHub Pages source**: Set to "GitHub Actions" in Settings > Pages.


## Testing Strategy

**Python tests** (pytest):

- Verify gematria letter-to-number and number-to-letter mappings are correct
  for all valuation methods (Hechrachi, Gadol, Katan, Siduri).
- Verify cipher mappings are correct and symmetric where expected (Atbash and
  Albam are symmetric; Avgad is not).
- Verify number encoding handles the 15/16 special cases (ט״ו / ט״ז).
- Verify Hebrew year conversion is correct for a range of known years.
- Verify the build process generates expected output files.
- Verify `letters.csv` is well-formed and consistent with the expected schema.
- Verify `examples.json` entries are well-formed and their gematria values are
  correct.

**JavaScript tests** (if complexity warrants it):

- Verify the SM-2 algorithm produces correct intervals and ease factors.
- Verify card selection logic (overdue prioritization, new card introduction).
- Verify tier progression and placement assessment logic.
- Verify procedural generation produces valid gematria conversions.
- Verify all gematria system functions match the Python reference
  implementations.

For JavaScript testing, a lightweight framework such as Vitest or plain Node.js
assertions can be used. This is optional for the initial implementation and can
be added as the JS codebase grows.


## Implementation Phases

Phases are numbered in suggested implementation order. Dependencies between
phases are noted explicitly — where no dependency exists, phases can be
worked in parallel.

### Phase 1: Project scaffolding

*No dependencies. This phase must be completed before any other phase.*

- Create `pyproject.toml` with dependencies (flask, frozen-flask,
  python-dotenv, structlog, ruff, pytest).
- Create `justfile` with setup, dev, build, test, lint, format tasks.
  The `setup` task downloads the Tailwind standalone CLI binary and vendor
  JS libraries. The `build` task runs `setup` as a prerequisite.
- Create `.env.example` with `KOFI_USERNAME=` and `GITHUB_REPO_URL=`
  placeholders.
- Create `.gitignore` with at minimum:
  - `.env` (local configuration with secrets)
  - `build/` (Frozen-Flask output)
  - `static/dist/` (compiled Tailwind CSS output)
  - `static/js/vendor/` (locally bundled third-party JS libraries — Alpine.js,
    Chart.js, etc. These are downloaded during setup, not committed to the repo)
  - The Tailwind standalone CLI binary
  - `__pycache__/` and `*.pyc`
  - `.venv/` (uv virtual environment)
  - `.pytest_cache/`
  - `.ruff_cache/`
- Set up Flask app with a single index route.
- Set up base HTML template with meta tags (title, description, Open Graph),
  favicon, `dir="rtl"` on Hebrew text containers, and Tailwind's `dark:`
  class strategy.
- Bundle Alpine.js and Chart.js locally in `static/js/vendor/` rather than
  loading from CDNs, so the app works fully offline after initial page load.
  The `just setup` task handles downloading these.
- Set up Tailwind CSS compilation using the standalone CLI.
- Source and add Hebrew web fonts (Noto Serif Hebrew, Noto Sans Hebrew,
  Noto Rashi Hebrew) to `static/fonts/`. Add `@font-face` declarations to
  the Tailwind input CSS. Include font license files. Verify that each font
  includes geresh (׳) and gershayim (״) characters.
- Verify Frozen-Flask produces a working static build with correct build
  order (Tailwind first, then Frozen-Flask).

### Phase 2: Gematria data and core logic

*Depends on: Phase 1.*

- Create `src/data/letters.csv` with the full letter table (letter, name,
  position, standard value, final form, final value).
- Implement `src/data/gematria.py` to read/validate the CSV and export JSON.
- Curate `src/data/examples.json` with real-world gematria examples.
- Write pytest tests for data correctness.
- Implement `static/js/gematria.js` with:
  - Standard encoding/decoding (Mispar Hechrachi).
  - Valuation functions for Mispar Gadol, Mispar Katan, and Mispar Siduri.
  - Cipher functions for Atbash, Albam, and Avgad.
  - A system registry that maps system names to their functions.
- Write tests verifying each system produces correct mappings for all letters.

### Phase 3: Spaced repetition engine

*Depends on: Phase 2 (needs gematria data model and system registry).*

- Implement `static/js/spaced-repetition.js` with SM-2 algorithm.
- Implement card state management (localStorage), namespaced per gematria
  system so each system tracks progress independently.
- Implement card selection logic (overdue, new card, tier advancement).
- Implement tier definitions and mastery criteria: 8-tier structure for
  Hechrachi and Gadol, 4-tier structure for Katan and Siduri, and 3-tier
  structure for cipher methods (see "Reduced tier structures").

### Phase 4: Flashcard UI and card transitions

*Depends on: Phase 3 (needs spaced repetition engine and tier definitions).*

Phase 1 creates the minimal base HTML template (meta tags, font loading,
dark mode class strategy). This phase builds out the flashcard UI within
that template.

- Implement the flashcard view with Alpine.js (card display, flip, rating).
- Implement the card transition flow: rating triggers animation then auto-
  advances to next card.
- Implement the transition animation presets (fade, slide-left, none) as CSS
  transitions driven by Alpine.js. Respect `prefers-reduced-motion`.
- Implement keyboard shortcuts.
- Implement the keyboard shortcuts help overlay.
- Implement responsive layout for mobile and desktop.
- Add ARIA labels, focus management (focus returns to card area after view
  switches), and visible focus indicators.
- Handle card state preservation when navigating away mid-card.

### Phase 5: Supporting views, settings, and session management

*Depends on: Phase 4 (needs working flashcard view and view-switching
infrastructure). The sub-groups below are largely independent of each
other and can be worked in parallel.*

**5a. Session management (`session.js`)**:
- Implement cookie-based session detection with localStorage fallback
  check. Handle localStorage unavailability (private browsing) with a
  graceful degradation notice.
- Implement the page-load flow: check cookie, check localStorage, route
  to the appropriate view (see "Session and State Management").

**5b. Settings view and settings state (`settings.js`)**:
- Implement `static/js/settings.js` for settings state in localStorage.
- Implement the settings view with gematria system selector, font selection
  (with per-font Hebrew letter preview), animation style, duration, and
  session reset controls.
- Wire font selection to apply the chosen `@font-face` family to all
  Hebrew text via a CSS class on the container element. Wire gematria
  system selection to load the appropriate progress state and update the
  reference view.

**5c. Splash screen and welcome/resume views**:
- Implement the splash screen for first-time users (including prerequisite
  note about Hebrew alphabet familiarity).
- Implement the welcome/resume view with "Continue" and "Start from
  scratch" options.

**5d. Reference and about views**:
- Implement the reference view (letter/value lookup table), dynamically
  showing values for the currently active gematria system.
- Implement the about view (app purpose, free/no-tracking note, developer
  note, GitHub link, Ko-fi link).

**5e. Placement assessment**:
- Implement the placement assessment sequence: 8-tier version for Hechrachi
  and Gadol, 4-tier version for Katan and Siduri, 3-tier version for cipher
  methods (see "Initial assessment for returning/experienced users").
- This depends on 5a (session management) and 5c (splash/welcome views)
  to determine when the assessment runs.

### Phase 6: Progress display

*Depends on: Phase 3 (needs tier and card state data). Independent of
Phases 4 and 5 — can be worked in parallel with either.*

- Implement tier-level display using gematria letters.
- Build the progress view (tier letter, accuracy, progress bar).
- Add a session statistics visualization using Chart.js (bundled in
  `static/js/vendor/` during Phase 1 setup).

### Phase 7: Procedural generation and real-world examples

*Depends on: Phase 2 (gematria encoding/decoding logic) and Phase 3
(spaced repetition card model). Independent of Phases 4-6.*

- Implement `static/js/generator.js` for procedural card generation.
- Implement seeded random number generation for session-consistent cards.
- Add random compound numbers (11-99) for Tier 5, ensuring the 15/16
  special cases are included in the initial batch.
- Add random compound numbers (100-999) for Tier 6.
- Add random Hebrew calendar year cards for Tier 7.
- Add random large numbers for Tier 7.
- Integrate curated real-world examples into Tier 8 alongside procedural cards.

### Phase 8: Ko-fi, offline support, polish, and deployment

*Depends on: All prior phases. This is the integration and polish phase.*

- Add Ko-fi link to the base template, conditional on `KOFI_USERNAME`.
  Ensure the optional Ko-fi widget script loads with `async` and fails
  silently when offline.
- Wire up `KOFI_USERNAME` from `.env` through Flask template context.
- Implement the service worker (`static/sw.js`) with a cache-first
  strategy covering the HTML page, all JS files, compiled CSS, and font
  files. Register the service worker from the base HTML template.
- Test the full user flow end-to-end, including offline operation (load the
  page, disable network, verify all card interactions continue to work).
- Tune mastery thresholds and SM-2 parameters based on manual testing.
- Experiment with animation presets and durations to find good defaults.
- Create the GitHub Actions CD workflow with `KOFI_USERNAME` secret.
- Test deployment to GitHub Pages.
- Verify the application works correctly when served as static files.


## Appendix: Historical Context of Gematria Systems

Note: The historical summary below was written by an AI agent. It is
presented with no warranty of accuracy and should be independently
verified for correctness.

The following notes document the historical background and scholarly context
for each gematria system and cipher included in the app. This material may
optionally be presented as a second-level about page ("About the systems")
linked from the main about view, or it may remain internal reference only.

**Mispar Hechrachi (Standard)**

The standard system is rooted in the Hebrew numeral system itself — Hebrew
(like Greek and Aramaic) used its alphabet as numerals. The letter-number
equivalences are not an invention of mystics; they are how numbers were
written in Hebrew from antiquity. The earliest interpretive use of these
values (drawing connections between words with the same numerical total)
appears in Tannaitic sources (1st-2nd centuries CE). The word "gematria"
is almost certainly derived from Greek "geometria," indicating
Greco-Roman cultural contact; Saul Lieberman argued the technique was
influenced by Greek isopsephy (the Greek equivalent practice).[^1]

Notable Talmudic examples: the 318 servants of Abraham (Genesis 14:14)
equated with Eliezer (אליעזר = 318) in Nedarim 32a[^2]; the value of
Torah (תורה = 611) tied to the 611 commandments given through Moses in
Makkot 23b-24a[^3]. The Baraita of the Thirty-Two Rules (attributed to
R. Eliezer ben Yose ha-Gelili, 2nd century CE) lists gematria as rule 29
of 32 rules for interpreting the Torah.[^4]

The Talmud itself treats gematria with some reserve — it is generally
considered an asmakhta (mnemonic support or homiletical device) rather
than a basis for binding legal rulings.[^5]

**Mispar Gadol (Final-form values 500-900)**

This system extends the standard values by assigning the five final-form
letters values 500 through 900. This is one of the more debated aspects
of gematria. In the actual historical record (coins, inscriptions, Dead
Sea Scrolls), numbers above 400 were written using combinations of
standard letters (e.g., 500 = תק, i.e., 400 + 100), not by using final
letter forms as numerals. Most scholars of Hebrew paleography consider
the 500-900 sofit values a secondary development, likely medieval in
origin, associated with kabbalistic tradition rather than the historical
numeral system.[^6] Some kabbalistic texts do use these values, and the
system has been in use for centuries — but it should not be conflated with
the historically primary standard system.

**Mispar Katan (Reduced)**

Each letter's standard value is reduced to a single digit by dropping
zeros (ק = 100 → 1, ר = 200 → 2). This system does not appear in the
Talmud or early Midrash as an identified method. It is primarily
associated with medieval kabbalistic traditions, particularly the Hasidei
Ashkenaz (German Jewish pietists, 12th-13th centuries) and later
kabbalistic literature.[^7] It is a natural mathematical derivative of
the standard system and has been in established use for centuries, but it
is not as historically primary as Mispar Hechrachi.

**Mispar Siduri (Ordinal)**

Letters are simply numbered by position in the alphabet (א=1, ב=2, ...
ת=22), ignoring the traditional decimal-system values. Like Mispar Katan,
this system appears in medieval kabbalistic works and does not have clear
Talmudic or biblical attestation.[^6] The standard system's values (1-9,
10-90, 100-400) reflect the actual historical Hebrew numeral system,
whereas the ordinal system is an abstraction.

**Atbash (Mirror cipher)**

Atbash has the strongest historical credentials among the ciphers, with
plausible attestation in the Hebrew Bible itself. In Jeremiah 25:26 and
51:41, the word "Sheshach" (ששך) decodes via Atbash to "Babel" (בבל) —
this reading is noted in the JPS translation footnotes and by classical
commentators including Rashi.[^8] In Jeremiah 51:1, "Lev Kamai" (לב קמי)
similarly decodes via Atbash to "Kasdim" (כשדים, Chaldeans).[^9] The
Babylonian Talmud discusses Atbash as a systematic cipher in Sanhedrin
22a, in the context of Belshazzar's wall (Daniel 5).[^10] Scholars
debate whether the Atbash encoding in Jeremiah was the original authorial
intent or a later interpretive overlay, but the identification is widely
(though not universally) accepted in biblical scholarship.[^11] Atbash
also features in the kabbalistic tradition of tzeruf otiyot (letter
permutation), particularly in the works of Abraham Abulafia (13th
century).[^12]

**Albam (Half-split cipher)**

Albam is attested in rabbinic and kabbalistic literature but does not
have the biblical attestation that Atbash does. It appears in lists of
cipher methods in medieval kabbalistic texts and is part of a family of
systematic letter-substitution ciphers grouped under tzeruf.[^12] It is
generally regarded by scholars as a medieval development in its
systematized form.

**Avgad (Shift cipher)**

Avgad has the least independent attestation of the three ciphers. It is
mentioned in kabbalistic lists of cipher methods and is part of the
broader tzeruf tradition, but scholars do not typically regard it as
having demonstrably ancient roots in the way Atbash arguably does.[^6]

**Broader context and controversies**

*Scholarly consensus on authenticity.* There is a rough hierarchy of
historical attestation: (1) Standard gematria (Hechrachi) is the most
historically grounded, being the Hebrew numeral system used
hermeneutically; (2) Atbash has plausible biblical attestation; (3) the
remaining systems (Gadol, Katan, Siduri, Albam, Avgad) are medieval
kabbalistic developments. No mainstream scholar considers all systems
equally ancient.[^6] Within kabbalistic tradition, however, practitioners
may regard all systems as legitimate tools of interpretation.

*Denominational views.* Orthodox Judaism generally accepts gematria as a
supplementary (not primary) tool of Torah interpretation, with particular
prominence in Hasidic communities and notable use by the Vilna Gaon (18th
century).[^13] Maimonides and the rationalist tradition were generally
skeptical. Conservative and Reform Judaism tend to treat gematria as a
cultural and literary curiosity. Academic scholars (Gershom Scholem,
Moshe Idel) study it as a historical phenomenon within Jewish
mysticism.[^6][^12]

*Numerological abuse.* With multiple systems available, virtually any
word can be made to "equal" any other word by choosing the right system.
This makes multi-system gematria unfalsifiable and is a standard
scholarly critique.[^5] In contemporary popular culture, gematria has been
co-opted by conspiracy theorists using arbitrary English-alphabet systems
with no basis in Jewish tradition. The app should be careful not to
encourage this conflation.

*Teaching considerations.* Gematria is a well-documented historical
practice with no tradition of secrecy. Teaching it to a general audience
is straightforward as long as the historical context is honest — clearly
distinguishing what is historically attested from what is traditional
attribution, and noting that the systems differ in historical depth.


### References

Note: The references below were compiled by an AI agent. They are
presented with no warranty of accuracy and should be independently
verified for correctness.

[^1]: Saul Lieberman, *Hellenism in Jewish Palestine: Studies in the
    Literary Transmission, Beliefs and Manners of Palestine in the I
    Century B.C.E. - IV Century C.E.* (New York: Jewish Theological
    Seminary of America, 1950; 2nd ed. 1962). Argues that Hellenistic
    culture influenced rabbinic hermeneutical methods, including the
    relationship between gematria and Greek isopsephy. Available on
    Internet Archive:
    https://archive.org/details/hellenisminjewis0000lieb

[^2]: Babylonian Talmud, Nedarim 32a. Rabbi Ami bar Abba explains that
    the numerical value of Eliezer's name (אליעזר) equals 318,
    connecting it to the 318 men Abraham took to war in Genesis 14:14.
    https://www.sefaria.org/Nedarim.32a

[^3]: Babylonian Talmud, Makkot 23b-24a. Rav Hamnuna teaches that the
    gematria of Torah (תורה) is 611, representing the commandments
    transmitted through Moses, with 2 additional commandments heard
    directly from God, totaling 613.
    https://www.sefaria.org/Makkot.23b /
    https://www.sefaria.org/Makkot.24a

[^4]: The Baraita of the Thirty-Two Rules, attributed to R. Eliezer ben
    Yose ha-Gelili (2nd century CE). Gematria is listed as rule 29.
    The attribution is traditional; scholars date the text to a later
    period. See the Jewish Encyclopedia article "Rules of Eliezer b.
    Jose ha-Gelili, the Thirty-Two":
    https://www.jewishencyclopedia.com/articles/12935-rules-of-eliezer-b-jose-ha-gelili-the-thirty-two

[^5]: Jewish Encyclopedia (1901-1906), "Gematria," by Solomon Schechter
    and Caspar Levias. Covers biblical, Talmudic, and kabbalistic use
    of gematria, including 18 distinct methods of computing numerical
    values. Notes that scholars outside kabbalistic circles, such as
    Ibn Ezra and Leo di Modena, viewed gematria "more or less
    derogatorily" as merely a mnemonic device.
    https://www.jewishencyclopedia.com/articles/6571-gematria

[^6]: Gershom Scholem, *Kabbalah* (Jerusalem: Keter, 1974; reprinted
    New York: Meridian/Penguin, 1978). Contains a section on gematria
    methods and their role in kabbalistic thought, including historical
    development and typology. Originated as Scholem's articles for the
    *Encyclopaedia Judaica* (1971). See also: Jewish Virtual Library,
    "Gematria" (drawing on Encyclopaedia Judaica material):
    https://www.jewishvirtuallibrary.org/gematria-2

[^7]: Gershom Scholem, *Major Trends in Jewish Mysticism* (1941),
    Chapter 3, "Hasidism in Mediaeval Germany." The Hasidei Ashkenaz
    (12th-13th century Rhineland) used gematria extensively in prayer
    analysis, including reduced/small gematria. See also: Joseph Dan,
    *The Esoteric Theology of Ashkenazi Hasidism* (Jerusalem, 1968);
    Ivan G. Marcus, *Piety and Society: The Jewish Pietists of Medieval
    Germany* (Leiden: Brill, 1981).

[^8]: Jeremiah 25:26 — "and the king of Sheshach shall drink after
    them." The JPS translation footnote reads: "Sheshach — A cipher for
    Babel 'Babylon.'" The Atbash substitution maps ש-ש-כ to ב-ב-ל.
    https://www.sefaria.org/Jeremiah.25.26
    See also: Jeremiah 51:41 —
    https://www.sefaria.org/Jeremiah.51.41

[^9]: Jeremiah 51:1 — "Lev Kamai." The JPS translation footnote reads:
    "Leb-kamai — A cipher for Kasdim 'Chaldea.'" The Atbash
    substitution maps לב קמי to כשדים (Chaldeans).
    https://www.sefaria.org/Jeremiah.51.1

[^10]: Babylonian Talmud, Sanhedrin 22a. Discusses the Atbash cipher as
    a systematic letter-substitution method in the context of decoding
    the writing on Belshazzar's wall (Daniel 5).
    https://www.sefaria.org/Sanhedrin.22a

[^11]: Wikipedia, "Atbash." Overview of the cipher, its biblical
    attestations in Jeremiah, and Talmudic references.
    https://en.wikipedia.org/wiki/Atbash

[^12]: Moshe Idel, *Language, Torah, and Hermeneutics in Abraham
    Abulafia* (Albany: SUNY Press, 1989). Studies Abulafia's
    hermeneutical system, his "hokhmat ha-tzeruf" (science of letter
    combination), and the role of letter permutation techniques
    including Atbash, Albam, Avgad, and related ciphers.
    See also: Moshe Idel, *The Mystical Experience in Abraham Abulafia*
    (Albany: SUNY Press, 1988). On the ecstatic-kabbalistic use of
    letter permutation as a meditative and mystical technique.

[^13]: The Vilna Gaon (R. Eliyahu of Vilna, 1720-1797) used gematria
    extensively in his commentaries, including his commentary on Sefer
    Yetzirah (available on Sefaria:
    https://www.sefaria.org/Sefer_Yetzirah_Gra_Version) and *Aderet
    Eliyahu* (commentary on the Pentateuch). His use of gematria is
    notable because he was otherwise a rationalist and a critic of
    Hasidism. See also: Sefer Yetzirah (Book of Formation), an early
    Jewish mystical text on the creative power of Hebrew letters:
    https://www.sefaria.org/Sefer_Yetzirah.1

For a general overview of gematria, see also: Wikipedia, "Gematria":
https://en.wikipedia.org/wiki/Gematria
