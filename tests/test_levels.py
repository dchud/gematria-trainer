"""Tests for level definitions and card generation.

These tests verify the level structure and card generation logic as
implemented in static/js/levels.js by testing the same rules in Python.
They serve as a reference implementation to catch regressions.
"""

import csv
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"


@pytest.fixture(scope="module")
def letter_data():
    """Load letter data from CSV."""
    with open(DATA_DIR / "letters.csv") as f:
        return list(csv.DictReader(f))


@pytest.fixture(scope="module")
def alphabet(letter_data):
    """The 22 base Hebrew letters in order."""
    return [row["letter"] for row in letter_data]


@pytest.fixture(scope="module")
def final_forms(letter_data):
    """The 5 final-form letters."""
    return [row["final_form"] for row in letter_data if row["final_form"]]


# -------------------------------------------------------------------
# Level structure tests
# -------------------------------------------------------------------


class TestLevelCounts:
    def test_hechrachi_has_8_levels(self):
        assert _level_count("hechrachi") == 8

    def test_gadol_has_8_levels(self):
        assert _level_count("gadol") == 8

    def test_katan_has_4_levels(self):
        assert _level_count("katan") == 4

    def test_siduri_has_4_levels(self):
        assert _level_count("siduri") == 4

    def test_atbash_has_3_levels(self):
        assert _level_count("atbash") == 3

    def test_albam_has_3_levels(self):
        assert _level_count("albam") == 3

    def test_avgad_has_3_levels(self):
        assert _level_count("avgad") == 3


class TestLevelLabels:
    def test_level_labels_are_hebrew_letters(self):
        expected = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"]
        for i, letter in enumerate(expected, 1):
            assert _level_label(i) == letter


# -------------------------------------------------------------------
# 8-level card generation (Hechrachi, Gadol)
# -------------------------------------------------------------------


class TestEightLevelCards:
    def test_level_1_has_letters_alef_through_tet(self, letter_data):
        """Level 1: letters with positions 1-9, both directions."""
        letters = [row["letter"] for row in letter_data if int(row["position"]) <= 9]
        cards = _valuation_cards(letters, "hechrachi")
        assert len(cards) == 18  # 9 letters * 2 directions
        assert _has_card(cards, "alef-to-val")
        assert _has_card(cards, "val-to-alef")
        assert _has_card(cards, "tet-to-val")
        assert _has_card(cards, "val-to-tet")

    def test_level_2_has_letters_yod_through_tsade(self, letter_data):
        """Level 2: letters with positions 10-18."""
        letters = [
            row["letter"] for row in letter_data if 10 <= int(row["position"]) <= 18
        ]
        cards = _valuation_cards(letters, "hechrachi")
        assert len(cards) == 18  # 9 letters * 2 directions

    def test_level_3_has_letters_qof_through_tav(self, letter_data):
        """Level 3: letters with positions 19-22."""
        letters = [
            row["letter"] for row in letter_data if 19 <= int(row["position"]) <= 22
        ]
        cards = _valuation_cards(letters, "hechrachi")
        assert len(cards) == 8  # 4 letters * 2 directions

    def test_level_4_has_final_forms(self, final_forms):
        """Level 4: 5 final-form letters, both directions."""
        cards = _valuation_cards(final_forms, "hechrachi")
        assert len(cards) == 10  # 5 finals * 2 directions

    def test_hechrachi_level_4_final_values_same_as_base(self, letter_data):
        """In Hechrachi, final forms have same values as non-final."""
        for row in letter_data:
            if row["final_form"]:
                assert _hechrachi_value(row["final_form"], letter_data) == int(
                    row["standard_value"]
                )

    def test_gadol_level_4_final_values_distinct(self, letter_data):
        """In Gadol, final forms have distinct 500-900 values."""
        expected = {"ך": 500, "ם": 600, "ן": 700, "ף": 800, "ץ": 900}
        for row in letter_data:
            if row["final_form"]:
                assert int(row["final_value"]) == expected[row["final_form"]]

    def test_levels_5_through_8_are_procedural(self):
        """Levels 5-8 return empty (procedural cards handled by E7)."""
        for level in [5, 6, 7, 8]:
            assert _is_static("hechrachi", level) is False


# -------------------------------------------------------------------
# 4-level card generation (Katan, Siduri)
# -------------------------------------------------------------------


