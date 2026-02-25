/**
 * Level progression module.
 *
 * Manages the user's current level within a gematria system, handles
 * level advancement when mastery criteria are met, and manages the
 * completion/review mode when all levels are mastered.
 *
 * Depends on levels.js, card-state.js, storage.js, and card-selection.js.
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
        var levelCount = Levels.levelCount(systemKey);
        return {
            system: systemKey,
            currentLevel: 1,
            levelCount: levelCount,
            completed: false,
            // Card states keyed by level number (1-based)
            levels: {},
            // Seeds for procedural levels (8-level systems only)
            seeds: Generator.generateSeeds(systemKey),
            // Cached specs for procedural levels
            levelSpecs: {},
            // Review log for progress tracking
            reviewLog: [],
        };
    }

    /**
     * Load or create progression state for a system.
     *
     * Tries to load saved progress from localStorage. If none exists,
     * creates a fresh state starting at level 1.
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
    // Level card management
    // ---------------------------------------------------------------

    /**
     * Ensure card states exist for a level in the progression state.
     *
     * If the level's cards haven't been initialized yet, creates them.
     * Returns the card state array for the level.
     *
     * @param {object} state - Progression state (mutated).
     * @param {number} levelNumber - Level to ensure.
     * @returns {object[]} Card state array for the level.
     */
    function ensureLevelCards(state, levelNumber) {
        var key = String(levelNumber);
        if (!state.levels[key]) {
            if (Levels.isStatic(state.system, levelNumber)) {
                state.levels[key] = CardState.initLevel(state.system, levelNumber);
            } else {
                // Procedural level — generate and cache specs, then init cards
                var seed = state.seeds?.[levelNumber];
                if (seed !== undefined) {
                    var specs = Generator.generateLevel(state.system, levelNumber, seed);
                    if (!state.levelSpecs) state.levelSpecs = {};
                    state.levelSpecs[key] = specs;
                    // Create card states from generated specs
                    var cards = [];
                    var i;
                    for (i = 0; i < specs.length; i++) {
                        cards.push(CardState.createCard(specs[i].id));
                    }
                    state.levels[key] = cards;
                } else {
                    state.levels[key] = [];
                }
            }
        }
        return state.levels[key];
    }

    /**
     * Get card states for the current level.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Card state array.
     */
    function currentLevelCards(state) {
        return ensureLevelCards(state, state.currentLevel);
    }

    /**
     * Get card specs for the current level.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Card spec array.
     */
    function currentLevelSpecs(state) {
        var key = String(state.currentLevel);
        if (state.levelSpecs?.[key]) {
            return state.levelSpecs[key];
        }
        return Levels.getCards(state.system, state.currentLevel);
    }

    /**
     * Get all card states across all initialized levels.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Combined card state array.
     */
    function allCards(state) {
        var cards = [];
        var key;
        for (key in state.levels) {
            if (Object.hasOwn(state.levels, key)) {
                cards = cards.concat(state.levels[key]);
            }
        }
        return cards;
    }

    /**
     * Get all card specs across all levels up to the current level.
     *
     * @param {object} state - Progression state.
     * @returns {object[]} Combined card spec array.
     */
    function allSpecs(state) {
        var specs = [];
        var level, key;
        for (level = 1; level <= state.currentLevel; level++) {
            key = String(level);
            if (state.levelSpecs?.[key]) {
                specs = specs.concat(state.levelSpecs[key]);
            } else {
                specs = specs.concat(Levels.getCards(state.system, level));
            }
        }
        return specs;
    }

    // ---------------------------------------------------------------
    // Level advancement
    // ---------------------------------------------------------------

    /**
     * Check if the current level is mastered and advance if possible.
     *
     * Returns an object describing what happened:
     *   - { advanced: true, newLevel: N } if advanced to level N
     *   - { advanced: false, completed: true } if all levels mastered
     *   - { advanced: false, completed: false } if not yet mastered
     *
     * @param {object} state - Progression state (mutated on advance).
     * @returns {object} Advancement result.
     */
    function tryAdvance(state) {
        var cards = currentLevelCards(state);

        if (!CardState.checkMastery(cards)) {
            return { advanced: false, completed: false };
        }

        // Current level is mastered — check if there's a next level
        var nextLevel = state.currentLevel + 1;
        if (nextLevel > state.levelCount) {
            state.completed = true;
            return { advanced: false, completed: true };
        }

        // Advance to next level
        state.currentLevel = nextLevel;
        ensureLevelCards(state, state.currentLevel);
        return { advanced: true, newLevel: state.currentLevel };
    }

    // ---------------------------------------------------------------
    // Card selection integration
    // ---------------------------------------------------------------

    /**
     * Select the next card to present for this progression.
     *
     * In normal mode, selects from the current level.
     * In completed/review mode, selects from all levels.
     *
     * @param {object} state - Progression state.
     * @returns {object} SelectionResult from CardSelection.
     */
    function nextCard(state) {
        if (state.completed) {
            return CardSelection.selectReview(allCards(state), allSpecs(state));
        }

        var cards = currentLevelCards(state);
        var specs = currentLevelSpecs(state);
        return CardSelection.selectNext(cards, specs);
    }

    /**
     * Record a review for a card and update the progression state.
     *
     * Updates the card's state, checks for level advancement, and
     * saves to localStorage.
     *
     * @param {object} state - Progression state (mutated).
     * @param {string} cardId - Card that was reviewed.
     * @param {number} quality - Quality rating (1, 3, 4, or 5).
     * @returns {object} Result with { card, advancement }.
     */
    function recordReview(state, cardId, quality) {
        // Find the card in the appropriate level
        var card = null;
        var levelCards = null;
        var key;

        for (key in state.levels) {
            if (Object.hasOwn(state.levels, key)) {
                card = CardState.findCard(state.levels[key], cardId);
                if (card) {
                    levelCards = state.levels[key];
                    break;
                }
            }
        }

        if (!card) {
            return { card: null, advancement: null };
        }

        // Update the card
        var updated = CardState.reviewCard(card, quality);
        CardState.replaceCard(levelCards, updated);

        // Append to review log
        if (!state.reviewLog) state.reviewLog = [];
        state.reviewLog.push({
            ts: Date.now(),
            correct: quality >= 3,
        });
        // Cap at 500 entries
        if (state.reviewLog.length > 500) {
            state.reviewLog.shift();
        }

        // Check for level advancement
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
     * Clears all card states and returns to level 1.
     *
     * @param {string} systemKey - Registry key.
     * @returns {object} Fresh progression state.
     */
    function reset(systemKey) {
        var state = createState(systemKey);
        // createState already calls Generator.generateSeeds for new seeds
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

        // Level card management
        ensureLevelCards: ensureLevelCards,
        currentLevelCards: currentLevelCards,
        currentLevelSpecs: currentLevelSpecs,
        allCards: allCards,
        allSpecs: allSpecs,

        // Advancement
        tryAdvance: tryAdvance,

        // Card flow
        nextCard: nextCard,
        recordReview: recordReview,
    };
})();
