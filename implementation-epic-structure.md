# Epic and Task Structure

This document defines the epics, sub-epics, tasks, and sub-tasks for
implementing the Gematria Trainer application. It maps directly to the
Implementation Phases in `implementation-plan.md` and is the blueprint for
creating beads issues.

## Conventions

- **Epic**: A high-level work unit corresponding to an implementation phase.
  Type `epic`, priority P2 unless noted.
- **Sub-epic**: A logical grouping within an epic. Type `epic`.
- **Task**: A concrete, implementable unit of work. Type `task` or `feature`.
- **Sub-task**: A narrowly scoped piece of a task, used when a task is too
  large to implement in one step. Type `task`.
- **Review gate**: A code review checkpoint between epics. Type `task`.
  Reviews block the next phase from starting. Issues found during a review
  become new beads with the review as a dependency -- the review cannot
  close until all its child issues are resolved.

Dependencies are noted with `blocks` and `blocked-by` relationships.
"E1", "E2", etc. refer to epics by number. "T1.3" means task 3 within
epic 1. All dependency arrows point from blocker to blocked (i.e.,
"E1 blocks E2" means E2 cannot start until E1 is done).

---

## Dependency Overview

```
E1 (Scaffolding)
 |
 v
R1 (Foundation Review)
 |
 v
E2 (Gematria Data & Logic)
 |
 v
E3 (Spaced Repetition Engine)
 |
 v
R2 (Core Logic Review)
 |         |              |
 |         v              v
 |     E6 (Progress)   E7 (Procedural Gen; also needs E2)
 v
E4 (Flashcard UI)
 |
 v
R3 (UI Architecture Review)
 |
 v
E5 (Views, Settings, Session)
 |
 v
E8 (Ko-fi, Offline, Polish, Deploy)
     also blocked by E6, E7
 |
 v
R4 (Final Review)
```

Notes on parallelism:
- E6 depends on R2 (not E4). It can be worked in parallel with E4 and E5.
- E7 depends on E2 and R2. It can be worked in parallel with E4, E5,
  and E6.
- E8 depends on all of E1-E7 and R3.
- Within E5, sub-epics E5a (session state) and E5b (settings state) are
  pure state/storage modules. They could in principle begin before E4 is
  complete, though their UI integration requires E4's view infrastructure.

Notes on review gates:
- Review gates are quality checkpoints, not rubber stamps. Each review
  examines the code produced by the preceding epic(s) for coherence,
  convention adherence, and maintainability.
- When a review identifies issues, each issue is created as a new bead
  (type `task` or `bug`) that blocks the review gate. The review gate
  cannot close until all its child issues are resolved.
- R1, R2, R3 are targeted reviews focused on specific concerns (listed
  below). R4 is a comprehensive review of the full codebase.

---

## E1: Project Scaffolding

*No dependencies. All other epics depend on this.*

This epic establishes the project skeleton: Python environment, Flask app,
Tailwind CSS pipeline, Hebrew fonts, vendor JS, Frozen-Flask build, and
the justfile task runner.

### Sub-epic E1a: Python project and tooling

| ID   | Title                                      | Type | Notes |
|------|--------------------------------------------|------|-------|
| T1.1 | Create project config files                | task | pyproject.toml (flask, frozen-flask, python-dotenv, structlog, ruff, pytest), .python-version (3.13+), .gitignore (.env, build/, static/dist/, static/js/vendor/, tailwind binary, \_\_pycache\_\_/, .venv/, .pytest_cache/, .ruff_cache/), .env.example (KOFI_USERNAME=, GITHUB_REPO_URL= placeholders) |
| T1.2 | Create justfile with task definitions      | task | Task stubs for setup, dev, build, css, test, lint, format. The `setup` task orchestrates Tailwind CLI and vendor JS downloads (implemented in T1.7 and T1.11). The `build` task runs `setup` as a prerequisite. |

### Sub-epic E1b: Flask application and templates

| ID   | Title                                      | Type | Notes |
|------|--------------------------------------------|------|-------|
| T1.3 | Create src/app.py with index route         | task | Flask app, reads .env via python-dotenv, passes KOFI_USERNAME and GITHUB_REPO_URL to template context (Ko-fi link renders conditionally in the template; see E8a). |
| T1.4 | Create base.html template                  | task | Meta tags (title, description, Open Graph), favicon, Tailwind dark: class strategy, script tags for vendor JS, `dir="rtl"` on Hebrew text containers |
| T1.5 | Create index.html template                 | task | Extends base.html, placeholder content for Alpine.js views |
| T1.6 | Create empty component template stubs      | task | splash.html, welcome.html, flashcard.html, progress.html, reference.html, settings.html, about.html, shortcuts.html. Minimal placeholder content only. |

