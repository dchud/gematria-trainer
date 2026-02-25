/**
 * Tests for settings.js — Settings module.
 *
 * Tests the Settings IIFE's defaults, option arrays, load/save,
 * and applyDefaults with mocked localStorage.
 */

var { describe, it, beforeEach } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

// Load base modules (everything except storage.js and settings.js)
require('./helpers/load-modules');

var jsDir = path.resolve(__dirname, '../../static/js');
var storageCode = fs.readFileSync(path.join(jsDir, 'storage.js'), 'utf8');
var settingsCode = fs.readFileSync(path.join(jsDir, 'settings.js'), 'utf8');

function freshStore() {
    var data = {};
    return {
        getItem: function (key) {
            return Object.hasOwn(data, key) ? data[key] : null;
        },
        setItem: function (key, val) {
            data[key] = String(val);
        },
        removeItem: function (key) {
            delete data[key];
        },
        clear: function () {
            var k;
            for (k in data) {
                if (Object.hasOwn(data, k)) delete data[k];
            }
        },
        _data: data,
    };
}

function setup() {
    globalThis.localStorage = freshStore();
    vm.runInThisContext(storageCode, { filename: 'storage.js' });
    vm.runInThisContext(settingsCode, { filename: 'settings.js' });
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('Settings', function () {
    beforeEach(function () {
        setup();
    });

    describe('DEFAULTS', function () {
        it('has expected keys and values', function () {
            assert.equal(Settings.DEFAULTS.system, 'hechrachi');
            assert.equal(Settings.DEFAULTS.hebrewFont, 'standard');
            assert.equal(Settings.DEFAULTS.darkMode, 'system');
            assert.equal(Settings.DEFAULTS.transition, 'fade');
            assert.equal(Settings.DEFAULTS.transitionDuration, 200);
        });
    });

    describe('SYSTEMS', function () {
        it('has 7 systems', function () {
            assert.equal(Settings.SYSTEMS.length, 7);
        });

        it('has 4 valuation systems', function () {
            var valuations = Settings.SYSTEMS.filter(function (s) {
                return s.type === 'valuation';
            });
            assert.equal(valuations.length, 4);
        });

        it('has 3 cipher systems', function () {
            var ciphers = Settings.SYSTEMS.filter(function (s) {
                return s.type === 'cipher';
            });
            assert.equal(ciphers.length, 3);
        });

        it('each system has required fields', function () {
            Settings.SYSTEMS.forEach(function (sys) {
                assert.ok(sys.key, 'missing key');
                assert.ok(sys.name, 'missing name');
                assert.ok(sys.type, 'missing type');
                assert.ok(sys.description, 'missing description');
            });
        });

        it('system keys match registry', function () {
            Settings.SYSTEMS.forEach(function (sys) {
                var reg = GematriaRegistry.get(sys.key);
                assert.ok(reg, 'system ' + sys.key + ' not in registry');
            });
        });
    });

    describe('FONTS', function () {
        it('has 3 font options', function () {
            assert.equal(Settings.FONTS.length, 3);
        });

        it('each font has required fields', function () {
            Settings.FONTS.forEach(function (font) {
                assert.ok(font.key, 'missing key');
                assert.ok(font.label, 'missing label');
                assert.ok(font.className, 'missing className');
                assert.ok(font.preview, 'missing preview');
            });
        });

        it('includes standard, sans, and rashi', function () {
            var keys = Settings.FONTS.map(function (f) {
                return f.key;
            });
            assert.ok(keys.indexOf('standard') !== -1);
            assert.ok(keys.indexOf('sans') !== -1);
            assert.ok(keys.indexOf('rashi') !== -1);
        });
    });

    describe('TRANSITIONS', function () {
        it('has 3 transition options', function () {
            assert.equal(Settings.TRANSITIONS.length, 3);
        });

        it('includes fade, slide-left, and none', function () {
            var keys = Settings.TRANSITIONS.map(function (t) {
                return t.key;
            });
            assert.ok(keys.indexOf('fade') !== -1);
            assert.ok(keys.indexOf('slide-left') !== -1);
            assert.ok(keys.indexOf('none') !== -1);
        });
    });

    describe('applyDefaults()', function () {
        it('returns defaults when saved is null', function () {
            var result = Settings.applyDefaults(null);
            assert.deepEqual(result, Settings.DEFAULTS);
        });

        it('returns defaults when saved is empty', function () {
            var result = Settings.applyDefaults({});
            assert.deepEqual(result, Settings.DEFAULTS);
        });

        it('merges saved values with defaults', function () {
            var result = Settings.applyDefaults({ system: 'gadol' });
            assert.equal(result.system, 'gadol');
            assert.equal(result.hebrewFont, 'standard');
            assert.equal(result.darkMode, 'system');
            assert.equal(result.transition, 'fade');
            assert.equal(result.transitionDuration, 200);
        });

        it('overwrites all matching keys', function () {
            var saved = {
                system: 'atbash',
                hebrewFont: 'sans',
                darkMode: 'dark',
                transition: 'slide-left',
                transitionDuration: 400,
            };
            var result = Settings.applyDefaults(saved);
            assert.deepEqual(result, saved);
        });

        it('ignores unknown keys in saved data', function () {
            var result = Settings.applyDefaults({ unknownKey: 'value' });
            assert.equal(result.unknownKey, undefined);
            assert.equal(result.system, 'hechrachi');
        });
    });

    describe('load()', function () {
        it('returns defaults when nothing saved', function () {
            var result = Settings.load();
            assert.deepEqual(result, Settings.DEFAULTS);
        });

        it('returns merged settings from localStorage', function () {
            Storage.saveSettings({ system: 'katan', darkMode: 'dark' });
            var result = Settings.load();
            assert.equal(result.system, 'katan');
            assert.equal(result.darkMode, 'dark');
            assert.equal(result.hebrewFont, 'standard');
        });
    });

    describe('save()', function () {
        it('persists settings to localStorage', function () {
            var settings = {
                system: 'gadol',
                hebrewFont: 'sans',
                darkMode: 'light',
                transition: 'none',
                transitionDuration: 0,
            };
            var ok = Settings.save(settings);
            assert.equal(ok, true);

            var loaded = Storage.loadSettings();
            assert.deepEqual(loaded, settings);
        });
    });
});
