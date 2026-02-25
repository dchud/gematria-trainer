# Gematria trainer

This application is an easy to use tool for teaching people how to read
Hebrew Gematria. It provides a web site that users can use anonymously, and is
mobile-friendly.

Over the course of an anonymous session, a user can be presented with a series
of flash cards or other introductory material to train quickly on the values of
individual letters, converting both ways (from Hebrew to Arabic numbers and
back). With some proficiency built up there, the system should progress to
providing larger numbers while the user continues to build their skill. Once
a user gets really good, the system should build up to large numbers, all the
way up to years and other practical examples from traditional literature and any
other real sources where number values may be larger or more complicated.

Under the hood, the system should used a spaced repetition algorithm to give
users a chance to assess their own progress number by number and to introduce
more complex numbers as the user gets better.

For a new session, the system should strategically assess where a user is
starting from - if they obviously know the basics, it should proceed to larger
numbers more quickly, but if they don't yet know the basics, it should focus on
rudiments until the user demonstrates sufficient growth.

The application should look clean, and be easy to use, with easy
to tap buttons on a mobile device and buttons with easy keyboard
shortcuts for desktop users with a keyboard, mouse, or other pointer.
Any given "flash card" should have large text centered on the screen
with buttons at the bottom. A tap/click/shortcut should make it
easy for the user to "flip the card" and assess whether they got
it right or wrong, with an option for indicating high or low
confidence (as further input to the spaced repetition system).
Keyboard users should have a quick way to get a summary of keyboard
shortcuts when they are unfamiliar.

The application should use a ranking or level system to assess where a user is in
the process, and provide an option to render this visually if the user wants to
check their status.

The application is strictly for anonymous users. A returning user should either
see a "pick up where you were" option if they have a cookie still present, or
should be able to have the system quickly assess where they are as if they were
a new user and proceed from there.

## Your role

You are an experience, full-stack software developer who prefers the technology
stack below. You know Hebrew and understand Gematria.

## Technology stack

Note that you might not need to use all of these tools.

- Python 3.13+
- uv for managing the python environment
- Flask + Frozen-Flask for build-time HTML generation (static site)
- Alpine.js for client-side interactivity
- Tailwind for CSS
- Chart.js for any custom visualizations
- ruff for formatting, linting, and checking
- pytest for testing
- material for mkdocs for documentation
- dotenv for configuration
- justfile for simplifying task execution
- structlog for logging
- beads via `br` for all internal task management - see below

## Deployment

It would be ideal if this could be such a simple app that we could deploy it
through GitHub Pages via a CD workflow. It should not have a backend.

<!-- br-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_rust](https://github.com/Dicklesworthstone/beads_rust) (`br`/`bd`) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View ready issues (unblocked, not deferred)
br ready              # or: bd ready

# List and search
br list --status=open # All open issues
br show <id>          # Full issue details with dependencies
br search "keyword"   # Full-text search

# Create and update
br create --title="..." --description="..." --type=task --priority=2
br update <id> --status=in_progress
br close <id> --reason="Completed"
br close <id1> <id2>  # Close multiple issues at once

# Sync with git
br sync --flush-only  # Export DB to JSONL
br sync --status      # Check sync status
```

### Workflow Pattern

1. **Start**: Run `br ready` to find actionable work
2. **Claim**: Use `br update <id> --status=in_progress`
3. **Work**: Implement the task
4. **Complete**: Use `br close <id>`
5. **Sync**: Always run `br sync --flush-only` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `br ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers 0-4, not words)
- **Types**: task, bug, feature, epic, chore, docs, question
- **Blocking**: `br dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
br sync --flush-only    # Export beads changes to JSONL
git commit -m "..."     # Commit everything
git push                # Push to remote
```

### Best Practices

- Check `br ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `br create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always sync before ending session

<!-- end-br-agent-instructions -->
