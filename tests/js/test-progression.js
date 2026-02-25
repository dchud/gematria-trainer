/**
 * Tests for the Progression module (level advancement and card flow).
 *
 * Requires a localStorage mock since Progression depends on Storage.
 */

var { describe, it, beforeEach } = require('node:test');
var assert = require('node:assert/strict');
var vm = require('node:vm');
var fs = require('node:fs');
var path = require('node:path');

// Load base modules into global scope
require('./helpers/load-modules');

// ---------------------------------------------------------------
// localStorage mock + Storage/Progression reload
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

/**
 * Re-evaluate storage.js and progression.js with a fresh mock
 * localStorage so internal caches are reset.
 */
function reloadModules() {
    var mock = createMockStorage();
    globalThis.localStorage = mock;

    var jsDir = path.resolve(__dirname, '../../static/js');
    var modules = ['storage.js', 'generator.js', 'progression.js'];
    for (var i = 0; i < modules.length; i++) {
        var code = fs.readFileSync(path.join(jsDir, modules[i]), 'utf8');
        vm.runInThisContext(code, { filename: modules[i] });
    }

    return mock;
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe('Progression', function () {
    beforeEach(function () {
        reloadModules();
    });

    describe('createState', function () {
        it('creates a fresh state at level 1', function () {
            var state = Progression.createState('hechrachi');
            assert.equal(state.system, 'hechrachi');
            assert.equal(state.currentLevel, 1);
            assert.equal(state.levelCount, 8);
            assert.equal(state.completed, false);
            assert.deepEqual(state.levels, {});
        });

        it('uses correct level count for 4-level system', function () {
            var state = Progression.createState('katan');
            assert.equal(state.levelCount, 4);
        });

        it('uses correct level count for 3-level system', function () {
            var state = Progression.createState('atbash');
            assert.equal(state.levelCount, 3);
        });
    });

    describe('loadOrCreate', function () {
        it('creates fresh state when nothing saved', function () {
            var state = Progression.loadOrCreate('hechrachi');
            assert.equal(state.system, 'hechrachi');
            assert.equal(state.currentLevel, 1);
        });

        it('loads saved state from storage', function () {
            var saved = Progression.createState('hechrachi');
            saved.currentLevel = 3;
            Progression.save(saved);

            var loaded = Progression.loadOrCreate('hechrachi');
            assert.equal(loaded.currentLevel, 3);
        });

        it('ignores saved state for wrong system', function () {
            // Save data keyed to hechrachi but with a different system field
            Storage.saveProgress('hechrachi', { system: 'gadol', currentLevel: 5 });
            var loaded = Progression.loadOrCreate('hechrachi');
            // Should create fresh, not use the mismatched data
            assert.equal(loaded.currentLevel, 1);
        });
    });

    describe('ensureLevelCards', function () {
        it('initializes cards for a level on first access', function () {
            var state = Progression.createState('hechrachi');
            var cards = Progression.ensureLevelCards(state, 1);
            assert.ok(cards.length > 0);
            assert.ok(state.levels['1']);
        });

        it('returns existing cards on subsequent access', function () {
            var state = Progression.createState('hechrachi');
            var first = Progression.ensureLevelCards(state, 1);
            var second = Progression.ensureLevelCards(state, 1);
            assert.equal(first, second);
        });
    });

    describe('currentLevelCards / currentLevelSpecs', function () {
        it('returns cards and specs for the current level', function () {
            var state = Progression.createState('hechrachi');
            var cards = Progression.currentLevelCards(state);
            var specs = Progression.currentLevelSpecs(state);
            assert.equal(cards.length, specs.length);
        });
    });

    describe('tryAdvance', function () {
        it('returns not advanced when mastery not met', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);
            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, false);
            assert.equal(result.completed, false);
        });

        it('advances to next level when mastery is met', function () {
            var state = Progression.createState('katan');
            var cards = Progression.ensureLevelCards(state, 1);

            // Master all cards: review 3 times each with quality 5
            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            state.levels['1'] = cards;

            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, true);
            assert.equal(result.newLevel, 2);
            assert.equal(state.currentLevel, 2);
        });

        it('marks completed when last static level is mastered (4-level)', function () {
            var state = Progression.createState('katan');
            state.currentLevel = 4;
            var cards = Progression.ensureLevelCards(state, 4);

            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            state.levels['4'] = cards;

            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, false);
            assert.equal(result.completed, true);
            assert.equal(state.completed, true);
        });

        it('advances past level 4 to procedural level 5 for 8-level systems', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 4;
            var cards = Progression.ensureLevelCards(state, 4);

            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            state.levels['4'] = cards;

            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, true);
            assert.equal(result.newLevel, 5);
        });
    });

    describe('nextCard', function () {
        it('selects from current level in normal mode', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);
            var result = Progression.nextCard(state);
            assert.equal(result.type, 'card');
            assert.ok(result.card);
            assert.ok(result.spec);
        });

        it('selects from all levels in completed mode', function () {
            var state = Progression.createState('atbash');
            state.completed = true;
            // Initialize levels 1 through 3
            Progression.ensureLevelCards(state, 1);
            Progression.ensureLevelCards(state, 2);
            Progression.ensureLevelCards(state, 3);
            state.currentLevel = 3;

            var result = Progression.nextCard(state);
            assert.ok(result);
            assert.ok(result.type);
        });
    });

    describe('recordReview', function () {
        it('updates card state and returns result', function () {
            var state = Progression.createState('hechrachi');
            var cards = Progression.ensureLevelCards(state, 1);
            var cardId = cards[0].card_id;

            var result = Progression.recordReview(state, cardId, 4);
            assert.ok(result.card);
            assert.equal(result.card.review_count, 1);
            assert.equal(result.card.correct_count, 1);
            assert.ok(result.advancement);
        });

        it('returns null card for unknown card ID', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);

            var result = Progression.recordReview(state, 'nonexistent', 4);
            assert.equal(result.card, null);
        });

        it('persists to storage after review', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);
            var cardId = state.levels['1'][0].card_id;

            Progression.recordReview(state, cardId, 4);

            // Verify it was saved
            var saved = Storage.loadProgress('hechrachi');
            assert.ok(saved);
            assert.equal(saved.system, 'hechrachi');
        });
    });

    describe('reset', function () {
        it('returns fresh state', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 3;
            Progression.save(state);

            var fresh = Progression.reset('hechrachi');
            assert.equal(fresh.currentLevel, 1);
            assert.deepEqual(fresh.levels, {});
        });

        it('clears saved progress', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 3;
            Progression.save(state);

            Progression.reset('hechrachi');
            var loaded = Progression.loadOrCreate('hechrachi');
            assert.equal(loaded.currentLevel, 1);
        });
    });

    describe('allCards / allSpecs', function () {
        it('returns cards from all initialized levels', function () {
            var state = Progression.createState('katan');
            Progression.ensureLevelCards(state, 1);
            Progression.ensureLevelCards(state, 2);
            state.currentLevel = 2;

            var all = Progression.allCards(state);
            var level1 = state.levels['1'].length;
            var level2 = state.levels['2'].length;
            assert.equal(all.length, level1 + level2);
        });

        it('allSpecs returns specs up to current level', function () {
            var state = Progression.createState('katan');
            state.currentLevel = 2;

            var specs = Progression.allSpecs(state);
            var level1Specs = Levels.getCards('katan', 1);
            var level2Specs = Levels.getCards('katan', 2);
            assert.equal(specs.length, level1Specs.length + level2Specs.length);
        });
    });

    describe('procedural levels', function () {
        it('createState includes seeds for 8-level systems', function () {
            var state = Progression.createState('hechrachi');
            assert.ok(state.seeds);
            assert.equal(typeof state.seeds[5], 'number');
            assert.equal(typeof state.seeds[6], 'number');
            assert.equal(typeof state.seeds[7], 'number');
            assert.equal(typeof state.seeds[8], 'number');
        });

        it('createState has empty seeds for non-8-level systems', function () {
            var state = Progression.createState('katan');
            assert.deepEqual(state.seeds, {});
        });

        it('createState initializes empty levelSpecs', function () {
            var state = Progression.createState('hechrachi');
            assert.deepEqual(state.levelSpecs, {});
        });

        it('ensureLevelCards generates procedural cards for level 5', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 5;
            var cards = Progression.ensureLevelCards(state, 5);
            assert.ok(cards.length > 0);
            assert.equal(cards.length, 24);
        });

        it('caches generated specs in levelSpecs', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 5;
            Progression.ensureLevelCards(state, 5);
            assert.ok(state.levelSpecs['5']);
            assert.equal(state.levelSpecs['5'].length, 24);
        });

        it('currentLevelSpecs returns cached specs for procedural levels', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 5;
            Progression.ensureLevelCards(state, 5);
            var specs = Progression.currentLevelSpecs(state);
            assert.equal(specs.length, 24);
            assert.equal(specs[0].id.indexOf('gen-t5'), 0);
        });

        it('allSpecs includes both static and procedural specs', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 5;
            // Ensure levels 1-5 exist
            Progression.ensureLevelCards(state, 1);
            Progression.ensureLevelCards(state, 2);
            Progression.ensureLevelCards(state, 3);
            Progression.ensureLevelCards(state, 4);
            Progression.ensureLevelCards(state, 5);

            var specs = Progression.allSpecs(state);
            var staticCount =
                Levels.getCards('hechrachi', 1).length +
                Levels.getCards('hechrachi', 2).length +
                Levels.getCards('hechrachi', 3).length +
                Levels.getCards('hechrachi', 4).length;
            assert.equal(specs.length, staticCount + 24);
        });

        it('reset generates new seeds', function () {
            var state = Progression.createState('hechrachi');
            var oldSeed5 = state.seeds[5];
            // Reset gets fresh state with new seeds
            var fresh = Progression.reset('hechrachi');
            // Seeds are random, so we just verify they exist
            assert.equal(typeof fresh.seeds[5], 'number');
            assert.deepEqual(fresh.levelSpecs, {});
        });

        it('marks completed when last procedural level is mastered', function () {
            var state = Progression.createState('hechrachi');
            state.currentLevel = 8;
            var cards = Progression.ensureLevelCards(state, 8);

            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            state.levels['8'] = cards;

            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, false);
            assert.equal(result.completed, true);
        });
    });

    describe('reviewLog', function () {
        it('createState initializes empty reviewLog', function () {
            var state = Progression.createState('hechrachi');
            assert.ok(Array.isArray(state.reviewLog));
            assert.equal(state.reviewLog.length, 0);
        });

        it('recordReview appends to reviewLog', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);
            var cardId = state.levels['1'][0].card_id;

            Progression.recordReview(state, cardId, 4);
            assert.equal(state.reviewLog.length, 1);
            assert.equal(typeof state.reviewLog[0].ts, 'number');
            assert.equal(state.reviewLog[0].correct, true);
        });

        it('marks incorrect for quality < 3', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);
            var cardId = state.levels['1'][0].card_id;

            Progression.recordReview(state, cardId, 1);
            assert.equal(state.reviewLog[0].correct, false);
        });

        it('caps reviewLog at 500 entries', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);
            var cardId = state.levels['1'][0].card_id;

            // Pre-fill with 500 entries
            state.reviewLog = [];
            for (var i = 0; i < 500; i++) {
                state.reviewLog.push({ ts: i, correct: true });
            }

            Progression.recordReview(state, cardId, 4);
            assert.equal(state.reviewLog.length, 500);
            // First entry should have been shifted out
            assert.equal(state.reviewLog[0].ts, 1);
        });

        it('does not append for unknown card', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureLevelCards(state, 1);

            Progression.recordReview(state, 'nonexistent', 4);
            assert.equal(state.reviewLog.length, 0);
        });
    });
});
