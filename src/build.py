"""Frozen-Flask build script. Generates a static site in build/."""

from pathlib import Path

import structlog
from flask_frozen import Freezer

from src.app import app

log = structlog.get_logger()


def freeze():
    app.config["FREEZER_DESTINATION"] = "../build"
    app.config["FREEZER_RELATIVE_URLS"] = True
    freezer = Freezer(app)
    log.info("freezing_site")
    freezer.freeze()
    build_dir = Path(__file__).resolve().parent.parent / "build"
    (build_dir / ".nojekyll").touch()
    log.info("freeze_complete", destination="build/")


if __name__ == "__main__":
    freeze()
