import hashlib
import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, Response, render_template

from src.data.gematria import (
    examples_to_json,
    letters_to_json,
    load_examples,
    load_letters,
)

load_dotenv()

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="../static",
    static_url_path="/static",
)

KOFI_USERNAME = os.environ.get("KOFI_USERNAME", "")
GITHUB_REPO_URL = os.environ.get("GITHUB_REPO_URL", "")

# Load gematria data at build time
_letters = load_letters()
_letters_json = letters_to_json(_letters)
_examples = load_examples()
_examples_json = examples_to_json(_examples)

# Cacheable file extensions for the service worker
_CACHEABLE_EXTENSIONS = {".js", ".css", ".woff2", ".ico"}

# Directories to skip when building the asset manifest
_SKIP_DIRS = {"node_modules", ".git", "__pycache__"}


def _build_asset_manifest():
    """Scan static/ for cacheable assets and return (urls, cache_version)."""
    static_dir = Path(app.static_folder)
    urls = []
    for path in sorted(static_dir.rglob("*")):
        if not path.is_file():
            continue
        if any(part in _SKIP_DIRS for part in path.parts):
            continue
        if path.suffix not in _CACHEABLE_EXTENSIONS:
            continue
        rel = path.relative_to(static_dir)
        urls.append(f"static/{rel}")
    # Include the root page (use "./" for compatibility with both Flask dev
    # server and frozen static files served with relative URLs)
    urls.append("./")
    urls.sort()
    digest = hashlib.md5("".join(urls).encode()).hexdigest()[:8]
    return urls, f"gematria-v{digest}"


_asset_manifest, _cache_version = _build_asset_manifest()


@app.context_processor
def inject_globals():
    return {
        "kofi_username": KOFI_USERNAME,
        "github_repo_url": GITHUB_REPO_URL,
        "letters_json": _letters_json,
        "examples_json": _examples_json,
        "asset_manifest": _asset_manifest,
        "cache_version": _cache_version,
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/sw.js")
def service_worker():
    js = render_template("sw.js.jinja2")
    return Response(js, content_type="text/javascript")