### Sub-epic E1c: Tailwind CSS and fonts

| ID    | Title                                       | Type | Notes |
|-------|---------------------------------------------|------|-------|
| T1.7  | Set up Tailwind standalone CLI download     | task | Download platform-appropriate binary in `just setup`. Gitignored. |
| T1.8  | Create static/css/input.css                 | task | Tailwind directives, @font-face declarations for 3 Hebrew fonts |
| T1.9  | Source and add Hebrew web fonts             | task | Noto Serif Hebrew, Noto Sans Hebrew, Noto Rashi Hebrew in WOFF2. Include LICENSE files in static/fonts/. Verify geresh (׳) and gershayim (״) characters render correctly in each font. |
| T1.10 | Wire Tailwind compilation into justfile     | task | `just css` for watch mode, `just build` runs one-shot compilation. Output to static/dist/output.css. |

### Sub-epic E1d: Vendor JS and Frozen-Flask build

| ID    | Title                                           | Type | Notes |
|-------|-------------------------------------------------|------|-------|
| T1.11 | Set up vendor JS download in `just setup`       | task | Download Alpine.js and Chart.js to static/js/vendor/. Gitignored. |
| T1.12 | Create src/build.py (Frozen-Flask build script)  | task | Runs Frozen-Flask, outputs to build/ |
| T1.13 | Write build process tests (test_build.py)       | task | Pytest tests verifying the build generates expected output files in build/ |
| T1.14 | Verify full build pipeline end-to-end           | task | `just build` runs setup, compiles CSS, then freezes. Confirm build/ contains working static site with correct asset paths. |

### Dependencies within E1

- T1.3 blocked-by T1.1 (needs dependencies installed)
- T1.4 blocked-by T1.8, T1.9 (needs CSS input file and fonts)
- T1.5 blocked-by T1.4
- T1.6 blocked-by T1.4
- T1.10 blocked-by T1.7, T1.8
- T1.12 blocked-by T1.3, T1.5
- T1.13 blocked-by T1.12
- T1.14 blocked-by T1.10, T1.11, T1.12

---

## R1: Foundation Review

*Blocked by: E1. Blocks: E2.*

Review the project scaffolding before building domain logic on top of it.
Issues found during this review become new beads that block R1; the review
cannot close until all issues are resolved.

| ID   | Title                                      | Type | Notes |
|------|--------------------------------------------|------|-------|
| TR.1 | Foundation code review                     | task | Review all E1 output. Focus areas listed below. |

**Review focus**:
- Project structure: directory layout, file naming, module organization
- Build pipeline: `just setup`, `just build`, `just css` all work correctly
- Flask app structure: app factory pattern (if used), template inheritance
- Tailwind configuration: input.css structure, font-face declarations
- Justfile: task naming, dependency chains, idempotency
- Gitignore: completeness for generated/downloaded artifacts
- Template hierarchy: base.html conventions, block naming, asset paths
- Test structure: pytest configuration, test file organization

---

## E2: Gematria Data and Core Logic

*Blocked by: R1. Blocks: E3, E7.*

This epic builds the domain data layer (CSV, JSON, Python validation) and
the client-side gematria logic (all valuation and cipher systems).

### Sub-epic E2a: Reference data and Python module

| ID   | Title                                           | Type | Notes |
|------|-------------------------------------------------|------|-------|
| T2.1 | Create src/data/letters.csv                     | task | 22 letters + 5 final forms. Columns: letter, name, position, standard_value, final_form, final_value |
| T2.2 | Implement src/data/gematria.py                  | task | Read/validate CSV, export as JSON for embedding in HTML. Structlog for logging. |
| T2.3 | Wire gematria data into Flask template context  | task | Build-time: read CSV via gematria.py, embed as JSON in generated HTML |
| T2.4 | Curate src/data/examples.json                   | task | Real-world gematria examples with Hebrew text, value, attribution, system tag (most apply to Mispar Hechrachi; some may be system-specific). Start with 15-20 entries. |

### Sub-epic E2b: Client-side gematria systems (gematria.js)

