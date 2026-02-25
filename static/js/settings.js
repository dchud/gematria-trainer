/**
 * Settings module.
 *
 * Defines setting defaults, option arrays for UI rendering, and
 * load/save helpers. The app.js controller owns the reactive state;
 * this module is the source of truth for what settings exist and
 * their defaults.
 *
 * Depends on storage.js (Storage global).
 * No import/export, no arrow functions, no let/const.
 */

var Settings = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // Defaults
    // ---------------------------------------------------------------

    var DEFAULTS = {
        system: 'hechrachi',
        hebrewFont: 'standard',
        darkMode: 'system',
        transition: 'fade',
        transitionDuration: 200,
    };

    // ---------------------------------------------------------------
    // Option arrays for UI rendering
    // ---------------------------------------------------------------

    var SYSTEMS = [
        {
            key: 'hechrachi',
            name: 'Mispar Hechrachi',
            type: 'valuation',
            description: 'Standard values (1-400)',
        },
        {
            key: 'gadol',
            name: 'Mispar Gadol',
            type: 'valuation',
            description: 'Standard + final forms (1-900)',
        },
        {
            key: 'katan',
            name: 'Mispar Katan',
            type: 'valuation',
            description: 'Reduced single-digit values',
        },
        {
            key: 'siduri',
            name: 'Mispar Siduri',
            type: 'valuation',
            description: 'Ordinal position (1-22)',
        },
        {
            key: 'atbash',
            name: 'Atbash',
            type: 'cipher',
            description: 'Mirror substitution',
        },
        {
            key: 'albam',
            name: 'Albam',
            type: 'cipher',
            description: 'Half-alphabet substitution',
        },
        {
            key: 'avgad',
            name: 'Avgad',
            type: 'cipher',
            description: 'Shift substitution',
        },
    ];

    var FONTS = [
        {
            key: 'standard',
            label: 'Serif',
            className: 'font-hebrew-standard',
            preview: '\u05D0\u05D1\u05D2',
        },
        {
            key: 'sans',
            label: 'Sans',
            className: 'font-hebrew-sans',
            preview: '\u05D0\u05D1\u05D2',
        },
        {
            key: 'rashi',
            label: 'Rashi',
            className: 'font-hebrew-rashi',
            preview: '\u05D0\u05D1\u05D2',
        },
    ];

    var TRANSITIONS = [
        { key: 'fade', label: 'Fade' },
        { key: 'slide-left', label: 'Slide' },
        { key: 'none', label: 'None' },
    ];

    // ---------------------------------------------------------------
    // Load / save
    // ---------------------------------------------------------------

    /**
     * Merge saved settings with defaults, filling any missing keys.
     *
     * @param {object} saved - Saved settings (may be partial).
     * @returns {object} Complete settings with all keys present.
     */
    function applyDefaults(saved) {
        var result = {};
        var key;
        for (key in DEFAULTS) {
            if (Object.hasOwn(DEFAULTS, key)) {
                result[key] = DEFAULTS[key];
            }
        }
        if (saved) {
            for (key in saved) {
                if (Object.hasOwn(saved, key) && Object.hasOwn(DEFAULTS, key)) {
                    result[key] = saved[key];
                }
            }
        }
        return result;
    }

    /**
     * Load settings from localStorage, merged with defaults.
     *
     * @returns {object} Complete settings object.
     */
    function load() {
        var saved = Storage.loadSettings();
        return applyDefaults(saved);
    }

    /**
     * Save settings to localStorage.
     *
     * @param {object} settings - Settings to persist.
     * @returns {boolean} True if save succeeded.
     */
    function save(settings) {
        return Storage.saveSettings(settings);
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        DEFAULTS: DEFAULTS,
        SYSTEMS: SYSTEMS,
        FONTS: FONTS,
        TRANSITIONS: TRANSITIONS,

        applyDefaults: applyDefaults,
        load: load,
        save: save,
    };
})();
