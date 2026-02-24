"""Tests for card selection logic.

These tests verify the card selection algorithm as implemented in
static/js/card-selection.js by testing the same rules in Python.
"""

from datetime import UTC, datetime, timedelta

# -------------------------------------------------------------------
# Reference implementation (matches card-selection.js)
# -------------------------------------------------------------------

DEFAULT_EASE = 2.5


def _create_card(
    card_id, next_review=None, review_count=0, correct_count=0, repetitions=0
):
    if next_review is None:
        next_review = datetime.now(tz=UTC).isoformat()
    return {
        "card_id": card_id,
        "ease_factor": DEFAULT_EASE,
        "interval_minutes": 1,
        "repetitions": repetitions,
        "next_review": next_review,
        "last_quality": None,
        "review_count": review_count,
        "correct_count": correct_count,
    }


def _make_spec(card_id):
    return {"id": card_id, "type": "letter-to-value", "prompt": "?", "answer": "?"}


def _overdue_minutes(card):
    now = datetime.now(tz=UTC)
    due = datetime.fromisoformat(card["next_review"])
    if due.tzinfo is None:
        due = due.replace(tzinfo=UTC)
    return (now - due).total_seconds() / 60


def _find_most_overdue(cards):
    best = None
    best_overdue = 0
    for card in cards:
        overdue = _overdue_minutes(card)
        if overdue > 0 and (best is None or overdue > best_overdue):
            best = card
            best_overdue = overdue
    return best


def _find_new_card(cards, specs):
    card_map = {c["card_id"]: c for c in cards}
    for spec in specs:
        card = card_map.get(spec["id"])
        if card and card["review_count"] == 0:
            return {"card": card, "spec": spec}
    return None


def _find_soonest_due(cards):
    best = None
    best_overdue = float("-inf")
    for card in cards:
        overdue = _overdue_minutes(card)
        if best is None or overdue > best_overdue:
            best = card
            best_overdue = overdue
    return best


def _check_mastery(cards, min_reps=3, accuracy=0.8):
    if not cards:
        return False
    for card in cards:
        if card["review_count"] < min_reps:
            return False
    total_reviews = sum(c["review_count"] for c in cards)
    total_correct = sum(c["correct_count"] for c in cards)
    return total_reviews > 0 and (total_correct / total_reviews) >= accuracy


def select_next(cards, specs):
    overdue = _find_most_overdue(cards)
    if overdue:
        spec_map = {s["id"]: s for s in specs}
        return {
            "type": "card",
            "card": overdue,
            "spec": spec_map.get(overdue["card_id"]),
        }

    new = _find_new_card(cards, specs)
    if new:
        return {"type": "card", "card": new["card"], "spec": new["spec"]}

    if _check_mastery(cards):
        return {"type": "advance", "card": None, "spec": None}

    soonest = _find_soonest_due(cards)
    if soonest:
        spec_map = {s["id"]: s for s in specs}
        return {
            "type": "card",
            "card": soonest,
            "spec": spec_map.get(soonest["card_id"]),
        }

    return {"type": "review", "card": None, "spec": None}


# -------------------------------------------------------------------
# Tests
# -------------------------------------------------------------------


def _past_time(minutes_ago):
    return (datetime.now(tz=UTC) - timedelta(minutes=minutes_ago)).isoformat()


def _future_time(minutes_ahead):
    return (datetime.now(tz=UTC) + timedelta(minutes=minutes_ahead)).isoformat()


class TestOverdueSelection:
    def test_selects_overdue_card(self):
        cards = [
            _create_card("a", next_review=_past_time(5), review_count=1),
            _create_card("b", next_review=_future_time(10), review_count=1),
        ]
        specs = [_make_spec("a"), _make_spec("b")]
        result = select_next(cards, specs)
        assert result["type"] == "card"
        assert result["card"]["card_id"] == "a"

    def test_selects_most_overdue(self):
        cards = [
            _create_card("a", next_review=_past_time(5), review_count=1),
            _create_card("b", next_review=_past_time(10), review_count=1),
            _create_card("c", next_review=_past_time(1), review_count=1),
        ]
        specs = [_make_spec("a"), _make_spec("b"), _make_spec("c")]
        result = select_next(cards, specs)
        assert result["type"] == "card"
        assert result["card"]["card_id"] == "b"


class TestNewCardSelection:
    def test_selects_new_card_when_none_overdue(self):
        cards = [
            _create_card("a", next_review=_future_time(10), review_count=1),
            _create_card("b", next_review=_future_time(10), review_count=0),
        ]
        specs = [_make_spec("a"), _make_spec("b")]
        result = select_next(cards, specs)
        assert result["type"] == "card"
        assert result["card"]["card_id"] == "b"

    def test_new_cards_follow_spec_order(self):
        """New cards are introduced in the order defined by specs."""
        cards = [
            _create_card("a", next_review=_future_time(10), review_count=1),
            _create_card("b", next_review=_future_time(10), review_count=0),
            _create_card("c", next_review=_future_time(10), review_count=0),
        ]
        specs = [_make_spec("a"), _make_spec("b"), _make_spec("c")]
        result = select_next(cards, specs)
        assert result["card"]["card_id"] == "b"  # First unreviewed in spec order

    def test_overdue_takes_priority_over_new(self):
        cards = [
            _create_card("a", next_review=_past_time(5), review_count=1),
            _create_card("b", next_review=_future_time(10), review_count=0),
        ]
        specs = [_make_spec("a"), _make_spec("b")]
        result = select_next(cards, specs)
        assert result["card"]["card_id"] == "a"


class TestAdvancementSignal:
    def test_signals_advance_when_mastered(self):
        cards = [
            _create_card(
                "a",
                next_review=_future_time(10),
                review_count=3,
                correct_count=3,
                repetitions=3,
            ),
            _create_card(
                "b",
                next_review=_future_time(10),
                review_count=3,
                correct_count=3,
                repetitions=3,
            ),
        ]
        specs = [_make_spec("a"), _make_spec("b")]
        result = select_next(cards, specs)
        assert result["type"] == "advance"

    def test_no_advance_when_not_mastered(self):
        cards = [
            _create_card(
                "a",
                next_review=_future_time(10),
                review_count=3,
                correct_count=3,
                repetitions=3,
            ),
            _create_card(
                "b",
                next_review=_future_time(10),
                review_count=1,
                correct_count=1,
                repetitions=1,
            ),
        ]
        specs = [_make_spec("a"), _make_spec("b")]
        result = select_next(cards, specs)
        assert result["type"] == "card"
        # Should present soonest-due card since all are reviewed but not mastered


class TestSoonestDueFallback:
    def test_picks_soonest_when_all_reviewed_not_mastered(self):
        cards = [
            _create_card(
                "a", next_review=_future_time(30), review_count=2, correct_count=2
            ),
            _create_card(
                "b", next_review=_future_time(5), review_count=2, correct_count=2
            ),
        ]
        specs = [_make_spec("a"), _make_spec("b")]
        result = select_next(cards, specs)
        assert result["type"] == "card"
        assert result["card"]["card_id"] == "b"  # Due sooner


class TestSpecMapping:
    def test_result_includes_matching_spec(self):
        cards = [
            _create_card("a", next_review=_past_time(5), review_count=1),
        ]
        specs = [_make_spec("a")]
        result = select_next(cards, specs)
        assert result["spec"] is not None
        assert result["spec"]["id"] == "a"
