/**
 * Tests for the Storage module (localStorage persistence).
 *
 * Uses a minimal in-memory localStorage mock since Node.js does not
 * provide a native localStorage implementation.
 */

var { describe, it, beforeEach } = require('node:test');
var assert = require('node:assert/strict');
var vm = require('node:vm');
var fs = require('node:fs');
var path = require('node:path');

// Load base modules (gematria, registry, etc.) into global scope
require('./helpers/load-modules');

// ---------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------

function createMockStorage() {
    var store = {};
    return {
        getItem: function (key) {
            return Object.hasOwn(store, key) ? store[key] : null;
        },
        setItem: function (key, value) {
            store[key] = String(value);
        },
        removeItem: function (key) {
            delete store[key];
        },
        clear: function () {
            store = {};
        },
    };
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

var _storageCode = fs.readFileSync(path.resolve(__dirname, '../../static/js/storage.js'), 'utf8');

/**
 * Re-evaluate storage.js so that the IIFE runs fresh (resets the
 * internal _available cache). Uses whatever localStorage is currently
 * on globalThis.
 */
function reloadStorage() {
    vm.runInThisContext(_storageCode, { filename: 'storage.js' });
}

/**
 * Install a fresh mock localStorage and reload storage.js.
 * Returns the mock.
 */
function freshStorageWithMock() {
    var mock = createMockStorage();
    globalThis.localStorage = mock;
    reloadStorage();
    return mock;
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe('Storage', function () {
    var mock;

    beforeEach(function () {
        mock = freshStorageWithMock();
    });

    describe('isAvailable', function () {
        it('returns true when localStorage works', function () {
            assert.equal(Storage.isAvailable(), true);
        });
    });

    describe('schema versioning', function () {
        it('stamps schema version on first access', function () {
            Storage.isAvailable();
            assert.equal(mock.getItem('schema_version'), String(Storage.SCHEMA_VERSION));
        });

        it('clears data on version mismatch', function () {
            // Pre-populate mock with old version and some data
            mock.setItem('schema_version', '0');
            mock.setItem('progress_hechrachi', '{"old":"data"}');

            // Re-evaluate storage.js on the SAME mock to reset _available cache
            reloadStorage();

            // Trigger schema check
            Storage.isAvailable();

            // Old data should be gone, new version stamped
            assert.equal(mock.getItem('progress_hechrachi'), null);
            assert.equal(mock.getItem('schema_version'), String(Storage.SCHEMA_VERSION));
        });

        it('preserves data when version matches', function () {
            // First access stamps the version
            Storage.isAvailable();
            mock.setItem('progress_hechrachi', '{"good":"data"}');

            // Re-evaluate on same mock — version already matches
            reloadStorage();
            Storage.isAvailable();

            assert.equal(mock.getItem('progress_hechrachi'), '{"good":"data"}');
        });
    });

    describe('progress', function () {
        it('returns null when no progress saved', function () {
            var result = Storage.loadProgress('hechrachi');
            assert.equal(result, null);
        });

        it('saves and loads progress', function () {
            var data = { system: 'hechrachi', currentTier: 2 };
            assert.equal(Storage.saveProgress('hechrachi', data), true);
            var loaded = Storage.loadProgress('hechrachi');
            assert.deepEqual(loaded, data);
        });

        it('clears progress for a system', function () {
            Storage.saveProgress('hechrachi', { system: 'hechrachi' });
            Storage.clearProgress('hechrachi');
            assert.equal(Storage.loadProgress('hechrachi'), null);
        });

        it('clearAllProgress removes all system data', function () {
            Storage.saveProgress('hechrachi', { system: 'hechrachi' });
            Storage.saveProgress('gadol', { system: 'gadol' });
            Storage.clearAllProgress();
            assert.equal(Storage.loadProgress('hechrachi'), null);
            assert.equal(Storage.loadProgress('gadol'), null);
        });

        it('clearAllProgress preserves settings', function () {
            Storage.saveSettings({ theme: 'dark' });
            Storage.saveProgress('hechrachi', { system: 'hechrachi' });
            Storage.clearAllProgress();
            assert.deepEqual(Storage.loadSettings(), { theme: 'dark' });
        });
    });

    describe('settings', function () {
        it('returns null when no settings saved', function () {
            assert.equal(Storage.loadSettings(), null);
        });

        it('saves and loads settings', function () {
            var settings = { theme: 'dark', sound: true };
            assert.equal(Storage.saveSettings(settings), true);
            assert.deepEqual(Storage.loadSettings(), settings);
        });
    });

    describe('session', function () {
        it('returns null when no session saved', function () {
            assert.equal(Storage.loadSession(), null);
        });

        it('saves and loads session', function () {
            var session = { startedAt: '2026-01-01' };
            assert.equal(Storage.saveSession(session), true);
            assert.deepEqual(Storage.loadSession(), session);
        });

        it('clears session', function () {
            Storage.saveSession({ startedAt: '2026-01-01' });
            Storage.clearSession();
            assert.equal(Storage.loadSession(), null);
        });
    });
});
