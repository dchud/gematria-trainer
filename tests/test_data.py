"""Tests for letters.csv and gematria.py (T2.14, T2.15)."""

import csv
import json
from pathlib import Path

import pytest

from src.data.gematria import (
    examples_to_json,
    letters_to_json,
    load_examples,
    load_letters,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"
LETTERS_CSV = DATA_DIR / "letters.csv"


# ---------------------------------------------------------------------------
# T2.14: letters.csv schema and values
# ---------------------------------------------------------------------------

REQUIRED_CSV_COLUMNS = {
    "letter",
    "name",
    "position",
    "standard_value",
    "final_form",
    "final_value",
}

EXPECTED_STANDARD_VALUES = [
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    20,
    30,
    40,
    50,
    60,
    70,
    80,
    90,
    100,
    200,
    300,
    400,
]

EXPECTED_FINAL_FORMS = {
    "ך": 500,
    "ם": 600,
    "ן": 700,
    "ף": 800,
    "ץ": 900,
}


class TestLettersCsvSchema:
    """Verify the raw CSV file has the expected structure."""

    @pytest.fixture(scope="class")
    def raw_rows(self):
        """Read letters.csv as raw dicts (no type conversion)."""
        with open(LETTERS_CSV) as f:
            reader = csv.DictReader(f)
            return list(reader)

    @pytest.fixture(scope="class")
    def raw_fieldnames(self):
        with open(LETTERS_CSV) as f:
            reader = csv.DictReader(f)
            return reader.fieldnames

    def test_csv_has_exactly_22_rows(self, raw_rows):
        assert len(raw_rows) == 22

    def test_csv_has_all_required_columns(self, raw_fieldnames):
        assert REQUIRED_CSV_COLUMNS.issubset(set(raw_fieldnames))

    def test_positions_are_1_through_22_in_order(self, raw_rows):
        positions = [int(r["position"]) for r in raw_rows]
        assert positions == list(range(1, 23))

    def test_standard_values_match_expected(self, raw_rows):
        actual = [int(r["standard_value"]) for r in raw_rows]
        assert actual == EXPECTED_STANDARD_VALUES

    def test_exactly_five_final_forms_exist(self, raw_rows):
        finals = [r for r in raw_rows if r["final_form"]]
        assert len(finals) == 5

    def test_final_form_values(self, raw_rows):
        actual_finals = {
            r["final_form"]: int(r["final_value"]) for r in raw_rows if r["final_form"]
        }
        assert actual_finals == EXPECTED_FINAL_FORMS

    def test_all_22_letter_names_present_and_nonempty(self, raw_rows):
        names = [r["name"] for r in raw_rows]
        assert len(names) == 22
        assert all(name.strip() for name in names)


# ---------------------------------------------------------------------------
# T2.15: gematria.py validation and export
# ---------------------------------------------------------------------------


class TestLoadLetters:
    """Verify load_letters() returns well-formed data."""

    @pytest.fixture(scope="class")
    def letters(self):
        return load_letters()

    def test_returns_22_dicts(self, letters):
        assert len(letters) == 22
        assert all(isinstance(row, dict) for row in letters)

    def test_each_dict_has_required_keys(self, letters):
        for row in letters:
            assert REQUIRED_CSV_COLUMNS.issubset(set(row.keys()))

    def test_position_is_int(self, letters):
        for row in letters:
            assert isinstance(row["position"], int)

    def test_standard_value_is_int(self, letters):
        for row in letters:
            assert isinstance(row["standard_value"], int)

    def test_final_value_is_int_or_none(self, letters):
        for row in letters:
            fv = row["final_value"]
            assert fv is None or isinstance(fv, int)


REQUIRED_EXAMPLE_KEYS = {
    "hebrew",
    "value",
    "transliteration",
    "meaning",
    "attribution",
    "system",
}


class TestLoadExamples:
    """Verify load_examples() returns well-formed data."""

    @pytest.fixture(scope="class")
    def examples(self):
        return load_examples()

    def test_returns_nonempty_list(self, examples):
        assert isinstance(examples, list)
        assert len(examples) > 0

    def test_each_example_has_required_keys(self, examples):
        for ex in examples:
            assert isinstance(ex, dict)
            missing = REQUIRED_EXAMPLE_KEYS - set(ex.keys())
            assert not missing


class TestLettersToJson:
    """Verify letters_to_json() produces valid JSON."""

    def test_round_trip(self):
        letters = load_letters()
        json_str = letters_to_json(letters)
        parsed = json.loads(json_str)
        assert parsed == letters

    def test_output_is_valid_json_string(self):
        letters = load_letters()
        json_str = letters_to_json(letters)
        assert isinstance(json_str, str)
        json.loads(json_str)  # should not raise

    def test_preserves_hebrew_characters(self):
        letters = load_letters()
        json_str = letters_to_json(letters)
        # ensure_ascii=False means Hebrew chars appear literally
        assert "א" in json_str


class TestExamplesToJson:
    """Verify examples_to_json() produces valid JSON."""

    def test_round_trip(self):
        examples = load_examples()
        json_str = examples_to_json(examples)
        parsed = json.loads(json_str)
        assert parsed == examples


class TestLoadLettersMalformedCsv:
    """Verify load_letters() raises ValueError on bad CSV."""

    def test_missing_column_raises(self, tmp_path, monkeypatch):
        bad_csv = tmp_path / "letters.csv"
        bad_csv.write_text("letter,name,position\nא,Alef,1\n")
        monkeypatch.setattr("src.data.gematria.LETTERS_CSV", bad_csv)
        with pytest.raises(ValueError, match="Missing columns"):
            load_letters()

    def test_wrong_row_count_raises(self, tmp_path, monkeypatch):
        header = "letter,name,position,standard_value,final_form,final_value"
        rows = [f"א,Alef,{i},{i},," for i in range(1, 4)]
        bad_csv = tmp_path / "letters.csv"
        bad_csv.write_text(header + "\n" + "\n".join(rows) + "\n")
        monkeypatch.setattr("src.data.gematria.LETTERS_CSV", bad_csv)
        with pytest.raises(ValueError, match="Expected 22"):
            load_letters()

    def test_wrong_final_count_raises(self, tmp_path, monkeypatch):
        """22 rows but zero final forms should raise."""
        header = "letter,name,position,standard_value,final_form,final_value"
        rows = [f"א,Letter{i},{i},{i},," for i in range(1, 23)]
        bad_csv = tmp_path / "letters.csv"
        bad_csv.write_text(header + "\n" + "\n".join(rows) + "\n")
        monkeypatch.setattr("src.data.gematria.LETTERS_CSV", bad_csv)
        with pytest.raises(ValueError, match="Expected 5"):
            load_letters()