| ID    | Title                                            | Type    | Notes |
|-------|--------------------------------------------------|---------|-------|
| T2.5  | Implement Mispar Hechrachi letter-to-number      | feature | Standard valuation: each letter maps to its numerical value (1-400). |
| T2.6  | Implement Mispar Hechrachi number-to-Hebrew-string encoding | feature | Decompose a number into Hebrew letter representation. Handle 15/16 special cases (ט״ו and ט״ז, not י״ה and י״ו). Add geresh (׳) for single-letter numbers, gershayim (״) before last letter for multi-letter numbers. Handle thousands convention (omit thousands digit for Hebrew years). |
| T2.7  | Implement Mispar Gadol valuation                 | feature | Same as Hechrachi but final forms use 500-900 values (ך=500, ם=600, ן=700, ף=800, ץ=900). Non-final letters unchanged. |
| T2.8  | Implement Mispar Katan valuation                 | feature | Reduced single-digit values: drop zeros (e.g. י=1, כ=2, ק=1, ר=2) |
| T2.9  | Implement Mispar Siduri valuation                | feature | Ordinal values 1-22 by alphabet position |
| T2.10 | Implement Atbash cipher                          | feature | Mirror substitution. Symmetric (א↔ת, ב↔ש, etc.). |
| T2.11 | Implement Albam cipher                           | feature | Half-split substitution. Symmetric (א↔ל, ב↔מ, etc.). |
| T2.12 | Implement Avgad cipher                           | feature | Shift cipher. Asymmetric: forward (א→ב, ב→ג, ..., ת→א) and reverse must both be supported. |
| T2.13 | Implement system registry                        | task    | Map system names to their valuation/cipher functions. Single entry point for the rest of the app. |

### Sub-epic E2c: Data correctness tests

| ID    | Title                                            | Type | Notes |
|-------|--------------------------------------------------|------|-------|
| T2.14 | Write tests for letters.csv schema and values    | task | Verify well-formed CSV, correct standard values for all 22 letters + 5 finals |
| T2.15 | Write tests for gematria.py validation/export    | task | Round-trip: CSV -> Python -> JSON -> verify structure |
| T2.16 | Write tests for examples.json correctness        | task | Each example's stated value matches computed gematria for the tagged system |
| T2.17 | Write tests for all valuation systems            | task | All 4 valuation methods produce correct values for every letter |
| T2.18 | Write tests for all cipher systems               | task | All 3 ciphers produce correct mappings. Verify Atbash/Albam symmetry (f(f(x))=x). Verify Avgad forward/reverse are inverses. |
| T2.19 | Write tests for number encoding edge cases       | task | 15/16 special cases, multi-letter numbers, large numbers, Hebrew year encoding with thousands omission |

### Dependencies within E2

- T2.2 blocked-by T2.1
- T2.3 blocked-by T2.2
- T2.5 through T2.13 can be worked in parallel (independent of each other)
- T2.5 through T2.13 all blocked-by T2.1 (need letter data as reference)
- T2.6 blocked-by T2.5 (encoding builds on the letter-to-number mapping)
- T2.14 blocked-by T2.1, T2.2
- T2.15 blocked-by T2.2
- T2.16 blocked-by T2.4, T2.5
- T2.17 blocked-by T2.5, T2.7, T2.8, T2.9
- T2.18 blocked-by T2.10, T2.11, T2.12
- T2.19 blocked-by T2.6

---

## E3: Spaced Repetition Engine

*Blocked by: E2. Blocks: E4, E6, E7.*

This epic implements the SM-2 algorithm, card state management with
per-system localStorage namespacing, card selection logic, and tier
definitions for all system types.

| ID   | Title                                            | Type    | Notes |
|------|--------------------------------------------------|---------|-------|
| T3.1 | Implement SM-2 algorithm (spaced-repetition.js)  | feature | 4 user-facing rating buttons map to SM-2 quality values: Wrong→q=1, Unsure→q=3, Good→q=4, Easy→q=5. Ease factor, interval in minutes, next_review timestamp. EF adjustment formula: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02)), minimum 1.3. |
| T3.2 | Implement card state model                       | task    | Card state object: card_id, ease_factor, interval_minutes, repetitions, next_review, last_quality |
| T3.3 | Implement localStorage persistence per system    | task    | Namespaced keys (e.g. progress_hechrachi, progress_atbash). Read/write full card state arrays. |
| T3.4 | Implement card selection logic                   | feature | Priority: most overdue card first, then new card from current tier, then tier advancement check |
| T3.5 | Define 8-tier structure (Hechrachi, Gadol)        | task    | Tier content and mastery criteria as specified in the plan. Note: Tier 4 content differs between Hechrachi (final forms have same values as non-final) and Gadol (final forms have distinct 500-900 values). |
| T3.6 | Define 4-tier structure (Katan, Siduri)           | task    | Reduced tier content and mastery criteria. Katan has multiple letters per value (separate cards for each). |
| T3.7 | Define 3-tier structure (ciphers)                 | task    | Cipher tier content and mastery criteria. Tier 3 "both directions" is trivial for symmetric ciphers (Atbash, Albam) but meaningful for Avgad (forward and reverse). |
| T3.8 | Implement tier mastery evaluation                | task    | 80% accuracy and 3+ reps per card in tier. Check all cards in current tier. |
| T3.9 | Implement tier advancement logic                 | task    | When mastery is met and current tier exhausted, advance to next tier. Handle completion state (all tiers mastered -> review mode: draw from all tiers via spaced repetition). |

