"""Fixtures for Playwright e2e tests."""

import socket
import subprocess
import sys
import time

import pytest


def _wait_for_server(host, port, timeout=10):
    """Block until the server accepts TCP connections."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return
        except OSError:
            time.sleep(0.2)
    raise RuntimeError(f"Server on {host}:{port} did not start within {timeout}s")


@pytest.fixture(scope="session")
def flask_server():
    """Start a Flask dev server in a subprocess and yield its base URL."""
    port = 5099
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "flask",
            "--app",
            "src.app",
            "run",
            "--port",
            str(port),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        _wait_for_server("127.0.0.1", port)
        yield f"http://127.0.0.1:{port}"
    finally:
        proc.terminate()
        proc.wait(timeout=5)


@pytest.fixture(scope="session")
def base_url(flask_server):
    """Override pytest-base-url's fixture to point at our Flask server."""
    return flask_server
