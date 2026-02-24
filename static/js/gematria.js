/**
 * Gematria systems module.
 *
 * Implements all valuation methods and cipher systems for Hebrew Gematria.
 * Reads letter data from the global LETTERS_DATA array injected by Flask.
 * Attaches all functions to the global Gematria object.
 *
 * ES5-compatible -- no import/export, no arrow functions, no let/const.
 */

var Gematria = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Internal lookup tables (built lazily from LETTERS_DATA)
    // ---------------------------------------------------------------

    var _initialized = false;

    // letter -> { name, position, standardValue, finalValue }
    var _letterMap = {};

    // Final-form letter -> its non-final counterpart letter
    var _finalToNonFinal = {};

    // The 22 base letters in alphabetical order (no final forms)
    var _alphabet = [];

    // position (1-22) -> letter
    var _positionToLetter = {};

    /**
     * Build internal lookup tables from the global LETTERS_DATA array.
     * Called automatically on first use of any public function.
     */
    function _init() {
        if (_initialized) return;

        if (typeof LETTERS_DATA === 'undefined' || !LETTERS_DATA) {
            throw new Error('Gematria: LETTERS_DATA is not defined. ' +
                'Ensure the letter data is injected before loading gematria.js.');
        }

        var i, entry;
        for (i = 0; i < LETTERS_DATA.length; i++) {
            entry = LETTERS_DATA[i];
            var letter = entry.letter;
            var position = Number(entry.position);
            var standardValue = Number(entry.standard_value);
            var finalForm = entry.final_form || null;
            var finalValue = entry.final_value ? Number(entry.final_value) : null;

            _letterMap[letter] = {
                name: entry.name,
                position: position,
                standardValue: standardValue,
                finalValue: finalValue,
                finalForm: finalForm
            };

            _alphabet.push(letter);
            _positionToLetter[position] = letter;

            // Register the final form as well
            if (finalForm) {
                _finalToNonFinal[finalForm] = letter;
                _letterMap[finalForm] = {
                    name: entry.name + ' (final)',
                    position: position,
                    standardValue: standardValue,
                    finalValue: finalValue,
                    finalForm: null
                };
            }
        }

        _initialized = true;
    }

    /**
     * Return the non-final counterpart of a letter.
     * If the letter is already non-final, return it unchanged.
     *
     * @param {string} ch - A single Hebrew letter.
     * @returns {string} The non-final form of the letter.
     */
    function _toNonFinal(ch) {
        return _finalToNonFinal[ch] || ch;
    }

    /**
     * Return true if the character is a recognized Hebrew letter
     * (base or final form).
     *
     * @param {string} ch - A single character.
     * @returns {boolean}
     */
    function _isLetter(ch) {
        return _letterMap.hasOwnProperty(ch);
    }


    // ---------------------------------------------------------------
    // Valuation systems
    // ---------------------------------------------------------------

    /**
     * Mispar Hechrachi (standard value).
     *
     * Each letter maps to its standard_value. Final forms use the same
     * value as their non-final counterpart (e.g. final Mem = 40).
     *
     * @param {string} text - Hebrew text to evaluate.
     * @returns {number} Sum of standard values.
     */
    function hechrachi(text) {
        _init();
        var sum = 0;
        var i, ch, base;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (!_isLetter(ch)) continue;
            base = _toNonFinal(ch);
            sum += _letterMap[base].standardValue;
        }
        return sum;
    }

    /**
     * Mispar Gadol.
     *
     * Same as Hechrachi except final forms use their distinct final_value
     * (Kaf-final=500, Mem-final=600, Nun-final=700, Pe-final=800, Tsade-final=900).
     * Non-final letters use their standard_value as usual.
     *
     * @param {string} text - Hebrew text to evaluate.
     * @returns {number} Sum of Gadol values.
     */
    function gadol(text) {
        _init();
        var sum = 0;
        var i, ch, info;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (!_isLetter(ch)) continue;
            info = _letterMap[ch];
            // If the character IS a final form, use its finalValue.
            // Otherwise use standardValue.
            if (_finalToNonFinal.hasOwnProperty(ch) && info.finalValue !== null) {
                sum += info.finalValue;
            } else {
                sum += info.standardValue;
            }
        }
        return sum;
    }

    /**
     * Mispar Katan (reduced / small value).
     *
     * Drop trailing zeros from the standard value to produce a single digit:
     *   1-9 -> 1-9, 10-90 -> 1-9, 100-400 -> 1-4.
     * Final forms use the same reduced value as their non-final counterpart.
     *
     * @param {string} text - Hebrew text to evaluate.
     * @returns {number} Sum of reduced values.
     */
    function katan(text) {
        _init();
        var sum = 0;
        var i, ch, base, val;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (!_isLetter(ch)) continue;
            base = _toNonFinal(ch);
            val = _letterMap[base].standardValue;
            // Remove trailing zeros
            while (val >= 10 && val % 10 === 0) {
                val = val / 10;
            }
            sum += val;
        }
        return sum;
    }

    /**
     * Mispar Siduri (ordinal value).
     *
     * Each letter gets its ordinal position in the 22-letter alphabet (1-22).
     * Final forms use the same position as their non-final counterpart.
     *
     * @param {string} text - Hebrew text to evaluate.
     * @returns {number} Sum of ordinal values.
     */
    function siduri(text) {
        _init();
        var sum = 0;
        var i, ch, base;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (!_isLetter(ch)) continue;
            base = _toNonFinal(ch);
            sum += _letterMap[base].position;
        }
        return sum;
    }


    // ---------------------------------------------------------------
    // Number-to-Hebrew encoding
    // ---------------------------------------------------------------

    /**
     * Encode a positive integer as a Hebrew numeral string.
     *
     * Special cases:
     * - 15 encodes as ט״ו (9+6) rather than י״ה
     * - 16 encodes as ט״ז (9+7) rather than י״ו
     * - Single-letter results get a geresh (׳) appended
     * - Multi-letter results get gershayim (״) before the last letter
     *
     * @param {number} number - Positive integer to encode.
     * @param {boolean} [omitThousands=true] - If true, strip the thousands
     *     digit (standard for Hebrew year encoding, e.g. 5784 -> 784).
     * @returns {string} Hebrew numeral string with punctuation.
     */
    function encode(number, omitThousands) {
        _init();

        if (omitThousands === undefined) omitThousands = true;

        if (number <= 0) {
            throw new Error('Gematria.encode: number must be a positive integer, got ' + number);
        }

        var n = number;

        // Optionally strip the thousands digit
        if (omitThousands && n >= 1000) {
            n = n % 1000;
        }

        // If, after stripping thousands, nothing remains, encode the full number
        if (n === 0) {
            n = number;
        }

        // Value-to-letter mapping for decomposition (descending order)
        var values = [
            400, 300, 200, 100,
            90, 80, 70, 60, 50, 40, 30, 20, 10,
            9, 8, 7, 6, 5, 4, 3, 2, 1
        ];
        // Corresponding Hebrew letters
        var letters = [
            '\u05EA', '\u05E9', '\u05E8', '\u05E7',       // ת ש ר ק
            '\u05E6', '\u05E4', '\u05E2', '\u05E1',       // צ פ ע ס
            '\u05E0', '\u05DE', '\u05DC', '\u05DB',       // נ מ ל כ
            '\u05D9',                                      // י
            '\u05D8', '\u05D7', '\u05D6', '\u05D5',       // ט ח ז ו
            '\u05D4', '\u05D3', '\u05D2', '\u05D1',       // ה ד ג ב
            '\u05D0'                                       // א
        ];

        var GERESH = '\u05F3';      // ׳
        var GERSHAYIM = '\u05F4';   // ״

        // Greedy decomposition
        var result = [];
        var vi, remaining;
        remaining = n;

        // Handle special cases for 15 and 16
        // These appear anywhere as the last two digits, so we check
        // whether the remaining value will produce 10+5 or 10+6
        // We handle this by doing the decomposition and then fixing up.

        for (vi = 0; vi < values.length; vi++) {
            while (remaining >= values[vi]) {
                result.push(letters[vi]);
                remaining -= values[vi];
            }
        }

        // Fix up 15 (י״ה -> ט״ו) and 16 (י״ו -> ט״ז)
        // Detect: the last two characters are י then ה (15) or י then ו (16)
        var resultStr = result.join('');
        resultStr = resultStr.replace('\u05D9\u05D4', '\u05D8\u05D5');  // יה -> טו
        resultStr = resultStr.replace('\u05D9\u05D5', '\u05D8\u05D6');  // יו -> טז

        // Add punctuation
        if (resultStr.length === 1) {
            resultStr = resultStr + GERESH;
        } else {
            // Insert gershayim before the last letter
            var lastIdx = resultStr.length - 1;
            resultStr = resultStr.substring(0, lastIdx) + GERSHAYIM + resultStr.charAt(lastIdx);
        }

        return resultStr;
    }


    // ---------------------------------------------------------------
    // Cipher systems
    // ---------------------------------------------------------------

    /**
     * Atbash cipher (mirror substitution).
     *
     * Maps the first letter to the last, second to second-to-last, etc.
     * Pairs: א↔ת, ב↔ש, ג↔ר, ד↔ק, ה↔צ, ו↔פ, ז↔ע, ח↔ס, ט↔נ, י↔מ, כ↔ל
     *
     * The cipher is symmetric: applying it twice returns the original text.
     * Final forms are resolved to their non-final counterpart before the
     * cipher is applied.
     *
     * @param {string} text - Hebrew text to transform.
     * @returns {string} Transformed text.
     */
    function atbash(text) {
        _init();

        // Build the Atbash mapping: position p maps to position (23 - p)
        var map = {};
        var p;
        for (p = 1; p <= 22; p++) {
            map[_positionToLetter[p]] = _positionToLetter[23 - p];
        }

        var result = [];
        var i, ch, base;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (!_isLetter(ch)) {
                result.push(ch);
                continue;
            }
            base = _toNonFinal(ch);
            result.push(map[base] || ch);
        }
        return result.join('');
    }

    /**
     * Albam cipher (half-split substitution).
     *
     * Splits the 22-letter alphabet into two halves of 11 and pairs them:
     * Pairs: א↔ל, ב↔מ, ג↔נ, ד↔ס, ה↔ע, ו↔פ, ז↔צ, ח↔ק, ט↔ר, י↔ש, כ↔ת
     *
     * The cipher is symmetric: applying it twice returns the original text.
     * Final forms are resolved to their non-final counterpart before the
     * cipher is applied.
     *
     * @param {string} text - Hebrew text to transform.
     * @returns {string} Transformed text.
     */
    function albam(text) {
        _init();

        // Build the Albam mapping: position p maps to position p+11 (mod 22)
        // Positions 1-11 map to 12-22, and positions 12-22 map back to 1-11.
        var map = {};
        var p, target;
        for (p = 1; p <= 22; p++) {
            if (p <= 11) {
                target = p + 11;
            } else {
                target = p - 11;
            }
            map[_positionToLetter[p]] = _positionToLetter[target];
        }

        var result = [];
        var i, ch, base;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (!_isLetter(ch)) {
                result.push(ch);
                continue;
            }
            base = _toNonFinal(ch);
            result.push(map[base] || ch);
        }
        return result.join('');
    }

    /**
     * Avgad cipher (shift substitution).
     *
     * Forward (default): each letter shifts forward one position in the
     * alphabet: א→ב, ב→ג, ..., ש→ת, ת→א (wraps around).
     *
     * Reverse: each letter shifts backward one position:
     * ב→א, ג→ב, ..., א→ת (wraps around).
     *
     * Forward and reverse are inverses of each other.
     * Final forms are resolved to their non-final counterpart before the
     * cipher is applied.
     *
     * @param {string} text - Hebrew text to transform.
     * @param {boolean} [reverse=false] - If true, shift backward.
     * @returns {string} Transformed text.
     */
    function avgad(text, reverse) {
        _init();

        var shift = reverse ? -1 : 1;

        var result = [];
        var i, ch, base, pos, newPos;
        for (i = 0; i < text.length; i++) {
            ch = text.charAt(i);
            if (!_isLetter(ch)) {
                result.push(ch);
                continue;
            }
            base = _toNonFinal(ch);
            pos = _letterMap[base].position;
            // 1-indexed positions, 22 letters, wrap around
            newPos = ((pos - 1 + shift + 22) % 22) + 1;
            result.push(_positionToLetter[newPos]);
        }
        return result.join('');
    }


    // ---------------------------------------------------------------
    // Utility functions
    // ---------------------------------------------------------------

    /**
     * Get the lookup data for a single Hebrew letter.
     *
     * @param {string} ch - A single Hebrew letter (base or final form).
     * @returns {object|null} Letter data object or null if not found.
     */
    function letterInfo(ch) {
        _init();
        if (!_isLetter(ch)) return null;
        return _letterMap[ch];
    }

    /**
     * Return the ordered array of 22 base Hebrew letters.
     *
     * @returns {string[]}
     */
    function alphabet() {
        _init();
        return _alphabet.slice();
    }

    /**
     * Check whether the module has been initialized.
     *
     * @returns {boolean}
     */
    function isInitialized() {
        return _initialized;
    }

    /**
     * Force (re-)initialization from LETTERS_DATA.
     * Useful for testing when LETTERS_DATA is set after initial load.
     */
    function initialize() {
        _initialized = false;
        _letterMap = {};
        _finalToNonFinal = {};
        _alphabet = [];
        _positionToLetter = {};
        _init();
    }


    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        // Valuation systems
        hechrachi: hechrachi,
        gadol: gadol,
        katan: katan,
        siduri: siduri,

        // Number encoding
        encode: encode,

        // Cipher systems
        atbash: atbash,
        albam: albam,
        avgad: avgad,

        // Utilities
        letterInfo: letterInfo,
        alphabet: alphabet,
        isInitialized: isInitialized,
        initialize: initialize
    };
})();
