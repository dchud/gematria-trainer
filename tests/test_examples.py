"""Tests for examples.json gematria correctness (T2.16)."""

import json
from pathlib import Path

import pytest

EXAMPLES_JSON = (
    Path(__file__).resolve().parent.parent / "src" / "data" / "examples.json"
)

# Standard (hechrachi) gematria values.  Final forms use the
# same value as their non-final counterparts in this system.
STANDARD_VALUES = {
    "א": 1,
    "ב": 2,
    "ג": 3,
    "ד": 4,
    "ה": 5,
    "ו": 6,
    "ז": 7,
    "ח": 8,
    "ט": 9,
    "י": 10,
    "כ": 20,
    "ך": 20,
    "ל": 30,
    "מ": 40,
    "ם": 40,
    "נ": 50,
    "ן": 50,
    "ס": 60,
    "ע": 70,
    "פ": 80,
    "ף": 80,
    "צ": 90,
    "ץ": 90,
    "ק": 100,
    "ר": 200,
    "ש": 300,
    "ת": 400,
}

VALID_SYSTEMS = {
    "hechrachi",
    "gadol",
    "katan",
    "siduri",
    "atbash",
    "albam",
    "avgad",
}

REQUIRED_KEYS = {
    "hebrew",
    "value",
    "transliteration",
    "meaning",
    "attribution",
    "system",
}


@pytest.fixture(scope="module")
def examples():
    with open(EXAMPLES_JSON) as f:
        return json.load(f)


def _compute_hechrachi(hebrew_word):
    """Sum standard gematria values for a Hebrew word."""
    return sum(STANDARD_VALUES.get(ch, 0) for ch in hebrew_word)


# -------------------------------------------------------------------
# Required keys
# -------------------------------------------------------------------


class TestExampleSchema:
    """Each example must have required keys and a valid system."""

    def test_each_example_has_required_keys(self, examples):
        for i, ex in enumerate(examples):
            missing = REQUIRED_KEYS - set(ex.keys())
            assert not missing, (
                f"Example {i} ({ex.get('hebrew', '?')}) missing keys: {missing}"
            )

    def test_system_is_valid(self, examples):
        for i, ex in enumerate(examples):
            assert ex["system"] in VALID_SYSTEMS, (
                f"Example {i} ({ex.get('hebrew', '?')}) "
                f"has invalid system: {ex['system']}"
            )


# -------------------------------------------------------------------
# Gematria value verification for hechrachi examples
# -------------------------------------------------------------------


class TestHechrachiValues:
    """For every hechrachi example, the stated value must equal
    the sum of standard letter values."""

    def test_all_hechrachi_values_are_correct(self, examples):
        hechrachi = [ex for ex in examples if ex["system"] == "hechrachi"]
        assert len(hechrachi) > 0, "No hechrachi examples"
        for ex in hechrachi:
            computed = _compute_hechrachi(ex["hebrew"])
            assert computed == ex["value"], (
                f"{ex['hebrew']} ({ex['transliteration']}): "
                f"computed {computed}, stated {ex['value']}"
            )

    def test_hechrachi_values_individually(self, examples):
        """Report each failure independently for debugging."""
        hechrachi = [ex for ex in examples if ex["system"] == "hechrachi"]
        failures = []
        for ex in hechrachi:
            computed = _compute_hechrachi(ex["hebrew"])
            if computed != ex["value"]:
                failures.append(
                    f"  {ex['hebrew']} "
                    f"({ex['transliteration']}): "
                    f"computed={computed}, "
                    f"stated={ex['value']}"
                )
        assert not failures, "Incorrect hechrachi values:\n" + "\n".join(failures)