### Dependencies within E3

- T3.2 blocked-by T3.1
- T3.3 blocked-by T3.2
- T3.4 blocked-by T3.2, T3.5, T3.6, T3.7 (needs card model and all tier definitions to select correctly across systems)
- T3.5, T3.6, T3.7 can be worked in parallel
- T3.8 blocked-by T3.5, T3.6, T3.7 (needs all tier definitions)
- T3.9 blocked-by T3.4, T3.8

---

## R2: Core Logic Review

*Blocked by: E2, E3. Blocks: E4, E6, E7.*

Review the complete domain logic layer (Python data pipeline and JS
gematria/spaced-repetition modules) before building any UI on top of it.
Issues found during this review become new beads that block R2; the review
cannot close until all issues are resolved.

| ID   | Title                                      | Type | Notes |
|------|--------------------------------------------|------|-------|
| TR.2 | Core logic code review                     | task | Review all E2 and E3 output. Focus areas listed below. |

**Review focus**:
- JS module organization: file boundaries, export surfaces, naming
- Data flow: CSV to Python to JSON to client -- clean hand-offs, no leaky
  abstractions
- SM-2 implementation: algorithm correctness, edge cases
- localStorage schema: key naming, namespacing, data shape consistency
- Tier definitions: completeness, consistency across system types
- Naming consistency: between Python and JS layers, between data files
  and code references
- Test coverage: all valuation systems, cipher systems, encoding edge cases

---

## E4: Flashcard UI and Card Transitions

*Blocked by: R2. Blocks: E5.*

This epic builds the main flashcard interaction: app shell, navigation,
card display, flip/reveal, rating, transition animations, keyboard
shortcuts, responsive layout, and accessibility.

### Sub-epic E4a: Core flashcard interaction

| ID   | Title                                           | Type    | Notes |
|------|-------------------------------------------------|---------|-------|
| T4.1 | Implement Alpine.js app shell and view router   | feature | View state management: splash, welcome, flashcard, progress, reference, settings, about. Alpine.js x-data on root element. Creates static/js/app.js. |
| T4.2 | Implement navigation bar                        | task    | Minimal top bar with links to progress, reference, settings, about, and keyboard shortcuts (?). Stays out of the way during card review. |
| T4.3 | Implement flashcard view (card display + flip)   | feature | Large centered prompt (Hebrew letter, number, or Hebrew number string -- no English instructions), "Show Answer" button/Space, answer reveal below prompt |
| T4.4 | Implement rating buttons and card advancement    | feature | 4 rating buttons labeled Wrong/Unsure/Good/Easy (mapping to SM-2 quality values 1/3/4/5), wire to SM-2 update, auto-advance to next card after rating |
| T4.5 | Implement status line                           | task    | "Level [letter] - Card N/M". Fixed denominator for tiers 1-4 (total cards in tier). For procedurally generated tiers 5-8, denominator shows the number of cards introduced so far (grows as new procedural cards are generated). |

### Sub-epic E4b: Transitions and animations

| ID   | Title                                           | Type | Notes |
|------|-------------------------------------------------|------|-------|
| T4.6 | Implement fade transition                       | task | CSS transition driven by Alpine.js class toggling: fade out current card, fade in next. Default 250ms. |
| T4.7 | Implement slide-left transition                 | task | CSS transition: slide out left, slide in from right. Default 300ms. |
| T4.8 | Implement "none" transition                     | task | Instant switch, 0ms. |
| T4.9 | Implement prefers-reduced-motion override       | task | When OS reduces motion, force "none" regardless of user's animation setting. The settings view should note this override when it is active (coordinated with T5.8). |

### Sub-epic E4c: Keyboard shortcuts

| ID    | Title                                           | Type | Notes |
|-------|-------------------------------------------------|------|-------|
| T4.10 | Implement keyboard shortcut handler             | task | Space (flip), 1-4 (rate), p/r/s/a/? (views). Rating keys active only after answer is revealed. View keys should not interfere with other contexts. |
| T4.11 | Implement keyboard shortcuts overlay            | task | Dismissible overlay listing all shortcuts. Toggled with ? key. |

### Sub-epic E4d: Layout and accessibility

