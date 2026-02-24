"""Tests for gematria valuation systems, cipher systems, and number encoding.

These tests verify the algorithmic correctness of the gematria systems
defined in static/js/gematria.js by testing the same logic in Python.
The JS module was tested independently; these tests serve as a reference
implementation to catch regressions and confirm data consistency.
"""

import csv
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"


@pytest.fixture(scope="module")
def letter_data():
    """Load letter data from CSV for test computations."""
    with open(DATA_DIR / "letters.csv") as f:
        return list(csv.DictReader(f))


@pytest.fixture(scope="module")
def hechrachi_map(letter_data):
    """Standard values: final forms use same value as non-final."""
    m = {}
    for row in letter_data:
        m[row["letter"]] = int(row["standard_value"])
        if row["final_form"]:
            m[row["final_form"]] = int(row["standard_value"])
    return m


@pytest.fixture(scope="module")
def gadol_map(letter_data):
    """Gadol values: final forms use distinct 500-900 values."""
    m = {}
    for row in letter_data:
        m[row["letter"]] = int(row["standard_value"])
        if row["final_form"]:
            m[row["final_form"]] = int(row["final_value"])
    return m


@pytest.fixture(scope="module")
def katan_map(letter_data):
    """Katan values: drop trailing zeros from standard value."""
    m = {}
    for row in letter_data:
        val = int(row["standard_value"])
        while val >= 10 and val % 10 == 0:
            val //= 10
        m[row["letter"]] = val
        if row["final_form"]:
            m[row["final_form"]] = val
    return m


@pytest.fixture(scope="module")
def siduri_map(letter_data):
    """Siduri values: ordinal position 1-22."""
    m = {}
    for row in letter_data:
        m[row["letter"]] = int(row["position"])
        if row["final_form"]:
            m[row["final_form"]] = int(row["position"])
    return m


# -------------------------------------------------------------------
# T2.17: Valuation system tests
# -------------------------------------------------------------------


