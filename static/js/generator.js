/**
 * Procedural card generator for tiers 5-8 of 8-tier systems.
 *
 * Uses a seeded PRNG (Mulberry32) to deterministically generate card
 * sets for compound numbers, Hebrew years, large numbers, and
 * real-world examples. Same seed always produces the same card set,
 * ensuring stable card IDs for spaced repetition across sessions.
 *
 * Depends on gematria.js and registry.js being loaded first.
 * No import/export, no arrow functions, no let/const. Requires ES2022+ (Object.hasOwn).
 */

var Generator = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // PRNG: Mulberry32 (32-bit seeded)
    // ---------------------------------------------------------------

    /**
     * Create a Mulberry32 PRNG function from a seed.
     *
     * @param {number} seed - 32-bit integer seed.
     * @returns {function} Function that returns a float in [0, 1) on each call.
     */
    function _prng(seed) {
        var state = seed | 0;
        return function () {
            state = (state + 0x6d2b79f5) | 0;
            var t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /**
     * Generate a random 32-bit integer seed using Math.random().
     *
     * @returns {number} 32-bit integer.
     */
    function generateSeed() {
        return (Math.random() * 4294967296) >>> 0;
    }

    /**
     * Generate seeds object for a system.
     *
     * 8-tier systems get seeds for tiers 5-8. Others get empty object.
     *
     * @param {string} systemKey - Registry key.
     * @returns {object} Seeds map, e.g. {5: num, 6: num, 7: num, 8: num}.
     */
    function generateSeeds(systemKey) {
        var tierCount = Tiers.tierCount(systemKey);
        if (tierCount !== 8) return {};
        return {
            5: generateSeed(),
            6: generateSeed(),
            7: generateSeed(),
            8: generateSeed(),
        };
    }

    // ---------------------------------------------------------------
    // Card generation helpers
    // ---------------------------------------------------------------

    /**
     * Pick `count` distinct numbers from [min, max] range, excluding
     * numbers in the `exclude` set, using the given PRNG.
     *
     * @param {function} rng - PRNG function returning [0, 1).
     * @param {number} min - Minimum value (inclusive).
     * @param {number} max - Maximum value (inclusive).
     * @param {object} exclude - Set of numbers to exclude (keys are numbers).
     * @param {number} count - How many to pick.
     * @returns {number[]} Array of distinct numbers.
     */
    function _pickNumbers(rng, min, max, exclude, count) {
        var pool = [];
        var n;
        for (n = min; n <= max; n++) {
            if (!exclude[n]) {
                pool.push(n);
            }
        }

        // Fisher-Yates shuffle using PRNG
        var i, j, tmp;
        for (i = pool.length - 1; i > 0; i--) {
            j = Math.floor(rng() * (i + 1));
            tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
        }

        return pool.slice(0, count);
    }

    /**
     * Generate a pair of cards (number-to-Hebrew and Hebrew-to-number)
     * for a given number under a system.
     *
     * @param {string} prefix - ID prefix (e.g. "gen-t5").
     * @param {number} number - The number to encode.
     * @param {string} systemKey - Registry key.
     * @returns {object[]} Two card specs.
     */
    function _numberCardPair(prefix, number, systemKey) {
        var hebrew = Gematria.encode(number, false);
        var system = GematriaRegistry.get(systemKey);
        return [
            {
                id: prefix + '-' + number + '-to-heb',
                type: 'number-to-hebrew',
                prompt: String(number),
                answer: hebrew,
            },
            {
                id: prefix + '-heb-to-' + number,
                type: 'hebrew-to-number',
                prompt: hebrew,
                answer: String(number),
            },
        ];
    }

    // ---------------------------------------------------------------
    // Per-tier generators
    // ---------------------------------------------------------------

    /**
     * Tier 5: compound numbers 11-99.
     * Excludes multiples of 10 (already covered as single letters).
     * Always includes 15 and 16 (special Hebrew encoding).
     * 12 numbers x 2 directions = 24 cards.
     */
    function _tier5Cards(systemKey, seed) {
        var rng = _prng(seed);

        // Exclude round tens (single-letter values)
        var exclude = {};
        var tens = [10, 20, 30, 40, 50, 60, 70, 80, 90];
        var i;
        for (i = 0; i < tens.length; i++) {
            exclude[tens[i]] = true;
        }

        // Always include 15 and 16 (special encoding: ט״ו and ט״ז)
        var required = [15, 16];
        // Also exclude them from the random pool
        exclude[15] = true;
        exclude[16] = true;

        // Pick 10 more for 12 total
        var picked = _pickNumbers(rng, 11, 99, exclude, 10);
        var numbers = required.concat(picked);

        var cards = [];
        for (i = 0; i < numbers.length; i++) {
            cards = cards.concat(_numberCardPair('gen-t5', numbers[i], systemKey));
        }
        return cards;
    }

    /**
     * Tier 6: compound numbers 100-999.
     * Excludes round hundreds already covered as single letters.
     * 12 numbers x 2 directions = 24 cards.
     */
    function _tier6Cards(systemKey, seed) {
        var rng = _prng(seed);

        // Exclude values that are single-letter representations
        var exclude = { 100: true, 200: true, 300: true, 400: true };

        // For gadol, also exclude final-form values
        if (systemKey === 'gadol') {
            exclude[500] = true;
            exclude[600] = true;
            exclude[700] = true;
            exclude[800] = true;
            exclude[900] = true;
        }

        var picked = _pickNumbers(rng, 100, 999, exclude, 12);
        var cards = [];
        var i;
        for (i = 0; i < picked.length; i++) {
            cards = cards.concat(_numberCardPair('gen-t6', picked[i], systemKey));
        }
        return cards;
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    /**
     * Generate card specs for a procedural tier.
     *
     * @param {string} systemKey - Registry key (must be 8-tier system).
     * @param {number} tierNumber - Tier number (5-8).
     * @param {number} seed - 32-bit integer seed.
     * @returns {object[]} Array of card spec objects.
     */
    function generateTier(systemKey, tierNumber, seed) {
        switch (tierNumber) {
            case 5:
                return _tier5Cards(systemKey, seed);
            case 6:
                return _tier6Cards(systemKey, seed);
            default:
                return [];
        }
    }

    return {
        generateTier: generateTier,
        generateSeed: generateSeed,
        generateSeeds: generateSeeds,
        _prng: _prng,
        _pickNumbers: _pickNumbers,
    };
})();