| ID    | Title                                            | Type | Notes |
|-------|--------------------------------------------------|------|-------|
| T4.12 | Implement responsive layout                      | task | Mobile: full-width cards/buttons, 48x48px min tap targets. Desktop: max-width 640px centered. Tailwind breakpoints. |
| T4.13 | Implement RTL handling for Hebrew text            | task | `dir="rtl"` on Hebrew text containers (flashcard prompt, answer reveal, reference table Hebrew columns, example attributions). Verify geresh/gershayim render correctly in RTL context. LTR for overall page layout. |
| T4.14 | Add ARIA labels and roles                        | task | aria-label on all interactive elements (rating buttons, nav links, show-answer button). `role="status"` on flashcard prompt area so screen readers announce new cards. |
| T4.15 | Implement focus management                       | task | Focus moves to new view's first interactive element on view change. Focus returns to card area when returning to flashcard view so keyboard shortcuts work immediately. |
| T4.16 | Verify color contrast (WCAG AA)                  | task | Both light and dark modes. All text and interactive elements. |
| T4.17 | Add visible focus indicators                     | task | Tailwind ring utilities on all keyboard-focusable elements |

### Sub-epic E4e: Card state preservation

| ID    | Title                                           | Type | Notes |
|-------|-------------------------------------------------|------|-------|
| T4.18 | Preserve card state on view navigation           | task | If user opens settings/reference/etc mid-card, preserve card state (answer hidden or revealed). Restore same card in same state on return. No rating recorded for the interruption. |
| T4.19 | Handle system switch mid-card                    | task | Discard current card without recording a rating (card belongs to old system). On return to flashcard view, load new system's progress state and present appropriate next card. |

### Dependencies within E4

- T4.1 is the first task; all others depend on it
- T4.2 blocked-by T4.1
- T4.3 blocked-by T4.1
- T4.4 blocked-by T4.3
- T4.5 blocked-by T4.3
- T4.6, T4.7, T4.8 blocked-by T4.3 (need card element to animate)
- T4.9 blocked-by T4.6 (needs at least one animation to override)
- T4.10 blocked-by T4.3, T4.4
- T4.11 blocked-by T4.10
- T4.12 blocked-by T4.3
- T4.13 blocked-by T4.3
- T4.14 blocked-by T4.3, T4.4, T4.2 (needs interactive elements to annotate)
- T4.15 blocked-by T4.1, T4.3 (needs view-switching and card display)
- T4.16 blocked-by T4.12 (needs final layout for contrast checks)
- T4.17 blocked-by T4.12 (needs responsive layout in place)
- T4.18 blocked-by T4.1, T4.3
- T4.19 blocked-by T4.18

---

## R3: UI Architecture Review

*Blocked by: E4. Blocks: E5.*

Review the UI layer before E5 replicates its patterns across many more
views. Issues found during this review become new beads that block R3;
the review cannot close until all issues are resolved.

| ID   | Title                                      | Type | Notes |
|------|--------------------------------------------|------|-------|
| TR.3 | UI architecture code review                | task | Review all E4 output. Focus areas listed below. |

**Review focus**:
- Alpine.js patterns: state management approach, component decomposition,
  x-data structure, event handling conventions
- View routing: consistency, state preservation across transitions
- CSS/Tailwind: utility class usage, custom CSS minimization, dark mode
  implementation
- Accessibility: ARIA labels, focus management, keyboard navigation,
  screen reader behavior
- Animations: CSS transition approach, reduced-motion handling
- RTL handling: correct scoping, geresh/gershayim rendering
- Responsive layout: mobile/desktop breakpoints, tap target sizing
- Code organization: JS file structure, separation of concerns

---

## E5: Supporting Views, Settings, and Session Management

*Blocked by: R3. Blocks: E8.*

This epic contains five sub-epics that are mostly independent of each
other and can be worked in parallel, except where noted.

### Sub-epic E5a: Session management (session.js)

| ID   | Title                                             | Type    | Notes |
|------|---------------------------------------------------|---------|-------|
| T5.1 | Implement localStorage availability check         | task    | try/catch write test on load. Set flag for degraded mode. |
| T5.2 | Implement cookie-based session detection           | task    | Read/write gematria_session=1 cookie with configurable expiry (default 30 days) |
| T5.3 | Implement page-load routing logic                  | feature | Check cookie and localStorage, route to appropriate view: (1) Both exist: show welcome/resume prompt. (2) No cookie but localStorage exists: session has expired -- clear stale progress data from localStorage (preserve settings only), show splash screen. (3) Neither exists: new user, show splash screen. |
| T5.4 | Implement degraded mode notice                     | task    | When localStorage unavailable (e.g. Safari private browsing), show brief notice that progress will not be saved. App still functions as stateless flashcard tool. |

### Sub-epic E5b: Settings view and settings state (settings.js)

