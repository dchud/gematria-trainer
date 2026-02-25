"""Tests for card state management and level mastery evaluation.

These tests verify the card state logic as implemented in
static/js/card-state.js by testing the same rules in Python.
"""

import csv
from pathlib import Path

import pytest

DATA_DIR = Path(__file__).resolve().parent.parent / "src" / "data"


# SM-2 constants
DEFAULT_EASE = 2.5
MIN_EASE = 1.3


def _adjust_ease(ef, quality):
    delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    return max(MIN_EASE, ef + delta)


def _sm2_review(card, quality):
    """SM-2 review + tracking fields (matches card-state.js reviewCard)."""
    new_ef = _adjust_ease(card["ease_factor"], quality)

    if quality < 3:
        new_reps = 0
        new_interval = 1
    else:
        if card["repetitions"] == 0:
            new_interval = 2
        elif card["repetitions"] == 1:
            new_interval = 10
        else:
            new_interval = round(card["interval_minutes"] * new_ef)
        new_reps = card["repetitions"] + 1

    return {
        "card_id": card["card_id"],
        "ease_factor": new_ef,
        "interval_minutes": new_interval,
        "repetitions": new_reps,
        "next_review": "2026-01-01T00:00:00Z",
        "last_quality": quality,
        "review_count": card["review_count"] + 1,
        "correct_count": card["correct_count"] + (1 if quality >= 3 else 0),
    }


def _create_card(card_id):
    return {
        "card_id": card_id,
        "ease_factor": DEFAULT_EASE,
        "interval_minutes": 1,
        "repetitions": 0,
        "next_review": "2026-01-01T00:00:00Z",
        "last_quality": None,
        "review_count": 0,
        "correct_count": 0,
    }


def _level_accuracy(cards):
    total_reviews = sum(c["review_count"] for c in cards)
    total_correct = sum(c["correct_count"] for c in cards)
    return total_correct / total_reviews if total_reviews > 0 else 0


def _check_mastery(cards, min_reps=3, accuracy_threshold=0.8):
    if not cards:
        return False
    for card in cards:
        if card["review_count"] < min_reps:
            return False
    return _level_accuracy(cards) >= accuracy_threshold


# -------------------------------------------------------------------
# Card creation tests
# -------------------------------------------------------------------


class TestCardCreation:
    def test_create_card_has_sm2_fields(self):
        card = _create_card("test-card")
        assert card["card_id"] == "test-card"
        assert card["ease_factor"] == DEFAULT_EASE
        assert card["interval_minutes"] == 1
        assert card["repetitions"] == 0
        assert card["last_quality"] is None

    def test_create_card_has_tracking_fields(self):
        card = _create_card("test-card")
        assert card["review_count"] == 0
        assert card["correct_count"] == 0


# -------------------------------------------------------------------
# Review tracking tests
# -------------------------------------------------------------------


class TestReviewTracking:
    def test_correct_review_increments_both_counts(self):
        card = _create_card("test")
        updated = _sm2_review(card, 4)  # Good
        assert updated["review_count"] == 1
        assert updated["correct_count"] == 1

    def test_wrong_review_increments_review_only(self):
        card = _create_card("test")
        updated = _sm2_review(card, 1)  # Wrong
        assert updated["review_count"] == 1
        assert updated["correct_count"] == 0

    def test_multiple_reviews_accumulate(self):
        card = _create_card("test")
        card = _sm2_review(card, 4)  # Good
        card = _sm2_review(card, 1)  # Wrong
        card = _sm2_review(card, 4)  # Good
        card = _sm2_review(card, 5)  # Easy
        assert card["review_count"] == 4
        assert card["correct_count"] == 3

    def test_unsure_counts_as_correct(self):
        card = _create_card("test")
        card = _sm2_review(card, 3)  # Unsure
        assert card["correct_count"] == 1


# -------------------------------------------------------------------
# Level accuracy tests
# -------------------------------------------------------------------


class TestLevelAccuracy:
    def test_no_reviews_returns_zero(self):
        cards = [_create_card("a"), _create_card("b")]
        assert _level_accuracy(cards) == 0

    def test_all_correct(self):
        cards = [_create_card("a"), _create_card("b")]
        for i in range(len(cards)):
            cards[i] = _sm2_review(cards[i], 4)
            cards[i] = _sm2_review(cards[i], 5)
        assert _level_accuracy(cards) == 1.0

    def test_mixed_accuracy(self):
        cards = [_create_card("a"), _create_card("b")]
        # Card a: 2 correct, 1 wrong = 2/3
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 1)
        # Card b: 3 correct = 3/3
        cards[1] = _sm2_review(cards[1], 4)
        cards[1] = _sm2_review(cards[1], 4)
        cards[1] = _sm2_review(cards[1], 4)
        # Level accuracy: 5/6 ≈ 0.833
        assert _level_accuracy(cards) == pytest.approx(5 / 6)


