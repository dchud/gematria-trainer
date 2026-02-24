/**
 * Placement assessment module.
 *
 * Manages a step-based assessment that determines which tier a user
 * should start at for a given gematria system. Presents cards from
 * progressively harder tiers; a single miss at any step places the
 * user at that tier.
 *
 * Step definitions per system type:
 *   - 8-tier (hechrachi, gadol): 4 steps testing T1-T4
 *   - 4-tier (katan, siduri): 3 steps testing T1-T3
 *   - 3-tier (ciphers): 2 steps testing T1-T2
 *
 * Depends on tiers.js being loaded first.
 * No import/export, no arrow functions, no let/const. Requires ES2022+.
 */

var Placement = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Step definitions
    // ---------------------------------------------------------------

    var STEPS_8_TIER = [
        { tier: 1, count: 3 },
        { tier: 2, count: 3 },
        { tier: 3, count: 3 },
        { tier: 4, count: 3 },
    ];

    var STEPS_4_TIER = [
        { tier: 1, count: 3 },
        { tier: 2, count: 3 },
        { tier: 3, count: 3 },
    ];

    var STEPS_3_TIER = [
        { tier: 1, count: 3 },
        { tier: 2, count: 3 },
    ];

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /**
     * Get the step sequence for a system based on its tier count.
     *
     * @param {string} systemKey - Registry key.
     * @returns {object[]} Array of step definitions.
     */
    function _stepsForSystem(systemKey) {
        var count = Tiers.tierCount(systemKey);
        if (count === 8) return STEPS_8_TIER;
        if (count === 4) return STEPS_4_TIER;
        if (count === 3) return STEPS_3_TIER;
        return [];
    }

    /**
     * Pick N random card specs from a tier.
     *
     * Uses Fisher-Yates shuffle to select without bias. If the tier
     * has fewer specs than requested, returns all of them.
     *
     * @param {string} systemKey - Registry key.
     * @param {number} tier - Tier number.
     * @param {number} count - Number of cards to pick.
     * @returns {object[]} Array of card spec objects.
     */
    function _pickCards(systemKey, tier, count) {
        var specs = Tiers.getCards(systemKey, tier);
        if (specs.length <= count) return specs.slice();

        // Fisher-Yates shuffle on a copy
        var shuffled = specs.slice();
        var i, j, tmp;
        for (i = shuffled.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
        }
        return shuffled.slice(0, count);
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        /**
         * Create a new placement assessment state.
         *
         * @param {string} systemKey - Registry key.
         * @returns {object} Placement state.
         */
        create: function (systemKey) {
            var steps = _stepsForSystem(systemKey);
            var cards =
                steps.length > 0 ? _pickCards(systemKey, steps[0].tier, steps[0].count) : [];

            return {
                system: systemKey,
                steps: steps,
                currentStep: 0,
                cardIndex: 0,
                cards: cards,
                responses: [],
                done: false,
                startTier: null,
            };
        },

        /**
         * Get the current card spec to present.
         *
         * @param {object} state - Placement state.
         * @returns {object|null} Card spec or null if assessment is done.
         */
        currentCard: function (state) {
            if (state.done || state.cardIndex >= state.cards.length) return null;
            return state.cards[state.cardIndex];
        },

        /**
         * Record a response and advance the assessment.
         *
         * A single incorrect response ends the assessment and places
         * the user at the current step's tier. All correct responses
         * in a step advance to the next step. Completing all steps
         * places the user at the tier after the last tested tier
         * (capped at tier count).
         *
         * @param {object} state - Placement state (mutated).
         * @param {boolean} correct - Whether the response was correct.
         * @returns {object} Result: {done: boolean, startTier?: number}.
         */
        recordResponse: function (state, correct) {
            state.responses.push(correct);

            if (!correct) {
                // Failed — place at this step's tier
                state.done = true;
                state.startTier = state.steps[state.currentStep].tier;
                return { done: true, startTier: state.startTier };
            }

            state.cardIndex++;

            if (state.cardIndex >= state.cards.length) {
                // Completed this step successfully — advance
                state.currentStep++;
                state.cardIndex = 0;
                state.responses = [];

                if (state.currentStep >= state.steps.length) {
                    // Passed all steps
                    var lastTier = state.steps[state.steps.length - 1].tier;
                    var tierCount = Tiers.tierCount(state.system);
                    state.startTier = Math.min(lastTier + 1, tierCount);
                    state.done = true;
                    return { done: true, startTier: state.startTier };
                }

                // Load cards for next step
                var nextStep = state.steps[state.currentStep];
                state.cards = _pickCards(state.system, nextStep.tier, nextStep.count);
            }

            return { done: false };
        },

        /**
         * Check if the assessment is complete.
         *
         * @param {object} state - Placement state.
         * @returns {boolean} True if assessment is done.
         */
        isComplete: function (state) {
            return state.done;
        },

        /**
         * Get the result tier (only valid after completion).
         *
         * @param {object} state - Placement state.
         * @returns {number|null} Starting tier or null if not done.
         */
        result: function (state) {
            return state.startTier;
        },
    };
})();
