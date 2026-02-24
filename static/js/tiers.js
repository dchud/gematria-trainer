/**
 * Tier definitions for all gematria system types.
 *
 * Defines the card sets, mastery criteria, and tier structure for each
 * system category:
 *   - 8-tier: Mispar Hechrachi, Mispar Gadol
 *   - 4-tier: Mispar Katan, Mispar Siduri
 *   - 3-tier: Atbash, Albam, Avgad (ciphers)
 *
 * Each tier generates an array of card specs with stable IDs suitable
 * for use as spaced repetition card identifiers.
 *
 * Depends on gematria.js and registry.js being loaded first.
 * ES5-compatible -- no import/export, no arrow functions, no let/const.
 */

var Tiers = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Constants
    // ---------------------------------------------------------------

    /** Hebrew letter labels for each tier (1-indexed). */
    var TIER_LABELS = [
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

    /** Number of tiers per system. */
    var SYSTEM_TIER_COUNT = {
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
                // Reverse: apply cipher in reverse direction
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
    // Tier card definitions by system type
    // ---------------------------------------------------------------

    /**
     * 8-tier card sets for Hechrachi and Gadol.
     *
     * Tier 1: Letters א-ט (1-9), both directions
     * Tier 2: Letters י-צ (10-90), both directions
     * Tier 3: Letters ק-ת (100-400), both directions
     * Tier 4: Final forms (ך ם ן ף ץ), both directions
     *         Hechrachi: same values as non-final (reinforcement)
     *         Gadol: distinct 500-900 values
     * Tiers 5-8: Procedural (defined in E7, returns empty here)
     */
    function _eightTierCards(systemKey, tier) {
        switch (tier) {
            case 1:
                return _valuationCards(_lettersInRange(1, 9), systemKey);
            case 2:
                return _valuationCards(_lettersInRange(10, 18), systemKey);
            case 3:
                return _valuationCards(_lettersInRange(19, 22), systemKey);
            case 4:
                return _valuationCards(_finalForms(), systemKey);
            // Tiers 5-8 are procedural (implemented in E7: generator.js)
            default:
                return [];
        }
    }

    /**
     * 4-tier card sets for Katan and Siduri.
     *
     * Tier 1: Letters א-ט (first 9), both directions
     * Tier 2: Letters י-צ (next 9), both directions
     * Tier 3: Letters ק-ת (last 4) + final forms, both directions
     * Tier 4: All letters mixed, both directions (cumulative review)
     *
     * For Katan, multiple letters share the same reduced value (e.g.
     * א=1, י=1, ק=1). Each gets its own value-to-letter card so the
     * user encounters all variants through spaced repetition.
     */
    function _fourTierCards(systemKey, tier) {
        switch (tier) {
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
     * 3-tier card sets for cipher systems.
     *
     * Tier 1: Letters א-כ (first 11), forward direction only
     * Tier 2: Letters ל-ת (last 11), forward direction only
     * Tier 3: All 22 letters, both directions
     *         For symmetric ciphers (Atbash, Albam): both directions
     *         are identical, so only forward cards are generated.
     *         For Avgad (asymmetric): forward + reverse cards.
     */
    function _threeTierCards(systemKey, tier) {
        var isAsymmetric = systemKey === 'avgad';

        switch (tier) {
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
        /** Mastery criteria for tier advancement. */
        MASTERY: MASTERY,

        /**
         * Get the number of tiers for a given system.
         *
         * @param {string} systemKey - Registry key.
         * @returns {number} Tier count (3, 4, or 8), or 0 if unknown.
         */
        tierCount: function (systemKey) {
            return SYSTEM_TIER_COUNT[systemKey] || 0;
        },

        /**
         * Get the Hebrew letter label for a tier number.
         *
         * @param {number} tierNumber - Tier number (1-8).
         * @returns {string} Hebrew letter (e.g. tier 1 = א).
         */
        tierLetter: function (tierNumber) {
            return TIER_LABELS[tierNumber] || '';
        },

        /**
         * Generate card specs for a given system and tier.
         *
         * Each card spec has: { id, type, prompt, answer }
         * - id: stable string identifier for spaced repetition state
         * - type: card type (letter-to-value, value-to-letter,
         *         cipher-forward, cipher-reverse)
         * - prompt: what to display to the user
         * - answer: the correct answer
         *
         * @param {string} systemKey - Registry key (e.g. "hechrachi").
         * @param {number} tierNumber - Tier number (1-based).
         * @returns {object[]} Array of card spec objects.
         */
        getCards: function (systemKey, tierNumber) {
            var count = SYSTEM_TIER_COUNT[systemKey];
            if (!count || tierNumber < 1 || tierNumber > count) return [];

            if (count === 8) return _eightTierCards(systemKey, tierNumber);
            if (count === 4) return _fourTierCards(systemKey, tierNumber);
            if (count === 3) return _threeTierCards(systemKey, tierNumber);
            return [];
        },

        /**
         * Check if a tier's card set is static (fixed) or procedural.
         *
         * Static tiers have a known card set defined here. Procedural
         * tiers (8-tier systems, tiers 5-8) generate cards at runtime
         * via the generator module (E7).
         *
         * @param {string} systemKey - Registry key.
         * @param {number} tierNumber - Tier number (1-based).
         * @returns {boolean} True if the tier has a static card set.
         */
        isStatic: function (systemKey, tierNumber) {
            var count = SYSTEM_TIER_COUNT[systemKey];
            if (count === 8) return tierNumber <= 4;
            // All tiers in 4-tier and 3-tier systems are static
            return true;
        },
    };
})();
