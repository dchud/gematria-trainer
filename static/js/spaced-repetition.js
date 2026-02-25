/**
 * Spaced repetition module (SM-2 algorithm).
 *
 * Implements card state management and the SM-2 scheduling algorithm
 * with minute-based intervals (suitable for single-session learning).
 * Attaches all functions to the global SpacedRepetition object.
 *
 * No import/export, no arrow functions, no let/const.
 */

var SpacedRepetition = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------

    var DEFAULT_EASE = 2.5;
    var MIN_EASE = 1.3;

    /**
     * Quality values mapped from user-facing rating buttons.
     *
     * Wrong  -> q=1 (incorrect answer)
     * Unsure -> q=3 (correct, low confidence)
     * Good   -> q=4 (correct, high confidence)
     * Easy   -> q=5 (correct, instant recall)
     */
    var QUALITY = {
        wrong: 1,
        unsure: 3,
        good: 4,
        easy: 5,
    };

    // ---------------------------------------------------------------
    // Card state
    // ---------------------------------------------------------------

    /**
     * Create a new card state object with default values.
     *
     * @param {string} cardId - Stable card identifier.
     * @returns {object} Card state ready for first review.
     */
    function createCard(cardId) {
        return {
            card_id: cardId,
            ease_factor: DEFAULT_EASE,
            interval_minutes: 1,
            repetitions: 0,
            next_review: new Date().toISOString(),
            last_quality: null,
        };
    }

    // ---------------------------------------------------------------
    // SM-2 algorithm
    // ---------------------------------------------------------------

    /**
     * Compute the updated ease factor after a review.
     *
     * Formula: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
     * Result is clamped to a minimum of MIN_EASE (1.3).
     *
     * @param {number} ef - Current ease factor.
     * @param {number} quality - Quality rating (1-5).
     * @returns {number} Updated ease factor.
     */
    function _adjustEase(ef, quality) {
        var delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
        var newEf = ef + delta;
        return newEf < MIN_EASE ? MIN_EASE : newEf;
    }

    /**
     * Update card state after a review.
     *
     * SM-2 rules:
     * - If q < 3 (wrong): reset repetitions to 0, interval to 1 minute.
     * - If q >= 3:
     *   - repetitions 0: interval = 1 minute
     *   - repetitions 1: interval = 6 minutes
     *   - repetitions >= 2: interval = previous interval * ease_factor
     * - Ease factor is always adjusted regardless of quality.
     *
     * Returns a new card state object; does not mutate the input.
     *
     * @param {object} card - Current card state.
     * @param {number} quality - Quality rating (1, 3, 4, or 5).
     * @returns {object} Updated card state.
     */
    function review(card, quality) {
        if (quality !== 1 && quality !== 3 && quality !== 4 && quality !== 5) {
            throw new Error(
                'SpacedRepetition.review: quality must be 1, 3, 4, or 5, got ' + quality,
            );
        }

        var newEf = _adjustEase(card.ease_factor, quality);
        var newInterval, newReps;

        if (quality < 3) {
            // Wrong: reset
            newReps = 0;
            newInterval = 1;
        } else {
            // Correct: advance
            if (card.repetitions === 0) {
                newInterval = 2;
            } else if (card.repetitions === 1) {
                newInterval = 10;
            } else {
                newInterval = Math.round(card.interval_minutes * newEf);
            }
            newReps = card.repetitions + 1;
        }

        var now = new Date();
        var nextReview = new Date(now.getTime() + newInterval * 60 * 1000);

        return {
            card_id: card.card_id,
            ease_factor: newEf,
            interval_minutes: newInterval,
            repetitions: newReps,
            next_review: nextReview.toISOString(),
            last_quality: quality,
        };
    }

    // ---------------------------------------------------------------
    // Scheduling queries
    // ---------------------------------------------------------------

    /**
     * Check if a card is due for review (next_review is in the past).
     *
     * @param {object} card - Card state object.
     * @returns {boolean} True if the card is due.
     */
    function isDue(card) {
        return new Date(card.next_review) <= new Date();
    }

    /**
     * Get the overdue amount in minutes.
     *
     * Positive values mean the card is overdue.
     * Negative values mean the card is not yet due.
     *
     * @param {object} card - Card state object.
     * @returns {number} Minutes overdue (positive) or until due (negative).
     */
    function overdueMinutes(card) {
        var now = Date.now();
        var due = new Date(card.next_review).getTime();
        return (now - due) / (60 * 1000);
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        // Constants
        QUALITY: QUALITY,
        DEFAULT_EASE: DEFAULT_EASE,
        MIN_EASE: MIN_EASE,

        // Card state
        createCard: createCard,

        // SM-2 algorithm
        review: review,

        // Scheduling
        isDue: isDue,
        overdueMinutes: overdueMinutes,
    };
})();
