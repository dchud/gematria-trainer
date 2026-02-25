/**
 * Card selection module.
 *
 * Chooses the next card to present based on spaced repetition
 * scheduling. Priority order:
 *   1. Most overdue card (past its next_review time)
 *   2. New (unreviewed) card from the current level
 *   3. If current level is exhausted and mastered, signal advancement
 *
 * Depends on spaced-repetition.js, levels.js, and card-state.js.
 * No import/export, no arrow functions, no let/const.
 */

var CardSelection = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Result types
    // ---------------------------------------------------------------

    /**
     * Result object returned by selectNext().
     *
     * @typedef {object} SelectionResult
     * @property {string} type - "card", "advance", or "review"
     * @property {object|null} card - Selected card state (for "card")
     * @property {object|null} spec - Card spec from Levels (for "card")
     */

    // ---------------------------------------------------------------
    // Selection logic
    // ---------------------------------------------------------------

    /**
     * Select the next card to present.
     *
     * Implements the three-priority card selection algorithm:
     * 1. Find the most overdue card and present it.
     * 2. If no cards are due, present a new (unreviewed) card.
     * 3. If all cards are reviewed and no cards are due, check mastery.
     *
     * @param {object[]} cards - Array of card state objects for the level.
     * @param {object[]} specs - Array of card specs from Levels.getCards().
     * @returns {SelectionResult} What to do next.
     */
    function selectNext(cards, specs) {
        // Build a spec lookup by card_id
        var specMap = {};
        var i;
        for (i = 0; i < specs.length; i++) {
            specMap[specs[i].id] = specs[i];
        }

        // Priority 1: Most overdue card
        var overdueCard = _findMostOverdue(cards);
        if (overdueCard) {
            return {
                type: 'card',
                card: overdueCard,
                spec: specMap[overdueCard.card_id] || null,
            };
        }

        // Priority 2: New card (review_count === 0)
        var newCard = _findNewCard(cards, specs);
        if (newCard) {
            return {
                type: 'card',
                card: newCard.card,
                spec: newCard.spec,
            };
        }

        // Priority 3: All cards reviewed, none due
        // Check if level is mastered
        if (CardState.checkMastery(cards)) {
            return { type: 'advance', card: null, spec: null };
        }

        // Not mastered but nothing due — pick the card due soonest
        var soonest = _findSoonestDue(cards);
        if (soonest) {
            return {
                type: 'card',
                card: soonest,
                spec: specMap[soonest.card_id] || null,
            };
        }

        // Fallback: should not happen with non-empty level
        return { type: 'review', card: null, spec: null };
    }

    /**
     * Select the next card in review mode (all levels completed).
     *
     * In review mode, cards are drawn from all levels. Only overdue
     * cards are presented; if none are overdue, returns null.
     *
     * @param {object[]} allCards - Card states from all levels.
     * @param {object[]} allSpecs - Card specs from all levels.
     * @returns {SelectionResult} Selection result (type "review" if nothing due).
     */
    function selectReview(allCards, allSpecs) {
        var specMap = {};
        var i;
        for (i = 0; i < allSpecs.length; i++) {
            specMap[allSpecs[i].id] = allSpecs[i];
        }

        var overdueCard = _findMostOverdue(allCards);
        if (overdueCard) {
            return {
                type: 'card',
                card: overdueCard,
                spec: specMap[overdueCard.card_id] || null,
            };
        }

        // Nothing due — find soonest
        var soonest = _findSoonestDue(allCards);
        if (soonest) {
            return {
                type: 'card',
                card: soonest,
                spec: specMap[soonest.card_id] || null,
            };
        }

        // All cards reviewed, nothing due — signal review mode idle
        return { type: 'review', card: null, spec: null };
    }

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /**
     * Find the most overdue card (greatest positive overdue time).
     *
     * @param {object[]} cards - Card state array.
     * @returns {object|null} Most overdue card, or null if none are due.
     */
    function _findMostOverdue(cards) {
        var best = null;
        var bestOverdue = 0;
        var i, overdue;

        for (i = 0; i < cards.length; i++) {
            overdue = SpacedRepetition.overdueMinutes(cards[i]);
            if (overdue > 0 && (best === null || overdue > bestOverdue)) {
                best = cards[i];
                bestOverdue = overdue;
            }
        }

        return best;
    }

    /**
     * Find a new (unreviewed) card, matching against the spec order
     * so that cards are introduced in level-defined order.
     *
     * @param {object[]} cards - Card state array.
     * @param {object[]} specs - Card spec array (defines introduction order).
     * @returns {{card: object, spec: object}|null} Card and spec, or null.
     */
    function _findNewCard(cards, specs) {
        var cardMap = {};
        var i;
        for (i = 0; i < cards.length; i++) {
            cardMap[cards[i].card_id] = cards[i];
        }

        for (i = 0; i < specs.length; i++) {
            var card = cardMap[specs[i].id];
            if (card && card.review_count === 0) {
                return { card: card, spec: specs[i] };
            }
        }

        return null;
    }

    /**
     * Find the card that will be due soonest (least negative overdue).
     *
     * @param {object[]} cards - Card state array.
     * @returns {object|null} Card due soonest, or null.
     */
    function _findSoonestDue(cards) {
        var best = null;
        var bestOverdue = -Infinity;
        var i, overdue;

        for (i = 0; i < cards.length; i++) {
            overdue = SpacedRepetition.overdueMinutes(cards[i]);
            if (best === null || overdue > bestOverdue) {
                best = cards[i];
                bestOverdue = overdue;
            }
        }

        return best;
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        selectNext: selectNext,
        selectReview: selectReview,
    };
})();