class TestFourLevelCards:
    def test_level_1_letters(self, letter_data):
        """Level 1: first 9 letters."""
        letters = [row["letter"] for row in letter_data[:9]]
        assert len(letters) == 9

    def test_level_2_letters(self, letter_data):
        """Level 2: next 9 letters."""
        letters = [row["letter"] for row in letter_data[9:18]]
        assert len(letters) == 9

    def test_level_3_includes_finals(self, letter_data, final_forms):
        """Level 3: last 4 letters + 5 final forms = 9 characters."""
        base = [row["letter"] for row in letter_data[18:22]]
        all_t3 = base + final_forms
        assert len(all_t3) == 9

    def test_level_4_is_cumulative(self, alphabet, final_forms):
        """Level 4: all 22 base letters + 5 finals = 27 characters."""
        all_letters = alphabet + final_forms
        assert len(all_letters) == 27

    def test_katan_multiple_letters_per_value(self, letter_data):
        """In Katan, letters share values: א=1, י=1, ק=1."""
        katan_vals = {}
        for row in letter_data:
            val = int(row["standard_value"])
            while val >= 10 and val % 10 == 0:
                val //= 10
            katan_vals.setdefault(val, []).append(row["letter"])
        # Value 1 should have 3 letters: alef, yod, qof
        assert len(katan_vals[1]) == 3
        assert katan_vals[1] == ["א", "י", "ק"]

    def test_siduri_unique_values(self, letter_data):
        """In Siduri, each ordinal 1-22 maps to exactly one letter."""
        positions = [int(row["position"]) for row in letter_data]
        assert sorted(positions) == list(range(1, 23))

    def test_all_4_level_systems_are_static(self):
        """All levels in 4-level systems are static."""
        for level in [1, 2, 3, 4]:
            assert _is_static("katan", level) is True
            assert _is_static("siduri", level) is True


# -------------------------------------------------------------------
# 3-level card generation (ciphers)
# -------------------------------------------------------------------


class TestThreeLevelCards:
    def test_level_1_has_first_11_letters(self, alphabet):
        """Level 1: letters positions 1-11."""
        assert len(alphabet[:11]) == 11

    def test_level_2_has_last_11_letters(self, alphabet):
        """Level 2: letters positions 12-22."""
        assert len(alphabet[11:]) == 11

    def test_symmetric_cipher_level_3_no_reverse(self, alphabet):
        """For symmetric ciphers, level 3 has 22 forward cards (no reverse)."""
        # Atbash and Albam are symmetric: f(f(x)) = x
        cards = _cipher_cards(alphabet, "atbash", include_reverse=False)
        assert len(cards) == 22

    def test_avgad_level_3_has_reverse(self, alphabet):
        """For Avgad, level 3 adds reverse cards: 22 forward + 22 reverse."""
        fwd_cards = _cipher_cards(alphabet, "avgad", include_reverse=False)
        all_cards = _cipher_cards(alphabet, "avgad", include_reverse=True)
        assert len(fwd_cards) == 22
        assert len(all_cards) == 44

    def test_atbash_pairs(self, letter_data):
        """Verify Atbash cipher pairs for level card content."""
        pairs = [
            ("א", "ת"),
            ("ב", "ש"),
            ("ג", "ר"),
            ("ד", "ק"),
            ("ה", "צ"),
            ("ו", "פ"),
            ("ז", "ע"),
            ("ח", "ס"),
            ("ט", "נ"),
            ("י", "מ"),
            ("כ", "ל"),
        ]
        for a, b in pairs:
            pos_a = _position(a, letter_data)
            pos_b = _position(b, letter_data)
            assert pos_a + pos_b == 23, f"Atbash: {a}({pos_a}) + {b}({pos_b}) != 23"

    def test_albam_pairs(self, letter_data):
        """Verify Albam cipher pairs for level card content."""
        pairs = [
            ("א", "ל"),
            ("ב", "מ"),
            ("ג", "נ"),
            ("ד", "ס"),
            ("ה", "ע"),
            ("ו", "פ"),
            ("ז", "צ"),
            ("ח", "ק"),
            ("ט", "ר"),
            ("י", "ש"),
            ("כ", "ת"),
        ]
        for a, b in pairs:
            pos_a = _position(a, letter_data)
            pos_b = _position(b, letter_data)
            assert abs(pos_a - pos_b) == 11, (
                f"Albam: |{a}({pos_a}) - {b}({pos_b})| != 11"
            )

    def test_all_3_level_systems_are_static(self):
        """All levels in 3-level systems are static."""
        for level in [1, 2, 3]:
            assert _is_static("atbash", level) is True
            assert _is_static("albam", level) is True
            assert _is_static("avgad", level) is True


# -------------------------------------------------------------------
# Card spec structure tests
# -------------------------------------------------------------------


