"""Tests for the Flask application."""

from src.app import _asset_manifest, _build_asset_manifest, _cache_version, app


def test_asset_manifest_includes_js_files():
    urls, _ = _build_asset_manifest()
    js_urls = [u for u in urls if u.endswith(".js")]
    assert len(js_urls) >= 12  # 12 app modules + 2 vendor
    assert "static/js/app.js" in urls
    assert "static/js/gematria.js" in urls


def test_asset_manifest_includes_css():
    urls, _ = _build_asset_manifest()
    css_urls = [u for u in urls if u.endswith(".css")]
    assert len(css_urls) >= 1
    assert "static/dist/output.css" in urls


def test_asset_manifest_includes_fonts():
    urls, _ = _build_asset_manifest()
    font_urls = [u for u in urls if u.endswith(".woff2")]
    assert len(font_urls) >= 3
    assert "static/fonts/NotoSerifHebrew-Regular.woff2" in urls


def test_asset_manifest_includes_root_page():
    urls, _ = _build_asset_manifest()
    assert "./" in urls


def test_cache_version_format():
    _, version = _build_asset_manifest()
    assert version.startswith("gematria-v")
    assert len(version) == len("gematria-v") + 8  # 8-char hex digest


def test_module_level_manifest():
    """Verify module-level manifest is populated at import time."""
    assert len(_asset_manifest) > 0
    assert _cache_version.startswith("gematria-v")


def test_sw_route_returns_javascript():
    with app.test_client() as client:
        resp = client.get("/sw.js")
        assert resp.status_code == 200
        assert resp.content_type == "text/javascript"


def test_sw_route_contains_precache_urls():
    with app.test_client() as client:
        resp = client.get("/sw.js")
        body = resp.data.decode()
        assert "PRECACHE_URLS" in body
        assert "static/js/app.js" in body
        assert "CACHE_NAME" in body


def test_sw_route_contains_cache_version():
    with app.test_client() as client:
        resp = client.get("/sw.js")
        body = resp.data.decode()
        assert _cache_version in body
