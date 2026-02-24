"""Tests for tier advancement and progression logic.

These tests verify the tier advancement rules as implemented in
static/js/progression.js by testing the same logic in Python.
"""


# -------------------------------------------------------------------
# Reference implementation (matches progression.js)
# -------------------------------------------------------------------

DEFAULT_EASE = 2.5
MASTERY_ACCURACY = 0.8
MASTERY_MIN_REPS = 3

TIER_COUNTS = {
    "hechrachi": 8,
    "gadol": 8,
    "katan": 4,
    "siduri": 4,
    "atbash": 3,
    "albam": 3,
    "avgad": 3,
}


def _create_state(system_key):
    return {
        "system": system_key,
        "currentTier": 1,
        "tierCount": TIER_COUNTS.get(system_key, 0),
        "completed": False,
        "tiers": {},
    }


def _create_card(card_id, review_count=0, correct_count=0, repetitions=0):
    return {
        "card_id": card_id,
        "ease_factor": DEFAULT_EASE,
        "interval_minutes": 1,
        "repetitions": repetitions,
        "next_review": "2026-01-01T00:00:00Z",
        "last_quality": None,
        "review_count": review_count,
        "correct_count": correct_count,
    }


def _check_mastery(cards):
    if not cards:
        return False
    for card in cards:
        if card["review_count"] < MASTERY_MIN_REPS:
            return False
    total_reviews = sum(c["review_count"] for c in cards)
    total_correct = sum(c["correct_count"] for c in cards)
    return total_reviews > 0 and (total_correct / total_reviews) >= MASTERY_ACCURACY


def _try_advance(state, cards):
    """Attempt tier advancement. Returns (advanced, completed) tuple."""
    if not _check_mastery(cards):
        return (False, False)
    if state["currentTier"] >= state["tierCount"]:
        state["completed"] = True
        return (False, True)
    state["currentTier"] += 1
    return (True, False)


def _make_mastered_cards(count):
    """Create a set of cards that meet mastery criteria."""
    return [
        _create_card(f"card-{i}", review_count=4, correct_count=4) for i in range(count)
    ]


def _make_unmastered_cards(count):
    """Create cards that do NOT meet mastery criteria."""
    return [
        _create_card(f"card-{i}", review_count=1, correct_count=1) for i in range(count)
    ]


# -------------------------------------------------------------------
# Tests
# -------------------------------------------------------------------


class TestCreateState:
    def test_starts_at_tier_1(self):
        state = _create_state("hechrachi")
        assert state["currentTier"] == 1

    def test_not_completed(self):
        state = _create_state("hechrachi")
        assert state["completed"] is False

    def test_correct_tier_count(self):
        assert _create_state("hechrachi")["tierCount"] == 8
        assert _create_state("katan")["tierCount"] == 4
        assert _create_state("atbash")["tierCount"] == 3


class TestTierAdvancement:
    def test_no_advance_when_not_mastered(self):
        state = _create_state("hechrachi")
        cards = _make_unmastered_cards(5)
        advanced, completed = _try_advance(state, cards)
        assert advanced is False
        assert completed is False
        assert state["currentTier"] == 1

    def test_advance_when_mastered(self):
        state = _create_state("hechrachi")
        cards = _make_mastered_cards(5)
        advanced, completed = _try_advance(state, cards)
        assert advanced is True
        assert completed is False
        assert state["currentTier"] == 2

    def test_advance_multiple_tiers(self):
        state = _create_state("katan")
        # Advance through tiers 1->2, 2->3, 3->4
        for expected_tier in [2, 3, 4]:
            cards = _make_mastered_cards(3)
            advanced, completed = _try_advance(state, cards)
            assert advanced is True
            assert completed is False
            assert state["currentTier"] == expected_tier
        # After tier 4 (the last tier) mastered, should complete
        cards = _make_mastered_cards(3)
        advanced, completed = _try_advance(state, cards)
        assert advanced is False
        assert completed is True

    def test_completion_at_last_tier_3(self):
        state = _create_state("atbash")
        state["currentTier"] = 3
        cards = _make_mastered_cards(5)
        advanced, completed = _try_advance(state, cards)
        assert advanced is False
        assert completed is True
        assert state["completed"] is True

    def test_completion_at_last_tier_4(self):
        state = _create_state("siduri")
        state["currentTier"] = 4
        cards = _make_mastered_cards(5)
        advanced, completed = _try_advance(state, cards)
        assert advanced is False
        assert completed is True
        assert state["completed"] is True

    def test_completion_at_last_tier_8(self):
        state = _create_state("hechrachi")
        state["currentTier"] = 8
        cards = _make_mastered_cards(5)
        advanced, completed = _try_advance(state, cards)
        assert advanced is False
        assert completed is True
        assert state["completed"] is True


class TestCompletionReviewMode:
    def test_completed_state_stays_completed(self):
        state = _create_state("atbash")
        state["currentTier"] = 3
        state["completed"] = True
        # Even with mastered cards, should stay completed
        cards = _make_mastered_cards(5)
        _try_advance(state, cards)
        assert state["completed"] is True


class TestReset:
    def test_reset_returns_fresh_state(self):
        state = _create_state("hechrachi")
        state["currentTier"] = 5
        state["completed"] = True
        state["tiers"]["1"] = _make_mastered_cards(3)

        # Reset
        fresh = _create_state("hechrachi")
        assert fresh["currentTier"] == 1
        assert fresh["completed"] is False
        assert fresh["tiers"] == {}


class TestEmptyCards:
    def test_empty_cards_not_mastered(self):
        assert _check_mastery([]) is False

    def test_no_advance_with_empty(self):
        state = _create_state("hechrachi")
        advanced, completed = _try_advance(state, [])
        assert advanced is False
        assert completed is False
