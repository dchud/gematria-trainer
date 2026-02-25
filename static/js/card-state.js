/**
 * Card state management module.
 *
 * Extends SpacedRepetition card objects with review tracking (total
 * reviews, correct count) needed for level mastery evaluation. Provides
 * helpers for initializing level card sets, looking up cards, and
 * checking mastery criteria.
 *
 * Depends on spaced-repetition.js and levels.js being loaded first.
 * No import/export, no arrow functions, no let/const.
 */

var CardState = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Card creation and review
    // ---------------------------------------------------------------

    /**
     * Create an extended card state object.
     *
     * Adds review_count and correct_count fields to the base SM-2
     * card for accuracy tracking.
     *
     * @param {string} cardId - Stable card identifier.
     * @returns {object} Extended card state.
     */
    function createCard(cardId) {
        var base = SpacedRepetition.createCard(cardId);
        base.review_count = 0;
        base.correct_count = 0;
        return base;
    }

    /**
     * Update a card after a review.
     *
     * Delegates SM-2 scheduling to SpacedRepetition.review(), then
     * updates the review count and correct count for accuracy tracking.
     * Returns a new card state object; does not mutate the input.
     *
     * @param {object} card - Current card state.
     * @param {number} quality - Quality rating (1, 3, 4, or 5).
     * @returns {object} Updated card state.
     */
    function reviewCard(card, quality) {
        var updated = SpacedRepetition.review(card, quality);
        updated.review_count = card.review_count + 1;
        updated.correct_count = card.correct_count + (quality >= 3 ? 1 : 0);
        return updated;
    }

    // ---------------------------------------------------------------
    // Collection management
    // ---------------------------------------------------------------

    /**
     * Create card states for all cards in a level.
     *
     * Generates card specs from the level definition, then creates an
     * extended card state for each.
     *
     * @param {string} systemKey - Registry key (e.g. "hechrachi").
     * @param {number} levelNumber - Level number (1-based).
     * @returns {object[]} Array of card state objects.
     */
    function initLevel(systemKey, levelNumber) {
        var specs = Levels.getCards(systemKey, levelNumber);
        var cards = [];
        var i;
        for (i = 0; i < specs.length; i++) {
            cards.push(createCard(specs[i].id));
        }
        return cards;
    }

    /**
     * Find a card by its ID in a collection.
     *
     * @param {object[]} cards - Array of card state objects.
     * @param {string} cardId - Card identifier to find.
     * @returns {object|null} Card state or null if not found.
     */
    function findCard(cards, cardId) {
        var i;
        for (i = 0; i < cards.length; i++) {
            if (cards[i].card_id === cardId) return cards[i];
        }
        return null;
    }

    /**
     * Replace a card in a collection with an updated version.
     *
     * Matches by card_id. If the card is not found, does nothing.
     *
     * @param {object[]} cards - Array of card state objects (mutated).
     * @param {object} updatedCard - Card state with updated fields.
     */
    function replaceCard(cards, updatedCard) {
        var i;
        for (i = 0; i < cards.length; i++) {
            if (cards[i].card_id === updatedCard.card_id) {
                cards[i] = updatedCard;
                return;
            }
        }
    }

    // ---------------------------------------------------------------
    // Level mastery evaluation (T3.8)
    // ---------------------------------------------------------------

    /**
     * Compute the accuracy for a set of cards.
     *
     * Accuracy = total correct reviews / total reviews across all cards.
     * Returns 0 if no reviews have been recorded.
     *
     * @param {object[]} cards - Array of card state objects.
     * @returns {number} Accuracy as a decimal (0.0 to 1.0).
     */
    function levelAccuracy(cards) {
        var totalReviews = 0;
        var totalCorrect = 0;
        var i;

        for (i = 0; i < cards.length; i++) {
            totalReviews += cards[i].review_count;
            totalCorrect += cards[i].correct_count;
        }

        return totalReviews > 0 ? totalCorrect / totalReviews : 0;
    }

    /**
     * Check if all cards in a level meet mastery criteria.
     *
     * Mastery requires:
     * 1. Every card has been reviewed at least MASTERY.minReps times.
     * 2. Level-wide accuracy is at least MASTERY.accuracy (80%).
     *
     * @param {object[]} cards - Array of card state objects.
     * @returns {boolean} True if mastery criteria are met.
     */
    function checkMastery(cards) {
        if (cards.length === 0) return false;

        var minReps = Levels.MASTERY.minReps;
        var i;

        // Check minimum reviews per card
        for (i = 0; i < cards.length; i++) {
            if (cards[i].review_count < minReps) return false;
        }

        // Check level-wide accuracy
        return levelAccuracy(cards) >= Levels.MASTERY.accuracy;
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        // Card lifecycle
        createCard: createCard,
        reviewCard: reviewCard,

        // Collection management
        initLevel: initLevel,
        findCard: findCard,
        replaceCard: replaceCard,

        // Mastery evaluation
        levelAccuracy: levelAccuracy,
        checkMastery: checkMastery,
    };
})();
