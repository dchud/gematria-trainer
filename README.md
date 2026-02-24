# Gematria Trainer

A free, anonymous, mobile-friendly web application for learning Hebrew
Gematria through spaced-repetition flashcards. The app supports multiple
gematria systems (Mispar Hechrachi, Gadol, Katan, Siduri) and ciphers
(Atbash, Albam, Avgad), with tiered progression from basic letter values
through compound numbers, Hebrew years, and real-world examples.

The application is a static site with no backend. All session state is
stored client-side in the browser via localStorage.


## Technology Stack

- **Python 3.13+** with **uv** for environment management
- **Flask + Frozen-Flask** for build-time HTML generation (static site)
- **Alpine.js** for client-side interactivity and state management
- **Tailwind CSS** (standalone CLI, no Node.js required) for styling
- **ruff** for Python linting and formatting
- **pytest** for testing
- **justfile** for task automation
- **structlog** for logging in build scripts
- **python-dotenv** for build-time configuration

Deployed to **GitHub Pages** via GitHub Actions.


## Development

Requires Python 3.13+ and [uv](https://docs.astral.sh/uv/).

```bash
uv sync                     # Install dependencies
```

### Common Operations

All operations use [just](https://github.com/casey/just) recipes:

```bash
just dev                    # Start Flask dev server with auto-reload
just css                    # Compile Tailwind CSS in watch mode
just build                  # Run full build pipeline (Tailwind + Frozen-Flask)
just test                   # Run pytest
just lint                   # Run ruff check
just format                 # Run ruff format
```

### Build Pipeline

The build produces a static site in `build/`:

1. Tailwind CSS compiles `static/css/input.css` to `static/dist/output.css`
2. Frozen-Flask renders all routes to `build/` with static assets

Tailwind must run before Frozen-Flask. `just build` handles this ordering.

### Configuration

Copy `.env.example` to `.env` for local configuration:

```bash
cp .env.example .env
```

Available variables:

- `KOFI_USERNAME` — Ko-fi page slug for the "Buy me a coffee" link (optional)
- `GITHUB_REPO_URL` — Public repo URL for the About page (optional)


## Deployment

Push to `main` triggers the GitHub Actions CD workflow
(`.github/workflows/deploy.yml`), which builds the site and deploys to
GitHub Pages. See the implementation plan for required GitHub
configuration (secrets, variables, Pages source setting).


## Design

See [implementation-plan.md](implementation-plan.md) for a detailed record
of how the application was designed, including the gematria data model,
spaced repetition algorithm, tier progression, UI layout, and historical
context of the gematria systems.


## License

MIT. See [LICENSE](LICENSE).
