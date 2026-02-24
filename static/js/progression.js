/**
 * Tier progression module.
 *
 * Manages the user's current tier within a gematria system, handles
 * tier advancement when mastery criteria are met, and manages the
 * completion/review mode when all tiers are mastered.
 *
 * Depends on tiers.js, card-state.js, storage.js, and card-selection.js.
 * No import/export, no arrow functions, no let/const. Requires ES2022+ (Object.hasOwn).
 */

var Progression = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // State shape
    // ---------------------------------------------------------------

    /**
     * Create a new progression state object for a system.
     *
     * @param {string} systemKey - Registry key (e.g. "hechrachi").
     * @returns {object} Progression state.
     */
    function createState(systemKey) {
        var tierCount = Tiers.tierCount(systemKey);
        return {
            system: systemKey,
            currentTier: 1,
            tierCount: tierCount,
            completed: false,
            // Card states keyed by tier number (1-based)
            tiers: {},
        };
    }

    /**
     * Load or create progression state for a system.
     *
     * Tries to load saved progress from localStorage. If none exists,
     * creates a fresh state starting at tier 1.
     *
     * @param {string} systemKey - Registry key.
     * @returns {object} Progression state.
     */
    function loadOrCreate(systemKey) {
        var saved = Storage.loadProgress(systemKey);
        if (saved && saved.system === systemKey) {
            return saved;
        }
        return createState(systemKey);
    }

    /**
     * Save progression state to localStorage.
     *
     * @param {object} state - Progression state.
     * @returns {boolean} True if save succeeded.
     */
    function save(state) {
        return Storage.saveProgress(state.system, state);
    }

    // ---------------------------------------------------------------
    // Tier card management
    // ---------------------------------------------------------------

    /**
     * Ensure card states exist for a tier in the progression state.
     *
     * If the tier's cards haven't been initialized yet, creates them.
     * Returns the card state array for the tier.
     *
     * @param {object} state - Progression state (mutated).
     * @param {number} tierNumber - Tier to ensure.
     * @returns {object[]} Card state array for the tier.
     */
    function ensureTierCards(state, tierNumber) {
        var key = String(tierNumber);
        if (!state.tiers[key]) {
            state.tiers[key] = CardState.initTier(state.system, tierNumber);
        }
        return state.tiers[key];
    }

    /**
     * Get card states for the current tier.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Card state array.
     */
    function currentTierCards(state) {
        return ensureTierCards(state, state.currentTier);
    }

    /**
     * Get card specs for the current tier.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Card spec array.
     */
    function currentTierSpecs(state) {
        return Tiers.getCards(state.system, state.currentTier);
    }

    /**
     * Get all card states across all initialized tiers.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Combined card state array.
     */
    function allCards(state) {
        var cards = [];
        var key;
        for (key in state.tiers) {
            if (Object.hasOwn(state.tiers, key)) {
                cards = cards.concat(state.tiers[key]);
            }
        }
        return cards;
    }

    /**
     * Get all card specs across all tiers up to the current tier.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Combined card spec array.
     */
    function allSpecs(state) {
        var specs = [];
        var tier;
        for (tier = 1; tier <= state.currentTier; tier++) {
            specs = specs.concat(Tiers.getCards(state.system, tier));
        }
        return specs;
    }

    // ---------------------------------------------------------------
    // Tier advancement
    // ---------------------------------------------------------------

    /**
     * Check if the current tier is mastered and advance if possible.
     *
     * Returns an object describing what happened:
     *   - { advanced: true, newTier: N } if advanced to tier N
     *   - { advanced: false, completed: true } if all tiers mastered
     *   - { advanced: false, completed: false } if not yet mastered
     *
     * @param {object} state - Progression state (mutated on advance).
     * @returns {object} Advancement result.
     */
    function tryAdvance(state) {
        var cards = currentTierCards(state);

        if (!CardState.checkMastery(cards)) {
            return { advanced: false, completed: false };
        }

        // Current tier is mastered — check if there's a next static tier
        var nextTier = state.currentTier + 1;
        if (nextTier > state.tierCount || !Tiers.isStatic(state.system, nextTier)) {
            // No more tiers, or next tier is procedural (not yet implemented)
            state.completed = true;
            return { advanced: false, completed: true };
        }

        // Advance to next tier
        state.currentTier = nextTier;
        ensureTierCards(state, state.currentTier);
        return { advanced: true, newTier: state.currentTier };
    }

    // ---------------------------------------------------------------
    // Card selection integration
    // ---------------------------------------------------------------

    /**
     * Select the next card to present for this progression.
     *
     * In normal mode, selects from the current tier.
     * In completed/review mode, selects from all tiers.
     *
     * @param {object} state - Progression state.
     * @returns {object} SelectionResult from CardSelection.
     */
    function nextCard(state) {
        if (state.completed) {
            return CardSelection.selectReview(allCards(state), allSpecs(state));
        }

        var cards = currentTierCards(state);
        var specs = currentTierSpecs(state);
        return CardSelection.selectNext(cards, specs);
    }

    /**
     * Record a review for a card and update the progression state.
     *
     * Updates the card's state, checks for tier advancement, and
     * saves to localStorage.
     *
     * @param {object} state - Progression state (mutated).
     * @param {string} cardId - Card that was reviewed.
     * @param {number} quality - Quality rating (1, 3, 4, or 5).
     * @returns {object} Result with { card, advancement }.
     */
    function recordReview(state, cardId, quality) {
        // Find the card in the appropriate tier
        var card = null;
        var tierCards = null;
        var key;

        for (key in state.tiers) {
            if (Object.hasOwn(state.tiers, key)) {
                card = CardState.findCard(state.tiers[key], cardId);
                if (card) {
                    tierCards = state.tiers[key];
                    break;
                }
            }
        }

        if (!card) {
            return { card: null, advancement: null };
        }

        // Update the card
        var updated = CardState.reviewCard(card, quality);
        CardState.replaceCard(tierCards, updated);

        // Check for tier advancement
        var advancement = tryAdvance(state);

        // Persist
        save(state);

        return { card: updated, advancement: advancement };
    }

    // ---------------------------------------------------------------
    // Reset
    // ---------------------------------------------------------------

    /**
     * Reset progression for a system (start from scratch).
     *
     * Clears all card states and returns to tier 1.
     *
     * @param {string} systemKey - Registry key.
     * @returns {object} Fresh progression state.
     */
    function reset(systemKey) {
        var state = createState(systemKey);
        save(state);
        return state;
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        // State lifecycle
        createState: createState,
        loadOrCreate: loadOrCreate,
        save: save,
        reset: reset,

        // Tier card management
        ensureTierCards: ensureTierCards,
        currentTierCards: currentTierCards,
        currentTierSpecs: currentTierSpecs,
        allCards: allCards,
        allSpecs: allSpecs,

        // Advancement
        tryAdvance: tryAdvance,

        // Card flow
        nextCard: nextCard,
        recordReview: recordReview,
    };
})();
