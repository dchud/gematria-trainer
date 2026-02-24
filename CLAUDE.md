# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Gematria Trainer is a web-based interactive flashcard app for teaching Hebrew Gematria (numerical values of Hebrew letters). It targets anonymous users with mobile-friendly, responsive design.

**Always refer to AGENTS.md for the complete description of project objectives, technology stack decisions, and design requirements.** It is the authoritative source and may be updated over time.

## Documentation Style

All project documentation must be strictly factual, clear, and detailed. Avoid sales pitch tone and emoji. Write so that new users can easily learn how the project works.

## Technology Stack

- **Python 3.13+** with **uv** for environment management
- **Flask + Frozen-Flask** for build-time HTML generation (static site)
- **Tailwind CSS** for styling
- **Alpine.js** for client-side interactivity
- **structlog** for logging, **python-dotenv** for config
- **justfile** for task automation

## Development Commands

```bash
# Environment
uv sync                    # Install/sync dependencies

# Development server
just run                   # Start Flask dev server (or: uv run flask run)

# Code quality
just lint                  # Run ruff linting
just format                # Run ruff formatting
uv run ruff check .        # Lint directly
uv run ruff format .       # Format directly

# Testing
just test                  # Run full test suite
uv run pytest              # Run tests directly
uv run pytest tests/path/test_file.py::test_name  # Run single test
```

## Architecture

**Deployment goal**: Static-site deployment via GitHub Pages CD workflow — no persistent backend. The app should work client-side with any server-side processing happening at build time.

**Core mechanics**:
- Spaced repetition algorithm drives card progression
- Adaptive difficulty: quickly assess user level, skip basics if proficient
- Confidence ratings (high/low) feed into the repetition algorithm
- Ranking/tier system for visual progress tracking
- Cookie-based session persistence for anonymous returning users

**Hebrew Gematria progression**: Individual letters (both directions: Hebrew-to-number, number-to-Hebrew) → multi-letter numbers → large numbers → years and real-world examples from traditional literature.

## Issue Tracking

This project uses beads (`br`/`bd` CLI) for issue tracking. Issues live in `.beads/` and are exported to `.beads/issues.jsonl` for git tracking.

```bash
br ready                   # Find available work
br show <id>               # View issue details
br update <id> --status=in_progress  # Claim work
br close <id>              # Complete work
br sync --flush-only       # Export to JSONL (always do before session end)
```

Priority uses numbers 0-4 (P0=critical through P4=backlog), not words.
