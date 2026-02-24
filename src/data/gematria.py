"""Read, validate, and export Hebrew letter gematria data."""

import csv
import json
from pathlib import Path

import structlog

log = structlog.get_logger()

DATA_DIR = Path(__file__).parent
LETTERS_CSV = DATA_DIR / "letters.csv"
EXAMPLES_JSON = DATA_DIR / "examples.json"

REQUIRED_COLUMNS = {
    "letter",
    "name",
    "position",
    "standard_value",
    "final_form",
    "final_value",
}
EXPECTED_LETTER_COUNT = 22
EXPECTED_FINAL_COUNT = 5


def load_letters():
    """Load and validate letters.csv. Returns list of dicts."""
    log.info("loading_letters", path=str(LETTERS_CSV))
    with open(LETTERS_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        columns = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS - columns
        if missing:
            raise ValueError(f"Missing columns in letters.csv: {missing}")
        rows = list(reader)

    if len(rows) != EXPECTED_LETTER_COUNT:
        raise ValueError(f"Expected {EXPECTED_LETTER_COUNT} letters, got {len(rows)}")

    finals = [r for r in rows if r["final_form"]]
    if len(finals) != EXPECTED_FINAL_COUNT:
        raise ValueError(
            f"Expected {EXPECTED_FINAL_COUNT} final forms, got {len(finals)}"
        )

    # Convert numeric fields
    for row in rows:
        row["position"] = int(row["position"])
        row["standard_value"] = int(row["standard_value"])
        row["final_value"] = int(row["final_value"]) if row["final_value"] else None

    log.info("letters_loaded", count=len(rows), finals=len(finals))
    return rows


def load_examples():
    """Load and validate examples.json. Returns list of dicts."""
    log.info("loading_examples", path=str(EXAMPLES_JSON))
    with open(EXAMPLES_JSON, encoding="utf-8") as f:
        examples = json.load(f)

    required_keys = {
        "hebrew",
        "value",
        "transliteration",
        "meaning",
        "attribution",
        "system",
    }
    for i, ex in enumerate(examples):
        missing = required_keys - set(ex.keys())
        if missing:
            raise ValueError(f"Example {i} missing keys: {missing}")

    log.info("examples_loaded", count=len(examples))
    return examples


def letters_to_json(letters):
    """Convert letter data to JSON string for embedding in HTML."""
    return json.dumps(letters, ensure_ascii=False, indent=2)


def examples_to_json(examples):
    """Convert examples data to JSON string for embedding in HTML."""
    return json.dumps(examples, ensure_ascii=False, indent=2)
