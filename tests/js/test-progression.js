/**
 * Tests for the Progression module (tier advancement and card flow).
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
    var modules = ['storage.js', 'progression.js'];
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
        it('creates a fresh state at tier 1', function () {
            var state = Progression.createState('hechrachi');
            assert.equal(state.system, 'hechrachi');
            assert.equal(state.currentTier, 1);
            assert.equal(state.tierCount, 8);
            assert.equal(state.completed, false);
            assert.deepEqual(state.tiers, {});
        });

        it('uses correct tier count for 4-tier system', function () {
            var state = Progression.createState('katan');
            assert.equal(state.tierCount, 4);
        });

        it('uses correct tier count for 3-tier system', function () {
            var state = Progression.createState('atbash');
            assert.equal(state.tierCount, 3);
        });
    });

    describe('loadOrCreate', function () {
        it('creates fresh state when nothing saved', function () {
            var state = Progression.loadOrCreate('hechrachi');
            assert.equal(state.system, 'hechrachi');
            assert.equal(state.currentTier, 1);
        });

        it('loads saved state from storage', function () {
            var saved = Progression.createState('hechrachi');
            saved.currentTier = 3;
            Progression.save(saved);

            var loaded = Progression.loadOrCreate('hechrachi');
            assert.equal(loaded.currentTier, 3);
        });

        it('ignores saved state for wrong system', function () {
            // Save data keyed to hechrachi but with a different system field
            Storage.saveProgress('hechrachi', { system: 'gadol', currentTier: 5 });
            var loaded = Progression.loadOrCreate('hechrachi');
            // Should create fresh, not use the mismatched data
            assert.equal(loaded.currentTier, 1);
        });
    });

    describe('ensureTierCards', function () {
        it('initializes cards for a tier on first access', function () {
            var state = Progression.createState('hechrachi');
            var cards = Progression.ensureTierCards(state, 1);
            assert.ok(cards.length > 0);
            assert.ok(state.tiers['1']);
        });

        it('returns existing cards on subsequent access', function () {
            var state = Progression.createState('hechrachi');
            var first = Progression.ensureTierCards(state, 1);
            var second = Progression.ensureTierCards(state, 1);
            assert.equal(first, second);
        });
    });

    describe('currentTierCards / currentTierSpecs', function () {
        it('returns cards and specs for the current tier', function () {
            var state = Progression.createState('hechrachi');
            var cards = Progression.currentTierCards(state);
            var specs = Progression.currentTierSpecs(state);
            assert.equal(cards.length, specs.length);
        });
    });

    describe('tryAdvance', function () {
        it('returns not advanced when mastery not met', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureTierCards(state, 1);
            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, false);
            assert.equal(result.completed, false);
        });

        it('advances to next tier when mastery is met', function () {
            var state = Progression.createState('katan');
            var cards = Progression.ensureTierCards(state, 1);

            // Master all cards: review 3 times each with quality 5
            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            state.tiers['1'] = cards;

            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, true);
            assert.equal(result.newTier, 2);
            assert.equal(state.currentTier, 2);
        });

        it('marks completed when last static tier is mastered (4-tier)', function () {
            var state = Progression.createState('katan');
            state.currentTier = 4;
            var cards = Progression.ensureTierCards(state, 4);

            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            state.tiers['4'] = cards;

            var result = Progression.tryAdvance(state);
            assert.equal(result.advanced, false);
            assert.equal(result.completed, true);
            assert.equal(state.completed, true);
        });

        it('stops at tier 4 for 8-tier systems (procedural tiers not ready)', function () {
            var state = Progression.createState('hechrachi');
            state.currentTier = 4;
            var cards = Progression.ensureTierCards(state, 4);

            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            state.tiers['4'] = cards;

            var result = Progression.tryAdvance(state);
            // Should mark completed rather than advancing to empty tier 5
            assert.equal(result.advanced, false);
            assert.equal(result.completed, true);
        });
    });

    describe('nextCard', function () {
        it('selects from current tier in normal mode', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureTierCards(state, 1);
            var result = Progression.nextCard(state);
            assert.equal(result.type, 'card');
            assert.ok(result.card);
            assert.ok(result.spec);
        });

        it('selects from all tiers in completed mode', function () {
            var state = Progression.createState('atbash');
            state.completed = true;
            // Initialize tiers 1 through 3
            Progression.ensureTierCards(state, 1);
            Progression.ensureTierCards(state, 2);
            Progression.ensureTierCards(state, 3);
            state.currentTier = 3;

            var result = Progression.nextCard(state);
            assert.ok(result);
            assert.ok(result.type);
        });
    });

    describe('recordReview', function () {
        it('updates card state and returns result', function () {
            var state = Progression.createState('hechrachi');
            var cards = Progression.ensureTierCards(state, 1);
            var cardId = cards[0].card_id;

            var result = Progression.recordReview(state, cardId, 4);
            assert.ok(result.card);
            assert.equal(result.card.review_count, 1);
            assert.equal(result.card.correct_count, 1);
            assert.ok(result.advancement);
        });

        it('returns null card for unknown card ID', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureTierCards(state, 1);

            var result = Progression.recordReview(state, 'nonexistent', 4);
            assert.equal(result.card, null);
        });

        it('persists to storage after review', function () {
            var state = Progression.createState('hechrachi');
            Progression.ensureTierCards(state, 1);
            var cardId = state.tiers['1'][0].card_id;

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
            state.currentTier = 3;
            Progression.save(state);

            var fresh = Progression.reset('hechrachi');
            assert.equal(fresh.currentTier, 1);
            assert.deepEqual(fresh.tiers, {});
        });

        it('clears saved progress', function () {
            var state = Progression.createState('hechrachi');
            state.currentTier = 3;
            Progression.save(state);

            Progression.reset('hechrachi');
            var loaded = Progression.loadOrCreate('hechrachi');
            assert.equal(loaded.currentTier, 1);
        });
    });

    describe('allCards / allSpecs', function () {
        it('returns cards from all initialized tiers', function () {
            var state = Progression.createState('katan');
            Progression.ensureTierCards(state, 1);
            Progression.ensureTierCards(state, 2);
            state.currentTier = 2;

            var all = Progression.allCards(state);
            var tier1 = state.tiers['1'].length;
            var tier2 = state.tiers['2'].length;
            assert.equal(all.length, tier1 + tier2);
        });

        it('allSpecs returns specs up to current tier', function () {
            var state = Progression.createState('katan');
            state.currentTier = 2;

            var specs = Progression.allSpecs(state);
            var tier1Specs = Tiers.getCards('katan', 1);
            var tier2Specs = Tiers.getCards('katan', 2);
            assert.equal(specs.length, tier1Specs.length + tier2Specs.length);
        });
    });
});