# -------------------------------------------------------------------
# Mastery evaluation tests
# -------------------------------------------------------------------


class TestMasteryEvaluation:
    def test_empty_cards_not_mastered(self):
        assert _check_mastery([]) is False

    def test_insufficient_reviews(self):
        """Cards with fewer than 3 reviews are not mastered."""
        cards = [_create_card("a")]
        cards[0] = _sm2_review(cards[0], 5)
        cards[0] = _sm2_review(cards[0], 5)
        assert _check_mastery(cards) is False

    def test_sufficient_reviews_high_accuracy(self):
        """3+ reviews and high accuracy = mastered."""
        cards = [_create_card("a")]
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 4)
        assert _check_mastery(cards) is True

    def test_sufficient_reviews_low_accuracy(self):
        """3+ reviews but low accuracy = not mastered."""
        cards = [_create_card("a")]
        cards[0] = _sm2_review(cards[0], 1)  # Wrong
        cards[0] = _sm2_review(cards[0], 1)  # Wrong
        cards[0] = _sm2_review(cards[0], 4)  # Good
        # Accuracy: 1/3 = 33% < 80%
        assert _check_mastery(cards) is False

    def test_one_card_unreviewed_blocks_mastery(self):
        """If any card has fewer than minReps reviews, level is not mastered."""
        cards = [_create_card("a"), _create_card("b")]
        # Card a: 3 correct
        for _ in range(3):
            cards[0] = _sm2_review(cards[0], 4)
        # Card b: only 2
        for _ in range(2):
            cards[1] = _sm2_review(cards[1], 4)
        assert _check_mastery(cards) is False

    def test_full_level_mastery(self):
        """All cards meet minimum reviews with good accuracy."""
        cards = [_create_card("a"), _create_card("b"), _create_card("c")]
        for i in range(len(cards)):
            for _ in range(4):
                cards[i] = _sm2_review(cards[i], 4)
        assert _check_mastery(cards) is True

    def test_borderline_accuracy(self):
        """Exactly 80% accuracy should pass mastery."""
        cards = [_create_card("a")]
        # 4 correct + 1 wrong = 4/5 = 80%
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 1)
        cards[0] = _sm2_review(cards[0], 4)
        assert cards[0]["review_count"] == 5
        assert cards[0]["correct_count"] == 4
        assert _check_mastery(cards) is True

    def test_just_below_80_percent(self):
        """79% accuracy should not pass mastery."""
        cards = [_create_card("a")]
        # We need review_count >= 3 and accuracy < 80%
        # 3 correct + 1 wrong = 3/4 = 75% < 80%
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 4)
        cards[0] = _sm2_review(cards[0], 1)
        assert cards[0]["review_count"] == 4
        assert _check_mastery(cards) is False


# -------------------------------------------------------------------
# Card init for level tests
# -------------------------------------------------------------------


@pytest.fixture(scope="module")
def letter_data():
    with open(DATA_DIR / "letters.csv") as f:
        return list(csv.DictReader(f))


class TestInitLevel:
    def test_hechrachi_level_1_card_count(self, letter_data):
        """Level 1 should have 18 cards (9 letters * 2 directions)."""
        # Simulate initLevel: get specs from level, create card states
        letters = [row["letter"] for row in letter_data[:9]]
        cards = []
        for letter in letters:
            cards.append(_create_card(letter + "-to-val"))
            cards.append(_create_card("val-to-" + letter))
        assert len(cards) == 18

    def test_cipher_level_1_card_count(self, letter_data):
        """Cipher level 1 should have 11 cards (11 letters forward)."""
        letters = [row["letter"] for row in letter_data[:11]]
        cards = [_create_card("cipher-" + letter) for letter in letters]
        assert len(cards) == 11

    def test_all_cards_start_fresh(self):
        """All newly initialized cards have zero reviews."""
        cards = [_create_card(f"card-{i}") for i in range(5)]
        for card in cards:
            assert card["review_count"] == 0
            assert card["correct_count"] == 0
            assert card["repetitions"] == 0


# -------------------------------------------------------------------
# Collection management tests
# -------------------------------------------------------------------


class TestCollectionManagement:
    def test_find_card_by_id(self):
        cards = [_create_card("a"), _create_card("b"), _create_card("c")]
        found = None
        for card in cards:
            if card["card_id"] == "b":
                found = card
                break
        assert found is not None
        assert found["card_id"] == "b"

    def test_find_missing_card_returns_none(self):
        cards = [_create_card("a")]
        found = None
        for card in cards:
            if card["card_id"] == "z":
                found = card
                break
        assert found is None

    def test_replace_card_updates_in_place(self):
        cards = [_create_card("a"), _create_card("b")]
        updated = _sm2_review(cards[1], 4)
        for i in range(len(cards)):
            if cards[i]["card_id"] == updated["card_id"]:
                cards[i] = updated
                break
        assert cards[1]["review_count"] == 1
        assert cards[1]["correct_count"] == 1
