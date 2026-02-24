import os

from dotenv import load_dotenv
from flask import Flask, render_template

load_dotenv()

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="../static",
    static_url_path="/static",
)

KOFI_USERNAME = os.environ.get("KOFI_USERNAME", "")
GITHUB_REPO_URL = os.environ.get("GITHUB_REPO_URL", "")


@app.context_processor
def inject_globals():
    return {
        "kofi_username": KOFI_USERNAME,
        "github_repo_url": GITHUB_REPO_URL,
    }


@app.route("/")
def index():
    return render_template("index.html")