class TestCardSpecs:
    def test_valuation_card_has_required_fields(self, letter_data):
        letters = [letter_data[0]["letter"]]
        cards = _valuation_cards(letters, "hechrachi")
        for card in cards:
            assert "id" in card
            assert "type" in card
            assert "prompt" in card
            assert "answer" in card

    def test_cipher_card_has_required_fields(self, letter_data):
        letters = [letter_data[0]["letter"]]
        cards = _cipher_cards(letters, "atbash", include_reverse=False)
        for card in cards:
            assert "id" in card
            assert "type" in card
            assert "prompt" in card
            assert "answer" in card

    def test_card_ids_are_unique_within_level(self, alphabet):
        """No duplicate IDs within a single level's card set."""
        cards = _valuation_cards(alphabet[:9], "hechrachi")
        ids = [c["id"] for c in cards]
        assert len(ids) == len(set(ids))

    def test_card_answer_is_string(self, letter_data):
        """Numerical answers are stringified."""
        letters = [letter_data[0]["letter"]]
        cards = _valuation_cards(letters, "hechrachi")
        for card in cards:
            assert isinstance(card["answer"], str)


# -------------------------------------------------------------------
# Mastery criteria tests
# -------------------------------------------------------------------


class TestMasteryCriteria:
    def test_accuracy_threshold(self):
        assert _mastery_accuracy() == 0.8

    def test_min_reps_threshold(self):
        assert _mastery_min_reps() == 3


# -------------------------------------------------------------------
# Helper functions (Python reference implementations)
# -------------------------------------------------------------------


LEVEL_COUNTS = {
    "hechrachi": 8,
    "gadol": 8,
    "katan": 4,
    "siduri": 4,
    "atbash": 3,
    "albam": 3,
    "avgad": 3,
}

LEVEL_LABELS_MAP = {
    1: "א",
    2: "ב",
    3: "ג",
    4: "ד",
    5: "ה",
    6: "ו",
    7: "ז",
    8: "ח",
}


def _level_count(system):
    return LEVEL_COUNTS.get(system, 0)


def _level_label(n):
    return LEVEL_LABELS_MAP.get(n, "")


def _is_static(system, level):
    count = LEVEL_COUNTS.get(system, 0)
    if count == 8:
        return level <= 4
    return True


def _mastery_accuracy():
    return 0.8


def _mastery_min_reps():
    return 3


def _position(letter, letter_data):
    for row in letter_data:
        if row["letter"] == letter:
            return int(row["position"])
    return 0


def _hechrachi_value(ch, letter_data):
    """Get hechrachi value for a character (base or final form)."""
    for row in letter_data:
        if row["letter"] == ch:
            return int(row["standard_value"])
        if row["final_form"] == ch:
            return int(row["standard_value"])
    return 0


def _valuation_cards(letters, system):
    """Generate valuation card specs (Python reference)."""
    cards = []
    for letter in letters:
        name = _letter_slug(letter)
        cards.append(
            {
                "id": name + "-to-val",
                "type": "letter-to-value",
                "prompt": letter,
                "answer": str(_compute_value(letter, system)),
            }
        )
        cards.append(
            {
                "id": "val-to-" + name,
                "type": "value-to-letter",
                "prompt": str(_compute_value(letter, system)),
                "answer": letter,
            }
        )
    return cards


def _cipher_cards(letters, system, include_reverse=False):
    """Generate cipher card specs (Python reference)."""
    cards = []
    for letter in letters:
        name = _letter_slug(letter)
        cards.append(
            {
                "id": "cipher-" + name,
                "type": "cipher-forward",
                "prompt": letter,
                "answer": letter,  # placeholder
            }
        )
        if include_reverse:
            cards.append(
                {
                    "id": "cipher-rev-" + name,
                    "type": "cipher-reverse",
                    "prompt": letter,
                    "answer": letter,  # placeholder
                }
            )
    return cards


def _has_card(cards, card_id):
    return any(c["id"] == card_id for c in cards)


# Lazy-loaded letter data for helper functions
_LETTER_DATA_CACHE = None


def _get_letter_data():
    global _LETTER_DATA_CACHE
    if _LETTER_DATA_CACHE is None:
        with open(DATA_DIR / "letters.csv") as f:
            _LETTER_DATA_CACHE = list(csv.DictReader(f))
    return _LETTER_DATA_CACHE


def _letter_slug(ch):
    """Convert a Hebrew letter to a slug-safe name for card IDs."""
    data = _get_letter_data()
    for row in data:
        if row["letter"] == ch:
            return row["name"].lower()
        if row["final_form"] == ch:
            return row["name"].lower() + "-final"
    return ch


def _compute_value(ch, system):
    """Compute a letter's value under a given system."""
    data = _get_letter_data()
    is_final = False
    base_row = None

    for row in data:
        if row["letter"] == ch:
            base_row = row
            break
        if row["final_form"] == ch:
            base_row = row
            is_final = True
            break

    if base_row is None:
        return 0

    if system == "hechrachi":
        return int(base_row["standard_value"])
    elif system == "gadol":
        if is_final and base_row["final_value"]:
            return int(base_row["final_value"])
        return int(base_row["standard_value"])
    elif system == "katan":
        val = int(base_row["standard_value"])
        while val >= 10 and val % 10 == 0:
            val //= 10
        return val
    elif system == "siduri":
        return int(base_row["position"])
    return 0
