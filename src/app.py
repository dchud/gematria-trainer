import os

from dotenv import load_dotenv
from flask import Flask, render_template

from src.data.gematria import (
    letters_to_json,
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


@app.context_processor
def inject_globals():
    return {
        "kofi_username": KOFI_USERNAME,
        "github_repo_url": GITHUB_REPO_URL,
        "letters_json": _letters_json,
    }


@app.route("/")
def index():
    return render_template("index.html")
