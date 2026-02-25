# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-25

### Added

- Flask + Frozen-Flask static site generator with Tailwind CSS and Alpine.js
- Hebrew gematria data for five numeral systems (Standard, Mispar Gadol, Ordinal, Katan, AtBash)
- Gematria registry for system lookup and metadata
- SM-2 spaced repetition engine with confidence-based quality mapping
- Level progression system (A through H) with mastery thresholds
- Procedural card generator for multi-letter numbers, large numbers, and year cards
- Flashcard interface with prompt/answer flip, rating buttons (1-4), and keyboard shortcuts
- Card transitions (fade, slide-left) with reduced-motion support
- Placement assessment for adaptive difficulty based on prior knowledge
- Settings panel: gematria system, Hebrew font, dark mode (system/light/dark), transition style
- Progress view with per-level statistics, mastery progress bar, and Chart.js accuracy chart
- Cookie-based session persistence with localStorage progress storage
- Session expiry warning when cookie expires but saved progress remains
- Reference table for all letter-value mappings per system
- About page with project description and Ko-fi support link
- Service worker with stale-while-revalidate caching for offline support
- GitHub Actions deploy workflow with CI test step (ruff, biome, pytest, node:test)
- Dependabot configuration for pip and GitHub Actions dependencies
- WCAG 2.1 AA accessibility: focus management, ARIA labels, skip links, screen reader announcements
- Favicon (SVG and PNG fallback)

### Fixed

- Hebrew font override not applying to flashcard text
- `.nojekyll` file for GitHub Pages compatibility
- Service worker precache using `./` instead of `index.html` for root page
- Jinja2 whitespace handling in service worker template
- Chart initialization timing when navigating to progress view
