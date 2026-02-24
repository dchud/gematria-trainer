"""Tests for SM-2 spaced repetition algorithm.

These tests verify the SM-2 algorithm logic as implemented in
static/js/spaced-repetition.js by testing the same rules in Python.
They serve as a reference implementation to catch regressions.
"""

import pytest

# SM-2 constants (matching spaced-repetition.js)
DEFAULT_EASE = 2.5
MIN_EASE = 1.3

QUALITY_WRONG = 1
QUALITY_UNSURE = 3
QUALITY_GOOD = 4
QUALITY_EASY = 5


def adjust_ease(ef, quality):
    """Compute updated ease factor using SM-2 formula."""
    delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    return max(MIN_EASE, ef + delta)


def sm2_review(reps, interval, ef, quality):
    """Apply SM-2 update rules. Returns (new_reps, new_interval, new_ef)."""
    new_ef = adjust_ease(ef, quality)

    if quality < 3:
        return (0, 1, new_ef)

    if reps == 0:
        new_interval = 1
    elif reps == 1:
        new_interval = 6
    else:
        new_interval = round(interval * new_ef)

    return (reps + 1, new_interval, new_ef)


# -------------------------------------------------------------------
# Ease factor adjustment tests
# -------------------------------------------------------------------


class TestEaseFactorAdjustment:
    def test_easy_increases_ef(self):
        new_ef = adjust_ease(DEFAULT_EASE, QUALITY_EASY)
        assert new_ef == pytest.approx(2.6)

    def test_good_keeps_ef(self):
        new_ef = adjust_ease(DEFAULT_EASE, QUALITY_GOOD)
        assert new_ef == pytest.approx(2.5)

    def test_unsure_decreases_ef(self):
        new_ef = adjust_ease(DEFAULT_EASE, QUALITY_UNSURE)
        assert new_ef == pytest.approx(2.36)

    def test_wrong_decreases_ef_more(self):
        new_ef = adjust_ease(DEFAULT_EASE, QUALITY_WRONG)
        assert new_ef == pytest.approx(1.96)

    def test_ef_minimum_clamp(self):
        """Repeated wrong answers should not drop EF below 1.3."""
        ef = MIN_EASE
        new_ef = adjust_ease(ef, QUALITY_WRONG)
        assert new_ef == MIN_EASE

    def test_ef_minimum_after_many_wrongs(self):
        ef = DEFAULT_EASE
        for _ in range(20):
            ef = adjust_ease(ef, QUALITY_WRONG)
        assert ef == MIN_EASE


# -------------------------------------------------------------------
# SM-2 interval progression tests
# -------------------------------------------------------------------


class TestIntervalProgression:
    def test_first_correct_review(self):
        reps, interval, ef = sm2_review(0, 1, DEFAULT_EASE, QUALITY_GOOD)
        assert reps == 1
        assert interval == 1

    def test_second_correct_review(self):
        reps, interval, ef = sm2_review(1, 1, DEFAULT_EASE, QUALITY_GOOD)
        assert reps == 2
        assert interval == 6

    def test_third_correct_review(self):
        reps, interval, ef = sm2_review(2, 6, DEFAULT_EASE, QUALITY_GOOD)
        assert reps == 3
        assert interval == round(6 * DEFAULT_EASE)

    def test_wrong_resets(self):
        reps, interval, ef = sm2_review(5, 100, DEFAULT_EASE, QUALITY_WRONG)
        assert reps == 0
        assert interval == 1

    def test_easy_progression(self):
        """Easy reviews increase EF, leading to longer intervals."""
        reps = 0
        interval = 1
        ef = DEFAULT_EASE

        reps, interval, ef = sm2_review(reps, interval, ef, QUALITY_EASY)
        assert reps == 1

        reps, interval, ef = sm2_review(reps, interval, ef, QUALITY_EASY)
        assert reps == 2

        reps, interval, ef = sm2_review(reps, interval, ef, QUALITY_EASY)
        assert reps == 3
        # EF has increased from 2.5 after two Easy reviews
        assert ef > DEFAULT_EASE
        assert interval > round(6 * DEFAULT_EASE)

    def test_interval_after_wrong_then_recovery(self):
        """After a wrong answer, recovery starts from scratch."""
        reps, interval, ef = sm2_review(3, 30, DEFAULT_EASE, QUALITY_WRONG)
        assert reps == 0
        assert interval == 1

        reps, interval, ef = sm2_review(reps, interval, ef, QUALITY_GOOD)
        assert reps == 1
        assert interval == 1

        reps, interval, ef = sm2_review(reps, interval, ef, QUALITY_GOOD)
        assert reps == 2
        assert interval == 6


# -------------------------------------------------------------------
# Quality value tests
# -------------------------------------------------------------------


class TestQualityValues:
    def test_quality_constants(self):
        assert QUALITY_WRONG == 1
        assert QUALITY_UNSURE == 3
        assert QUALITY_GOOD == 4
        assert QUALITY_EASY == 5

    def test_wrong_always_resets(self):
        for initial_reps in [0, 1, 5, 10]:
            reps, interval, _ = sm2_review(
                initial_reps, 100, DEFAULT_EASE, QUALITY_WRONG
            )
            assert reps == 0
            assert interval == 1

    def test_unsure_advances(self):
        """Unsure (q=3) counts as correct -- advances repetitions."""
        reps, interval, ef = sm2_review(0, 1, DEFAULT_EASE, QUALITY_UNSURE)
        assert reps == 1

    def test_unsure_decreases_ef(self):
        """Unsure reviews reduce ease factor (slower future intervals)."""
        _, _, ef = sm2_review(0, 1, DEFAULT_EASE, QUALITY_UNSURE)
        assert ef < DEFAULT_EASE
