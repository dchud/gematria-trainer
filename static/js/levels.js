/**
 * Level definitions for all gematria system types.
 *
 * Defines the card sets, mastery criteria, and level structure for each
 * system category:
 *   - 8-level: Mispar Hechrachi, Mispar Gadol
 *   - 4-level: Mispar Katan, Mispar Siduri
 *   - 3-level: Atbash, Albam, Avgad (ciphers)
 *
 * Each level generates an array of card specs with stable IDs suitable
 * for use as spaced repetition card identifiers.
 *
 * Depends on gematria.js and registry.js being loaded first.
 * No import/export, no arrow functions, no let/const. Requires ES2022+ (Object.hasOwn).
 */

var Levels = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------

    /** Hebrew letter labels for each level (1-indexed). */
    var LEVEL_LABELS = [
        '',
        '\u05D0',
        '\u05D1',
        '\u05D2',
        '\u05D3',
        '\u05D4',
        '\u05D5',
        '\u05D6',
        '\u05D7',
    ];
    //                      א          ב          ג          ד
    //                      ה          ו          ז          ח

    /** Mastery criteria: 80% accuracy with at least 3 reps per card. */
    var MASTERY = {
        accuracy: 0.8,
        minReps: 3,
    };

    /** Number of levels per system. */
    var SYSTEM_LEVEL_COUNT = {
        hechrachi: 8,
        gadol: 8,
        katan: 4,
        siduri: 4,
        atbash: 3,
        albam: 3,
        avgad: 3,
    };

    // ---------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------

    /** Cache for letter name lookups (built once on first use). */
    var _nameMap = null;

    /**
     * Build a map from letter character to a slug-safe name for card IDs.
     * Base letters get their name (e.g. "alef"), final forms get name
     * plus "-final" (e.g. "kaf-final").
     */
    function _buildNameMap() {
        if (_nameMap) return _nameMap;
        _nameMap = {};

        var alpha = Gematria.alphabet();
        var i, info;
        for (i = 0; i < alpha.length; i++) {
            info = Gematria.letterInfo(alpha[i]);
            var slug = info.name.toLowerCase();
            _nameMap[alpha[i]] = slug;
            if (info.finalForm) {
                _nameMap[info.finalForm] = slug + '-final';
            }
        }
        return _nameMap;
    }

    /**
     * Get the slug name for a Hebrew letter character.
     *
     * @param {string} ch - Hebrew letter.
     * @returns {string} Slug-safe name.
     */
    function _slugName(ch) {
        var names = _buildNameMap();
        return names[ch] || ch;
    }

    /**
     * Return a slice of the 22-letter alphabet by position range.
     *
     * @param {number} start - Start position (1-indexed, inclusive).
     * @param {number} end - End position (1-indexed, inclusive).
     * @returns {string[]} Array of Hebrew letters.
     */
    function _lettersInRange(start, end) {
        var alpha = Gematria.alphabet();
        return alpha.slice(start - 1, end);
    }

    /**
     * Return the five final-form letters in alphabetical order.
     *
     * @returns {string[]} Array of final-form Hebrew letters.
     */
    function _finalForms() {
        var alpha = Gematria.alphabet();
        var finals = [];
        var i, info;
        for (i = 0; i < alpha.length; i++) {
            info = Gematria.letterInfo(alpha[i]);
            if (info.finalForm) {
                finals.push(info.finalForm);
            }
        }
        return finals;
    }

    // ---------------------------------------------------------------
    // Card spec generators
    // ---------------------------------------------------------------

    /**
     * Generate letter-to-value and value-to-letter card specs for a
     * set of letters under a given valuation system.
     *
     * Each letter produces two cards:
     *   - "{name}-to-val": prompt is the letter, answer is its value.
     *   - "val-to-{name}": prompt is the value, answer is the letter.
     *
     * @param {string[]} letters - Array of Hebrew letters.
     * @param {string} systemKey - Registry key (e.g. "hechrachi").
     * @returns {object[]} Array of card spec objects.
     */
    function _valuationCards(letters, systemKey) {
        var system = GematriaRegistry.get(systemKey);
        var cards = [];
        var i, letter, value, name;

        for (i = 0; i < letters.length; i++) {
            letter = letters[i];
            value = system.fn(letter);
            name = _slugName(letter);

            cards.push({
                id: name + '-to-val',
                type: 'letter-to-value',
                prompt: letter,
                answer: String(value),
            });

            cards.push({
                id: 'val-to-' + name,
                type: 'value-to-letter',
                prompt: String(value),
                answer: letter,
            });
        }

        return cards;
    }

    /**
     * Generate cipher pair card specs for a set of letters.
     *
     * Each letter produces one forward card:
     *   - "cipher-{name}": prompt is the letter, answer is the cipher result.
     *
     * For avgad with includeReverse, each letter also gets a reverse card:
     *   - "cipher-rev-{name}": prompt is the letter, answer is the reverse
     *     cipher result (what letter maps TO this one).
     *
     * @param {string[]} letters - Array of Hebrew letters.
     * @param {string} systemKey - Registry key (e.g. "atbash").
     * @param {boolean} includeReverse - Whether to add reverse-direction cards.
     * @returns {object[]} Array of card spec objects.
     */
    function _cipherCards(letters, systemKey, includeReverse) {
        var system = GematriaRegistry.get(systemKey);
        var cards = [];
        var i, letter, paired, name;

        for (i = 0; i < letters.length; i++) {
            letter = letters[i];
            paired = system.fn(letter);
            name = _slugName(letter);

            cards.push({
                id: 'cipher-' + name,
                type: 'cipher-forward',
                prompt: letter,
                answer: paired,
            });

            if (includeReverse) {
                // Reverse: only used for Avgad (the only asymmetric cipher).
                // Atbash and Albam are symmetric so includeReverse is never
                // true for them. If a new asymmetric cipher is added, this
                // will need to be generalized.
                var reversed = Gematria.avgad(letter, true);
                cards.push({
                    id: 'cipher-rev-' + name,
                    type: 'cipher-reverse',
                    prompt: letter,
                    answer: reversed,
                });
            }
        }

        return cards;
    }

    // ---------------------------------------------------------------
    // Level card definitions by system type
    // ---------------------------------------------------------------

    /**
     * 8-level card sets for Hechrachi and Gadol.
     *
     * Level 1: Letters א-ט (1-9), both directions
     * Level 2: Letters י-צ (10-90), both directions
     * Level 3: Letters ק-ת (100-400), both directions
     * Level 4: Final forms (ך ם ן ף ץ), both directions
     *         Hechrachi: same values as non-final (reinforcement)
     *         Gadol: distinct 500-900 values
     * Levels 5-8: Procedural (defined in E7, returns empty here)
     */
    function _eightLevelCards(systemKey, level) {
        switch (level) {
            case 1:
                return _valuationCards(_lettersInRange(1, 9), systemKey);
            case 2:
                return _valuationCards(_lettersInRange(10, 18), systemKey);
            case 3:
                return _valuationCards(_lettersInRange(19, 22), systemKey);
            case 4:
                return _valuationCards(_finalForms(), systemKey);
            // Levels 5-8 are procedural (implemented in E7: generator.js)
            default:
                return [];
        }
    }

    /**
     * 4-level card sets for Katan and Siduri.
     *
     * Level 1: Letters א-ט (first 9), both directions
     * Level 2: Letters י-צ (next 9), both directions
     * Level 3: Letters ק-ת (last 4) + final forms, both directions
     * Level 4: All letters mixed, both directions (cumulative review)
     *
     * For Katan, multiple letters share the same reduced value (e.g.
     * א=1, י=1, ק=1). Each gets its own value-to-letter card so the
     * user encounters all variants through spaced repetition.
     */
    function _fourLevelCards(systemKey, level) {
        switch (level) {
            case 1:
                return _valuationCards(_lettersInRange(1, 9), systemKey);
            case 2:
                return _valuationCards(_lettersInRange(10, 18), systemKey);
            case 3:
                var letters3 = _lettersInRange(19, 22).concat(_finalForms());
                return _valuationCards(letters3, systemKey);
            case 4:
                // Cumulative: all base letters + final forms
                var all = Gematria.alphabet().concat(_finalForms());
                return _valuationCards(all, systemKey);
            default:
                return [];
        }
    }

    /**
     * 3-level card sets for cipher systems.
     *
     * Level 1: Letters א-כ (first 11), forward direction only
     * Level 2: Letters ל-ת (last 11), forward direction only
     * Level 3: All 22 letters, both directions
     *         For symmetric ciphers (Atbash, Albam): both directions
     *         are identical, so only forward cards are generated.
     *         For Avgad (asymmetric): forward + reverse cards.
     */
    function _threeLevelCards(systemKey, level) {
        var isAsymmetric = systemKey === 'avgad';

        switch (level) {
            case 1:
                return _cipherCards(_lettersInRange(1, 11), systemKey, false);
            case 2:
                return _cipherCards(_lettersInRange(12, 22), systemKey, false);
            case 3:
                return _cipherCards(Gematria.alphabet(), systemKey, isAsymmetric);
            default:
                return [];
        }
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        /** Mastery criteria for level advancement. */
        MASTERY: MASTERY,

        /**
         * Get the number of levels for a given system.
         *
         * @param {string} systemKey - Registry key.
         * @returns {number} Level count (3, 4, or 8), or 0 if unknown.
         */
        levelCount: function (systemKey) {
            return SYSTEM_LEVEL_COUNT[systemKey] || 0;
        },

        /**
         * Get the Hebrew letter label for a level number.
         *
         * @param {number} levelNumber - Level number (1-8).
         * @returns {string} Hebrew letter (e.g. level 1 = א).
         */
        levelLetter: function (levelNumber) {
            return LEVEL_LABELS[levelNumber] || '';
        },

        /**
         * Generate card specs for a given system and level.
         *
         * Each card spec has: { id, type, prompt, answer }
         * - id: stable string identifier for spaced repetition state
         * - type: card type (letter-to-value, value-to-letter,
         *         cipher-forward, cipher-reverse)
         * - prompt: what to display to the user
         * - answer: the correct answer
         *
         * @param {string} systemKey - Registry key (e.g. "hechrachi").
         * @param {number} levelNumber - Level number (1-based).
         * @returns {object[]} Array of card spec objects.
         */
        getCards: function (systemKey, levelNumber) {
            var count = SYSTEM_LEVEL_COUNT[systemKey];
            if (!count || levelNumber < 1 || levelNumber > count) return [];

            if (count === 8) return _eightLevelCards(systemKey, levelNumber);
            if (count === 4) return _fourLevelCards(systemKey, levelNumber);
            if (count === 3) return _threeLevelCards(systemKey, levelNumber);
            return [];
        },

        /**
         * Check if a level's card set is static (fixed) or procedural.
         *
         * Static levels have a known card set defined here. Procedural
         * levels (8-level systems, levels 5-8) generate cards at runtime
         * via the generator module (E7).
         *
         * @param {string} systemKey - Registry key.
         * @param {number} levelNumber - Level number (1-based).
         * @returns {boolean} True if the level has a static card set.
         */
        isStatic: function (systemKey, levelNumber) {
            var count = SYSTEM_LEVEL_COUNT[systemKey];
            if (count === 8) return levelNumber <= 4;
            // All levels in 4-level and 3-level systems are static
            return true;
        },
    };
})();
