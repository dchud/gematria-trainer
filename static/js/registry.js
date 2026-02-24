/**
 * Gematria system registry.
 *
 * Maps system identifiers to their display names, types, and functions.
 * Provides query methods for filtering by valuation/cipher type.
 * Depends on gematria.js being loaded first (Gematria global).
 *
 * ES5-compatible -- no import/export, no arrow functions, no let/const.
 */

var GematriaRegistry = {
    systems: {
        hechrachi: {
            name: 'Mispar Hechrachi',
            type: 'valuation',
            fn: Gematria.hechrachi,
        },
        gadol: {
            name: 'Mispar Gadol',
            type: 'valuation',
            fn: Gematria.gadol,
        },
        katan: {
            name: 'Mispar Katan',
            type: 'valuation',
            fn: Gematria.katan,
        },
        siduri: {
            name: 'Mispar Siduri',
            type: 'valuation',
            fn: Gematria.siduri,
        },
        atbash: {
            name: 'Atbash',
            type: 'cipher',
            fn: Gematria.atbash,
        },
        albam: {
            name: 'Albam',
            type: 'cipher',
            fn: Gematria.albam,
        },
        avgad: {
            name: 'Avgad',
            type: 'cipher',
            fn: Gematria.avgad,
        },
    },

    /**
     * Look up a system by its key.
     *
     * @param {string} name - System key (e.g. 'hechrachi', 'atbash').
     * @returns {object|null} System descriptor or null if not found.
     */
    get: function (name) {
        return Object.hasOwn(this.systems, name) ? this.systems[name] : null;
    },

    /**
     * Return an array of keys for valuation-type systems.
     *
     * @returns {string[]}
     */
    valuations: function () {
        var keys = [];
        var key;
        for (key in this.systems) {
            if (Object.hasOwn(this.systems, key) && this.systems[key].type === 'valuation') {
                keys.push(key);
            }
        }
        return keys;
    },

    /**
     * Return an array of keys for cipher-type systems.
     *
     * @returns {string[]}
     */
    ciphers: function () {
        var keys = [];
        var key;
        for (key in this.systems) {
            if (Object.hasOwn(this.systems, key) && this.systems[key].type === 'cipher') {
                keys.push(key);
            }
        }
        return keys;
    },

    /**
     * Return an array of all system keys.
     *
     * @returns {string[]}
     */
    all: function () {
        var keys = [];
        var key;
        for (key in this.systems) {
            if (Object.hasOwn(this.systems, key)) {
                keys.push(key);
            }
        }
        return keys;
    },
};