| ID    | Title                                             | Type    | Notes |
|-------|---------------------------------------------------|---------|-------|
| T5.5  | Implement settings.js (settings state module)      | task    | Read/write settings to localStorage. Defaults for all settings. Immediate effect on change (no save button). |
| T5.6  | Implement gematria system selector                 | feature | Grouped into two categories: valuation methods (Mispar Hechrachi, Gadol, Katan, Siduri) and cipher methods (Atbash, Albam, Avgad). One-line description per option. Default is Mispar Hechrachi. Switching loads that system's independent progress state -- no data is lost. |
| T5.7  | Implement font selector with preview               | feature | 3 options (Standard, Sans-serif, Rashi) with Hebrew letter preview rendered in each font. Applies chosen font family via CSS class on container element to all Hebrew text. |
| T5.8  | Implement animation style and duration controls    | feature | Dropdown for style (fade/slide-left/none). Duration slider/radio (0-500ms in 50ms steps). Duration disabled when style is "none". When `prefers-reduced-motion` is active, display a note explaining the override (coordinated with T4.9). |
| T5.9  | Implement dark mode toggle                         | feature | Three options: System (follow prefers-color-scheme), Light, Dark. Stored in localStorage. |
| T5.10 | Implement "Start from scratch" (per-system)       | feature | Settings-view version: clears progress for the currently active gematria system only. Other systems' progress and all settings are preserved. Requires confirmation dialog. User remains in the app; active system restarts from placement assessment. |

### Sub-epic E5c: Splash screen and welcome/resume views

| ID    | Title                                            | Type    | Notes |
|-------|--------------------------------------------------|---------|-------|
| T5.11 | Implement splash screen                          | feature | App name, one-sentence gematria description, prerequisite note (assumes Hebrew alphabet familiarity -- app teaches numerical values, not letter recognition), brief flashcard system explanation (cards shown, flip to see answer, rate confidence, system adapts), keyboard shortcut note (press ? at any time), "Begin" button that starts placement assessment. |
| T5.12 | Implement welcome/resume view                    | feature | "Continue where you left off?" with two buttons: "Continue" (resumes existing session) and "Start from scratch" (full reset: clears all localStorage progress data for all gematria systems, clears session cookie, preserves settings only, returns to splash screen). Requires confirmation dialog for "Start from scratch". |

### Sub-epic E5d: Reference and about views

| ID    | Title                                            | Type    | Notes |
|-------|--------------------------------------------------|---------|-------|
| T5.13 | Implement reference view                         | feature | Read-only table: 22 letters + 5 final forms, names, values for active system. For valuation methods, values are numbers; for cipher methods, values are paired letters. For Hechrachi: note 15/16 special cases and thousands convention. Dynamic: updates when active system changes. |
| T5.14 | Implement about view                             | feature | App purpose (free gematria practice via spaced-repetition flashcards), no-accounts/no-tracking/no-data-collection note, developer note (built for personal use, shared for others), GitHub link (conditional on GITHUB_REPO_URL), Ko-fi link (conditional on KOFI_USERNAME). |

### Sub-epic E5e: Placement assessment

*Blocked by: E5a (T5.3), E5c (T5.11, T5.12). These determine when
the assessment runs. Also requires E3 tier definitions (transitive
through E4).*

| ID    | Title                                            | Type    | Notes |
|-------|--------------------------------------------------|---------|-------|
| T5.15 | Implement 8-tier placement (Hechrachi, Gadol)    | feature | Step 1: 3 cards from Tier 1; if all correct with high confidence, go to step 2, else start at Tier 1. Step 2: 3 cards from Tier 3; if correct, go to step 3, else start at Tier 2. Step 3: 2 cards from Tier 5; if correct, go to step 4, else start at Tier 4 or 5 based on results. Step 4: 2 cards from Tier 7; place at appropriate tier based on results. For Gadol, Tier 4 final-form cards use 500-900 values. |
| T5.16 | Implement 4-tier placement (Katan, Siduri)       | feature | Present 3 cards from tier 1; if correct, 3 from tier 2; if correct, 3 from tier 3. Place at first tier where user struggles, or tier 4 if all correct. |
| T5.17 | Implement 3-tier placement (ciphers)             | feature | Present 3 cards from tier 1 and 3 from tier 2. Place based on results. |
| T5.18 | Wire placement into session flow                 | task    | New session (from splash) or "Start from scratch" triggers placement for the active system. Assessment feels low-pressure: incorrect answers during placement are framed as "let's start here" rather than as failures. |

### Dependencies within E5

- E5a, E5b, E5c, E5d can start in parallel once E4 is complete
- T5.3 blocked-by T5.1, T5.2
- T5.6 through T5.10 blocked-by T5.5
- T5.15, T5.16, T5.17 can be worked in parallel
- T5.18 blocked-by T5.3, T5.11, T5.12, T5.15, T5.16, T5.17

