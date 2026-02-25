"""Tests for the Frozen-Flask build process."""

import shutil
from pathlib import Path

import pytest

BUILD_DIR = Path(__file__).resolve().parent.parent / "build"


@pytest.fixture(scope="module")
def frozen_build():
    """Run a single freeze for all build tests."""
    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)

    from src.build import freeze

    freeze()
    yield BUILD_DIR

    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)


def test_freeze_creates_build_dir(frozen_build):
    assert frozen_build.exists()


def test_freeze_generates_index(frozen_build):
    index = frozen_build / "index.html"
    assert index.exists()
    html = index.read_text()
    assert "Gematria Trainer" in html


def test_freeze_copies_css(frozen_build):
    assert (frozen_build / "static" / "dist" / "output.css").exists()


def test_freeze_copies_fonts(frozen_build):
    fonts_dir = frozen_build / "static" / "fonts"
    assert (fonts_dir / "NotoSerifHebrew-Regular.woff2").exists()
    assert (fonts_dir / "NotoSansHebrew-Regular.woff2").exists()
    assert (fonts_dir / "NotoRashiHebrew-Regular.woff2").exists()


def test_freeze_copies_vendor_js(frozen_build):
    vendor_dir = frozen_build / "static" / "js" / "vendor"
    assert (vendor_dir / "alpine.min.js").exists()
    assert (vendor_dir / "chart.min.js").exists()


def test_frozen_index_has_relative_asset_paths(frozen_build):
    html = (frozen_build / "index.html").read_text()
    assert "static/dist/output.css" in html
    assert "static/js/vendor/alpine.min.js" in html


def test_freeze_creates_sw_js(frozen_build):
    assert (frozen_build / "sw.js").exists()


def test_sw_contains_precache_urls(frozen_build):
    sw = (frozen_build / "sw.js").read_text()
    assert "PRECACHE_URLS" in sw
    assert "static/js/app.js" in sw
    assert "static/dist/output.css" in sw
    assert '"./"' in sw


def test_frozen_index_registers_service_worker(frozen_build):
    html = (frozen_build / "index.html").read_text()
    assert "serviceWorker" in html
    assert 'register("sw.js")' in html