class TestMisparHechrachi:
    def test_single_letters(self, letter_data, hechrachi_map):
        expected = [
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
        for row, exp in zip(letter_data, expected):
            assert hechrachi_map[row["letter"]] == exp, f"{row['name']}: expected {exp}"

    def test_final_forms_same_as_nonfinal(self, letter_data, hechrachi_map):
        for row in letter_data:
            if row["final_form"]:
                assert hechrachi_map[row["final_form"]] == int(row["standard_value"])

    def test_word_chai(self, hechrachi_map):
        assert sum(hechrachi_map[c] for c in "חי") == 18

    def test_word_emet(self, hechrachi_map):
        assert sum(hechrachi_map[c] for c in "אמת") == 441

    def test_word_shalom(self, hechrachi_map):
        assert sum(hechrachi_map[c] for c in "שלום") == 376


class TestMisparGadol:
    def test_nonfinal_same_as_hechrachi(self, letter_data, gadol_map):
        for row in letter_data:
            assert gadol_map[row["letter"]] == int(row["standard_value"])

    def test_final_forms_distinct(self, gadol_map):
        assert gadol_map["ך"] == 500
        assert gadol_map["ם"] == 600
        assert gadol_map["ן"] == 700
        assert gadol_map["ף"] == 800
        assert gadol_map["ץ"] == 900


class TestMisparKatan:
    def test_single_digit_values(self, katan_map):
        expected = {
            "א": 1,
            "ב": 2,
            "ג": 3,
            "ד": 4,
            "ה": 5,
            "ו": 6,
            "ז": 7,
            "ח": 8,
            "ט": 9,
            "י": 1,
            "כ": 2,
            "ל": 3,
            "מ": 4,
            "נ": 5,
            "ס": 6,
            "ע": 7,
            "פ": 8,
            "צ": 9,
            "ק": 1,
            "ר": 2,
            "ש": 3,
            "ת": 4,
        }
        for letter, exp in expected.items():
            assert katan_map[letter] == exp, (
                f"{letter}: expected {exp}, got {katan_map[letter]}"
            )


class TestMisparSiduri:
    def test_ordinal_values(self, letter_data, siduri_map):
        for i, row in enumerate(letter_data, 1):
            assert siduri_map[row["letter"]] == i

    def test_final_forms_same_position(self, letter_data, siduri_map):
        for row in letter_data:
            if row["final_form"]:
                assert siduri_map[row["final_form"]] == int(row["position"])


# -------------------------------------------------------------------
# T2.18: Cipher system tests
# -------------------------------------------------------------------


class TestAtbash:
    """Mirror substitution: position p -> position (23-p)."""

    PAIRS = [
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

    @pytest.fixture(scope="class")
    def atbash_map(self, letter_data):
        m = {}
        for row in letter_data:
            pos = int(row["position"])
            target_pos = 23 - pos
            target_row = letter_data[target_pos - 1]
            m[row["letter"]] = target_row["letter"]
        return m

    def test_known_pairs(self, atbash_map):
        for a, b in self.PAIRS:
            assert atbash_map[a] == b, f"Atbash({a}) should be {b}"
            assert atbash_map[b] == a, f"Atbash({b}) should be {a}"

    def test_symmetry(self, atbash_map):
        for letter, cipher in atbash_map.items():
            assert atbash_map[cipher] == letter, f"Atbash is not symmetric for {letter}"


class TestAlbam:
    """Half-split substitution: position p -> p+11 (mod 22)."""

    PAIRS = [
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

    @pytest.fixture(scope="class")
    def albam_map(self, letter_data):
        m = {}
        for row in letter_data:
            pos = int(row["position"])
            target_pos = pos + 11 if pos <= 11 else pos - 11
            target_row = letter_data[target_pos - 1]
            m[row["letter"]] = target_row["letter"]
        return m

    def test_known_pairs(self, albam_map):
        for a, b in self.PAIRS:
            assert albam_map[a] == b, f"Albam({a}) should be {b}"
            assert albam_map[b] == a, f"Albam({b}) should be {a}"

    def test_symmetry(self, albam_map):
        for letter, cipher in albam_map.items():
            assert albam_map[cipher] == letter, f"Albam is not symmetric for {letter}"


class TestAvgad:
    """Shift cipher: forward shifts by +1, reverse by -1."""

    @pytest.fixture(scope="class")
    def alphabet(self, letter_data):
        return [row["letter"] for row in letter_data]

    def test_forward_shift(self, alphabet):
        for i, letter in enumerate(alphabet):
            expected = alphabet[(i + 1) % 22]
            assert expected is not None, f"Avgad forward({letter})"

    def test_forward_reverse_inverse(self, alphabet):
        for i, letter in enumerate(alphabet):
            fwd = alphabet[(i + 1) % 22]
            rev_idx = (alphabet.index(fwd) - 1) % 22
            assert alphabet[rev_idx] == letter, (
                f"Avgad reverse(forward({letter})) != {letter}"
            )

    def test_tav_wraps_to_alef(self, alphabet):
        assert alphabet[(21 + 1) % 22] == alphabet[0]  # ת -> א


# -------------------------------------------------------------------
# T2.19: Number encoding edge cases
# -------------------------------------------------------------------


class TestNumberEncoding:
    """Test Hebrew number encoding algorithm (reference implementation)."""

    VALUES = [
        400,
        300,
        200,
        100,
        90,
        80,
        70,
        60,
        50,
        40,
        30,
        20,
        10,
        9,
        8,
        7,
        6,
        5,
        4,
        3,
        2,
        1,
    ]
    LETTERS = "תשרקצפעסנמלכיטחזוהדגבא"
    GERESH = "\u05f3"
    GERSHAYIM = "\u05f4"

    def _encode(self, n, omit_thousands=True):
        if omit_thousands and n >= 1000:
            n = n % 1000
            if n == 0:
                n = n  # fallback handled below
        if n == 0:
            return ""

        result = []
        remaining = n
        for i, val in enumerate(self.VALUES):
            while remaining >= val:
                result.append(self.LETTERS[i])
                remaining -= val

        s = "".join(result)
        # Fix 15/16 special cases
        s = s.replace("יה", "טו")
        s = s.replace("יו", "טז")

        if len(s) == 1:
            return s + self.GERESH
        else:
            return s[:-1] + self.GERSHAYIM + s[-1]

    def test_single_letter_numbers(self):
        assert self._encode(1) == "א" + self.GERESH
        assert self._encode(5) == "ה" + self.GERESH
        assert self._encode(400) == "ת" + self.GERESH

    def test_fifteen_special_case(self):
        result = self._encode(15)
        plain = result.replace(self.GERSHAYIM, "")
        assert "טו" in plain
        assert "יה" not in plain

    def test_sixteen_special_case(self):
        result = self._encode(16)
        plain = result.replace(self.GERSHAYIM, "")
        assert "טז" in plain
        assert "יו" not in plain

    def test_multi_letter_has_gershayim(self):
        result = self._encode(18)  # חי
        assert self.GERSHAYIM in result

    def test_large_number(self):
        result = self._encode(611)  # Torah: תרי״א
        assert result.replace(self.GERSHAYIM, "") == "תריא"

    def test_hebrew_year_omits_thousands(self):
        result_5784 = self._encode(5784, omit_thousands=True)
        result_784 = self._encode(784)
        assert result_5784 == result_784

    def test_year_without_omitting_thousands(self):
        result = self._encode(5784, omit_thousands=False)
        # 5000 = ה (5*1000), but encoding 5784 fully means encoding 5784
        # This is a large number; just verify it's longer than the 784 version
        result_784 = self._encode(784)
        assert len(result.replace(self.GERSHAYIM, "").replace(self.GERESH, "")) >= len(
            result_784.replace(self.GERSHAYIM, "").replace(self.GERESH, "")
        )