---

## E6: Progress Display

*Blocked by: R2. Independent of E4 and E5 -- can be worked in parallel
with either.*

*Blocks: E8.*

| ID   | Title                                              | Type    | Notes |
|------|----------------------------------------------------|---------|-------|
| T6.1 | Implement progress statistics display              | task    | Current tier shown as Hebrew letter (e.g. "Level ד"), per-tier accuracy percentages, total cards reviewed, overall accuracy |
| T6.2 | Implement progress bar toward next tier            | task    | Visual indicator of advancement toward meeting mastery criteria for the current tier |
| T6.3 | Implement session accuracy chart with Chart.js     | feature | Simple visualization of accuracy over the session. Uses Chart.js from vendor/. |
| T6.4 | Implement completion state display                 | task    | When all tiers mastered, indicate completion and show cumulative statistics. In review mode, note that spaced repetition continues across all tiers. |

### Dependencies within E6

- T6.1, T6.2, T6.3 can be worked in parallel
- T6.4 blocked-by T6.1

---

## E7: Procedural Generation and Real-World Examples

*Blocked by: R2 (needs reviewed gematria and spaced repetition modules).
Independent of E4, E5, E6 -- can be worked in parallel with any of them.*

*Blocks: E8.*

| ID   | Title                                             | Type    | Notes |
|------|---------------------------------------------------|---------|-------|
| T7.1 | Implement seeded PRNG (generator.js)              | task    | Seed generated once per system when that system's progress is first created. Stored in localStorage alongside the system's spaced repetition state. Produces stable, predictable card IDs across browser sessions. Different seed after a "start from scratch" reset. |
| T7.2 | Implement Tier 5 compound number cards (11-99)    | feature | Random numbers in range, exclude single-letter values already covered in Tier 2 (20, 30, ..., 90). Always include 15 and 16 in the initial batch to ensure early exposure to ט״ו and ט״ז special cases. Both directions (number-to-Hebrew, Hebrew-to-number). |
| T7.3 | Implement Tier 6 compound number cards (100-999)  | feature | Random numbers in range, exclude single-letter values from earlier tiers (100, 200, 300, 400 in Hechrachi; also 500-900 in Gadol where those are single final-form letters). Both directions. |
| T7.4 | Implement Tier 7 Hebrew year cards                | feature | Random Hebrew calendar years from a configurable range (e.g. 5000-5900, roughly 1240-2140 CE). Each session generates a different sample via the seeded PRNG. Conventional Hebrew representation (omit thousands digit as is standard). Both directions. |
| T7.5 | Implement Tier 7 large number cards (1000-9999)   | feature | Random large numbers for general large-number fluency. Both directions. |
| T7.6 | Integrate curated examples and mixed review for Tier 8 | task | Load examples.json entries as cards. Intersperse with procedurally generated numbers from all difficulty ranges. Tier 8 serves as comprehensive review that never runs out of material. |

### Dependencies within E7

- T7.1 is the first task; all others depend on it
- T7.2 through T7.5 can be worked in parallel
- T7.6 blocked-by T7.2, T7.3, T7.4, T7.5 (Tier 8 draws from all prior procedural tiers)

---

## E8: Ko-fi, Offline Support, Polish, and Deployment

*Blocked by: E1-E7 (all prior epics). This is the integration and
polish phase.*

### Sub-epic E8a: Ko-fi integration

| ID   | Title                                             | Type | Notes |
|------|---------------------------------------------------|------|-------|
| T8.1 | Add Ko-fi link and optional widget to template    | task | Conditional on KOFI_USERNAME (already in template context from T1.3). Plain `<a>` tag in footer area. Optional floating widget: conditional `<script async>` tag that fails silently if it cannot load (offline or blocked). |

### Sub-epic E8b: Offline support

| ID   | Title                                             | Type    | Notes |
|------|---------------------------------------------------|---------|-------|
| T8.2 | Implement service worker (static/sw.js)           | feature | Cache-first strategy: serve cached assets immediately, update cache in background when connectivity is available. Cache: HTML page, all JS files, compiled CSS, font files. |
| T8.3 | Generate asset manifest at build time              | task    | List of all cacheable assets for the service worker to pre-cache on first load |
| T8.4 | Register service worker from base template         | task    | Script in base.html registers sw.js |

### Sub-epic E8c: End-to-end testing and polish

| ID   | Title                                             | Type | Notes |
|------|---------------------------------------------------|------|-------|
| T8.5 | Test full user flow end-to-end                    | task | New user -> splash -> placement -> flashcards -> tier advancement -> all views. Returning user -> welcome/resume -> continue or start over. |
| T8.6 | Test offline operation                            | task | Load page, disable network, verify all card interactions, view navigation, and state persistence continue to work |
| T8.7 | Tune SM-2 parameters                              | task | Adjust mastery thresholds (80% accuracy, 3+ reps) and interval parameters based on manual testing |
| T8.8 | Tune animation defaults                           | task | Experiment with animation presets and durations to find good defaults |

