set shell := ["bash", "-cu"]

# Tailwind binary name varies by platform
tailwind_bin := if os() == "macos" {
    if arch() == "aarch64" { "tailwindcss-macos-arm64" } else { "tailwindcss-macos-x64" }
} else if os() == "linux" {
    if arch() == "aarch64" { "tailwindcss-linux-arm64" } else { "tailwindcss-linux-x64" }
} else {
    error("Unsupported platform")
}

tailwind_url := "https://github.com/tailwindlabs/tailwindcss/releases/latest/download/" + tailwind_bin
alpine_url := "https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js"
chart_url := "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"

# Download Tailwind CLI and vendor JS (idempotent)
setup:
    #!/usr/bin/env bash
    set -euo pipefail

    # Download Tailwind standalone CLI if not present
    if [ ! -f ./tailwindcss ]; then
        echo "Downloading Tailwind CSS standalone CLI..."
        curl -sLo ./tailwindcss "{{ tailwind_url }}"
        chmod +x ./tailwindcss
        echo "Tailwind CLI downloaded."
    else
        echo "Tailwind CLI already present, skipping."
    fi

    # Create vendor JS directory
    mkdir -p static/js/vendor

    # Download Alpine.js if not present
    if [ ! -f static/js/vendor/alpine.min.js ]; then
        echo "Downloading Alpine.js..."
        curl -sLo static/js/vendor/alpine.min.js "{{ alpine_url }}"
        echo "Alpine.js downloaded."
    else
        echo "Alpine.js already present, skipping."
    fi

    # Download Chart.js if not present
    if [ ! -f static/js/vendor/chart.min.js ]; then
        echo "Downloading Chart.js..."
        curl -sLo static/js/vendor/chart.min.js "{{ chart_url }}"
        echo "Chart.js downloaded."
    else
        echo "Chart.js already present, skipping."
    fi

    echo "Setup complete."

# Start Flask dev server
dev:
    uv run flask --app src.app run --debug

# Full build pipeline: setup, compile CSS, freeze site
build: setup
    #!/usr/bin/env bash
    set -euo pipefail

    # Compile Tailwind CSS (one-shot, minified)
    ./tailwindcss -i static/css/input.css -o static/dist/output.css --minify

    # Freeze static site
    uv run python -m src.build

# Tailwind CSS watch mode for development
css:
    ./tailwindcss -i static/css/input.css -o static/dist/output.css --watch

# Format, lint, and test (use before committing)
check:
    uv run ruff format .
    uv run ruff check .
    uv run pytest

# Run test suite
test:
    uv run pytest

# Run linter
lint:
    uv run ruff check .

# Run formatter
format:
    uv run ruff format .

# Install git hooks (opt-in, runs just check on commit and push)
hooks:
    git config core.hooksPath hooks
    @echo "Git hooks activated (hooks/ directory)."
