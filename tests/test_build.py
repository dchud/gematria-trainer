"""Tests for the Frozen-Flask build process."""

import shutil
from pathlib import Path

import pytest
from flask_frozen import Freezer

from src.app import app

BUILD_DIR = Path(__file__).resolve().parent.parent / "build"


@pytest.fixture()
def freezer():
    app.config["FREEZER_DESTINATION"] = str(BUILD_DIR)
    app.config["FREEZER_RELATIVE_URLS"] = True
    return Freezer(app)


@pytest.fixture(autouse=True)
def clean_build_dir():
    """Remove build/ before and after each test."""
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    yield
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)


def test_freeze_creates_build_dir(freezer):
    freezer.freeze()
    assert BUILD_DIR.exists()


def test_freeze_generates_index(freezer):
    freezer.freeze()
    index = BUILD_DIR / "index.html"
    assert index.exists()
    html = index.read_text()
    assert "Gematria Trainer" in html


def test_freeze_copies_css(freezer):
    freezer.freeze()
    assert (BUILD_DIR / "static" / "dist" / "output.css").exists()


def test_freeze_copies_fonts(freezer):
    freezer.freeze()
    fonts_dir = BUILD_DIR / "static" / "fonts"
    assert (fonts_dir / "NotoSerifHebrew-Regular.woff2").exists()
    assert (fonts_dir / "NotoSansHebrew-Regular.woff2").exists()
    assert (fonts_dir / "NotoRashiHebrew-Regular.woff2").exists()


def test_freeze_copies_vendor_js(freezer):
    freezer.freeze()
    vendor_dir = BUILD_DIR / "static" / "js" / "vendor"
    assert (vendor_dir / "alpine.min.js").exists()
    assert (vendor_dir / "chart.min.js").exists()


def test_frozen_index_has_relative_asset_paths(freezer):
    freezer.freeze()
    html = (BUILD_DIR / "index.html").read_text()
    assert "static/dist/output.css" in html
    assert "static/js/vendor/alpine.min.js" in html
