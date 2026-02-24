"""Frozen-Flask build script. Generates a static site in build/."""

import structlog
from flask_frozen import Freezer

from src.app import app

log = structlog.get_logger()

app.config["FREEZER_DESTINATION"] = "../build"
app.config["FREEZER_RELATIVE_URLS"] = True

freezer = Freezer(app)

if __name__ == "__main__":
    log.info("freezing_site")
    freezer.freeze()
    log.info("freeze_complete", destination="build/")