### Sub-epic E8d: GitHub Actions and deployment

| ID   | Title                                            | Type | Notes |
|------|--------------------------------------------------|------|-------|
| T8.9 | Create .github/workflows/deploy.yml              | task | Trigger on push to main. Setup Python 3.13 + uv. Install deps via `uv sync`. Set env vars: KOFI_USERNAME from secrets, GITHUB_REPO_URL from variables. Run `just build`. Deploy build/ to GitHub Pages via actions/deploy-pages. |
| T8.10 | Test deployment to GitHub Pages                 | task | Verify the static site works correctly when served from GitHub Pages. Requires GitHub Pages source set to "GitHub Actions" in repo settings. |

### Dependencies within E8

- T8.1 has no internal dependencies (template context already wired in T1.3)
- T8.3 blocked-by T8.2
- T8.4 blocked-by T8.2
- T8.5 blocked-by T8.1, T8.4 (needs full app including Ko-fi and service worker)
- T8.6 blocked-by T8.3, T8.4
- T8.7, T8.8 blocked-by T8.5
- T8.9 can be worked in parallel with T8.2-T8.8
- T8.10 blocked-by T8.9, T8.5

---

## R4: Final Review

*Blocked by: E8. Blocks: production deployment.*

Comprehensive review of the full codebase before deployment. Issues found
during this review become new beads that block R4; the review cannot close
until all issues are resolved.

| ID   | Title                                      | Type | Notes |
|------|--------------------------------------------|------|-------|
| TR.4 | Final comprehensive code review            | task | Review all code. Focus areas listed below. |

**Review focus**:
- End-to-end coherence: consistent patterns across all JS modules, all
  views, all data flows
- Dead code: unused functions, unreachable branches, vestigial imports
- Naming consistency: variables, functions, CSS classes, localStorage keys,
  file names -- all following the same conventions
- Performance: unnecessary re-renders, large DOM operations, asset sizes
- Security: service worker caching correctness, no sensitive data in
  localStorage, no XSS vectors in dynamic content
- Build output: correct asset paths, no missing files, clean HTML output
- Deployment readiness: GitHub Actions workflow, environment variables,
  all conditional features (Ko-fi, GitHub link) work in both present and
  absent states

---

## Summary

| ID   | Title                                     | Tasks | Blocked by    |
|------|-------------------------------------------|-------|---------------|
| E1   | Project Scaffolding                       | 14    | (none)        |
| R1   | Foundation Review                         | 1     | E1            |
| E2   | Gematria Data and Core Logic              | 19    | R1            |
| E3   | Spaced Repetition Engine                  | 9     | E2            |
| R2   | Core Logic Review                         | 1     | E2, E3        |
| E4   | Flashcard UI and Card Transitions         | 19    | R2            |
| R3   | UI Architecture Review                    | 1     | E4            |
| E5   | Supporting Views, Settings, Session       | 18    | R3            |
| E6   | Progress Display                          | 4     | R2            |
| E7   | Procedural Generation and Examples        | 6     | R2            |
| E8   | Ko-fi, Offline, Polish, Deploy            | 10    | E5-E7         |
| R4   | Final Review                              | 1     | E8            |
|      | **Total**                                 | **103** |              |

Note: Review gate task counts (1 each) are minimums. Issues discovered
during a review are created as additional beads that block the review gate.

### Critical path

The longest sequential chain is:

```
E1 -> R1 -> E2 -> E3 -> R2 -> E4 -> R3 -> E5 -> E8 -> R4
```

E6 and E7 can be worked in parallel with E4 and E5 (both depend on R2,
not on E4), shortening wall-clock time if parallelism is possible.

### Deferred / backlog items

The following items from the implementation plan are not included as tasks
because the plan marks them as optional or deferred:

- **JavaScript tests** (tests/js/): The testing strategy says JS tests are
  "optional for the initial implementation and can be added as the JS
  codebase grows." If added later, they would cover SM-2 algorithm, card
  selection, tier progression, procedural generation, and gematria system
  functions matching the Python reference.
- **Historical context page**: The about view "may optionally include a
  link to a second-level page" covering historical context of gematria
  systems (Appendix in implementation-plan.md). Can be added as a follow-on
  if desired.
- **mkdocs documentation** (docs/): Listed in AGENTS.md tech stack and
  the project structure, but not mentioned in any implementation phase.
  Can be set up when documentation is needed.
