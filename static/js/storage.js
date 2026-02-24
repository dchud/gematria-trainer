/**
 * localStorage persistence module.
 *
 * Provides namespaced read/write of progression state per gematria
 * system, plus settings and session state. Handles localStorage
 * unavailability gracefully (e.g. Safari private browsing).
 *
 * Depends on registry.js (for clearAllProgress).
 *
 * Key schema:
 *   schema_version        - integer schema version (for migration)
 *   progress_{systemKey}  - progression state object per system
 *   settings              - user settings object
 *   session               - session metadata
 *
 * No import/export, no arrow functions, no let/const.
 */

var Storage = (function () {
    'use strict';

    // ---------------------------------------------------------------
    // localStorage availability
    // ---------------------------------------------------------------

    // Current schema version. Increment when the data shape changes.
    // On version mismatch, all stored data is cleared.
    var SCHEMA_VERSION = 1;
    var SCHEMA_KEY = 'schema_version';

    var _available = null;

    /**
     * Check if localStorage is available.
     *
     * Performs a write/read/delete test. Caches the result after
     * the first check.
     *
     * @returns {boolean} True if localStorage is usable.
     */
    function isAvailable() {
        if (_available !== null) return _available;

        try {
            var testKey = '__gematria_storage_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            _available = true;
            _checkSchema();
        } catch (e) {
            _available = false;
        }

        return _available;
    }

    /**
     * Check the stored schema version. If it differs from the current
     * version, clear all data (progress, settings, session) and stamp
     * the new version. Safe to call multiple times; only acts once.
     */
    function _checkSchema() {
        if (!isAvailable()) return;

        try {
            var stored = localStorage.getItem(SCHEMA_KEY);
            if (stored !== null && Number(stored) === SCHEMA_VERSION) return;

            // Version mismatch or first run — clear everything
            if (stored !== null) {
                localStorage.clear();
            }
            localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
        } catch (e) {
            // Silently ignore — storage may be full or locked
        }
    }

    // ---------------------------------------------------------------
    // Progress state (per system)
    // ---------------------------------------------------------------

    /**
     * Get the localStorage key for a system's progress data.
     *
     * @param {string} systemKey - Registry key (e.g. "hechrachi").
     * @returns {string} localStorage key.
     */
    function _progressKey(systemKey) {
        return 'progress_' + systemKey;
    }

    /**
     * Load card state array for a system.
     *
     * Returns null if no saved state exists or localStorage is
     * unavailable.
     *
     * @param {string} systemKey - Registry key.
     * @returns {object[]|null} Array of card state objects, or null.
     */
    function loadProgress(systemKey) {
        if (!isAvailable()) return null;

        try {
            var raw = localStorage.getItem(_progressKey(systemKey));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * Save card state array for a system.
     *
     * @param {string} systemKey - Registry key.
     * @param {object[]} cards - Array of card state objects.
     * @returns {boolean} True if save succeeded.
     */
    function saveProgress(systemKey, cards) {
        if (!isAvailable()) return false;

        try {
            localStorage.setItem(_progressKey(systemKey), JSON.stringify(cards));
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Clear progress data for a specific system.
     *
     * @param {string} systemKey - Registry key.
     */
    function clearProgress(systemKey) {
        if (!isAvailable()) return;

        try {
            localStorage.removeItem(_progressKey(systemKey));
        } catch (e) {
            // Silently ignore
        }
    }

    /**
     * Clear progress data for all systems.
     *
     * Preserves settings and other non-progress keys.
     */
    function clearAllProgress() {
        if (!isAvailable()) return;

        var systems = GematriaRegistry.all();
        var i;
        for (i = 0; i < systems.length; i++) {
            clearProgress(systems[i]);
        }
    }

    // ---------------------------------------------------------------
    // Settings
    // ---------------------------------------------------------------

    var SETTINGS_KEY = 'settings';

    /**
     * Load user settings object.
     *
     * @returns {object|null} Settings object, or null if not saved.
     */
    function loadSettings() {
        if (!isAvailable()) return null;

        try {
            var raw = localStorage.getItem(SETTINGS_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * Save user settings object.
     *
     * @param {object} settings - Settings to persist.
     * @returns {boolean} True if save succeeded.
     */
    function saveSettings(settings) {
        if (!isAvailable()) return false;

        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            return true;
        } catch (e) {
            return false;
        }
    }

    // ---------------------------------------------------------------
    // Session metadata
    // ---------------------------------------------------------------

    var SESSION_KEY = 'session';

    /**
     * Load session metadata.
     *
     * @returns {object|null} Session object, or null.
     */
    function loadSession() {
        if (!isAvailable()) return null;

        try {
            var raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    /**
     * Save session metadata.
     *
     * @param {object} session - Session data to persist.
     * @returns {boolean} True if save succeeded.
     */
    function saveSession(session) {
        if (!isAvailable()) return false;

        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Clear session metadata.
     */
    function clearSession() {
        if (!isAvailable()) return;

        try {
            localStorage.removeItem(SESSION_KEY);
        } catch (e) {
            // Silently ignore
        }
    }

    // ---------------------------------------------------------------
    // Public API
    // ---------------------------------------------------------------

    return {
        // Schema
        SCHEMA_VERSION: SCHEMA_VERSION,

        // Availability
        isAvailable: isAvailable,

        // Progress (per system)
        loadProgress: loadProgress,
        saveProgress: saveProgress,
        clearProgress: clearProgress,
        clearAllProgress: clearAllProgress,

        // Settings
        loadSettings: loadSettings,
        saveSettings: saveSettings,

        // Session
        loadSession: loadSession,
        saveSession: saveSession,
        clearSession: clearSession,
    };
})();
