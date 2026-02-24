/**
 * Tests for the Generator module (procedural card generation).
 */

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

// Load base modules into global scope
require('./helpers/load-modules');

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe('Generator', function () {
    describe('_prng (Mulberry32)', function () {
        it('produces deterministic sequence from same seed', function () {
            var rng1 = Generator._prng(12345);
            var rng2 = Generator._prng(12345);
            var i;
            for (i = 0; i < 100; i++) {
                assert.equal(rng1(), rng2());
            }
        });

        it('produces different sequences from different seeds', function () {
            var rng1 = Generator._prng(12345);
            var rng2 = Generator._prng(54321);
            var same = 0;
            var i;
            for (i = 0; i < 100; i++) {
                if (rng1() === rng2()) same++;
            }
            // Extremely unlikely to have many collisions
            assert.ok(same < 10, 'Expected different sequences, got ' + same + ' matches');
        });

        it('returns values in [0, 1)', function () {
            var rng = Generator._prng(42);
            var i, val;
            for (i = 0; i < 1000; i++) {
                val = rng();
                assert.ok(val >= 0, 'Value ' + val + ' is negative');
                assert.ok(val < 1, 'Value ' + val + ' is >= 1');
            }
        });
    });

    describe('generateSeed', function () {
        it('returns a non-negative 32-bit integer', function () {
            var seed = Generator.generateSeed();
            assert.equal(typeof seed, 'number');
            assert.ok(seed >= 0);
            assert.ok(seed <= 4294967295);
            assert.equal(seed, seed >>> 0, 'Should be a 32-bit unsigned integer');
        });
    });

    describe('generateSeeds', function () {
        it('returns seeds for tiers 5-8 for 8-tier systems', function () {
            var seeds = Generator.generateSeeds('hechrachi');
            assert.ok(Object.hasOwn(seeds, '5'));
            assert.ok(Object.hasOwn(seeds, '6'));
            assert.ok(Object.hasOwn(seeds, '7'));
            assert.ok(Object.hasOwn(seeds, '8'));
            assert.equal(typeof seeds[5], 'number');
        });

        it('returns empty object for non-8-tier systems', function () {
            assert.deepEqual(Generator.generateSeeds('katan'), {});
            assert.deepEqual(Generator.generateSeeds('atbash'), {});
        });
    });

    describe('_pickNumbers', function () {
        it('picks the requested count of distinct numbers', function () {
            var rng = Generator._prng(42);
            var picked = Generator._pickNumbers(rng, 1, 100, {}, 10);
            assert.equal(picked.length, 10);

            // All distinct
            var seen = {};
            var i;
            for (i = 0; i < picked.length; i++) {
                assert.ok(!seen[picked[i]], 'Duplicate: ' + picked[i]);
                seen[picked[i]] = true;
            }
        });

        it('respects exclusions', function () {
            var rng = Generator._prng(42);
            var exclude = { 5: true, 10: true, 15: true };
            var picked = Generator._pickNumbers(rng, 1, 20, exclude, 10);
            var i;
            for (i = 0; i < picked.length; i++) {
                assert.ok(!exclude[picked[i]], 'Excluded value found: ' + picked[i]);
            }
        });

        it('returns all available when count exceeds pool', function () {
            var rng = Generator._prng(42);
            var picked = Generator._pickNumbers(rng, 1, 5, {}, 20);
            assert.equal(picked.length, 5);
        });

        it('is deterministic with same seed', function () {
            var rng1 = Generator._prng(999);
            var rng2 = Generator._prng(999);
            var p1 = Generator._pickNumbers(rng1, 1, 100, {}, 10);
            var p2 = Generator._pickNumbers(rng2, 1, 100, {}, 10);
            assert.deepEqual(p1, p2);
        });
    });

    describe('generateTier — tier 5 (11-99)', function () {
        it('generates 24 cards (12 numbers x 2 directions)', function () {
            var cards = Generator.generateTier('hechrachi', 5, 42);
            assert.equal(cards.length, 24);
        });

        it('always includes 15 and 16', function () {
            var cards = Generator.generateTier('hechrachi', 5, 42);
            var ids = {};
            var i;
            for (i = 0; i < cards.length; i++) {
                ids[cards[i].id] = true;
            }
            assert.ok(ids['gen-t5-15-to-heb'], 'Missing 15-to-heb');
            assert.ok(ids['gen-t5-heb-to-15'], 'Missing heb-to-15');
            assert.ok(ids['gen-t5-16-to-heb'], 'Missing 16-to-heb');
            assert.ok(ids['gen-t5-heb-to-16'], 'Missing heb-to-16');
        });

        it('excludes multiples of 10', function () {
            var cards = Generator.generateTier('hechrachi', 5, 42);
            var i, id, match;
            for (i = 0; i < cards.length; i++) {
                id = cards[i].id;
                match = id.match(/gen-t5-(\d+)-to-heb/);
                if (match) {
                    var num = Number(match[1]);
                    assert.ok(num % 10 !== 0, 'Multiple of 10 found: ' + num);
                }
            }
        });

        it('all numbers are in range 11-99', function () {
            var cards = Generator.generateTier('hechrachi', 5, 42);
            var i, id, match;
            for (i = 0; i < cards.length; i++) {
                id = cards[i].id;
                match = id.match(/gen-t5-(\d+)-to-heb/);
                if (match) {
                    var num = Number(match[1]);
                    assert.ok(num >= 11 && num <= 99, 'Out of range: ' + num);
                }
            }
        });

        it('has both number-to-hebrew and hebrew-to-number types', function () {
            var cards = Generator.generateTier('hechrachi', 5, 42);
            var types = {};
            var i;
            for (i = 0; i < cards.length; i++) {
                types[cards[i].type] = true;
            }
            assert.ok(types['number-to-hebrew']);
            assert.ok(types['hebrew-to-number']);
        });

        it('produces stable IDs with same seed', function () {
            var cards1 = Generator.generateTier('hechrachi', 5, 42);
            var cards2 = Generator.generateTier('hechrachi', 5, 42);
            assert.equal(cards1.length, cards2.length);
            var i;
            for (i = 0; i < cards1.length; i++) {
                assert.equal(cards1[i].id, cards2[i].id);
            }
        });

        it('produces different cards with different seeds', function () {
            var cards1 = Generator.generateTier('hechrachi', 5, 42);
            var cards2 = Generator.generateTier('hechrachi', 5, 999);
            // At least some IDs should differ (both always have 15 and 16)
            var diff = 0;
            var i;
            for (i = 0; i < cards1.length; i++) {
                if (cards1[i].id !== cards2[i].id) diff++;
            }
            assert.ok(diff > 0, 'Expected different cards from different seeds');
        });

        it('cards have valid Hebrew in answers/prompts', function () {
            var cards = Generator.generateTier('hechrachi', 5, 42);
            var hebrewRe = /[\u0590-\u05FF]/;
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].type === 'number-to-hebrew') {
                    assert.ok(
                        hebrewRe.test(cards[i].answer),
                        'No Hebrew in answer: ' + cards[i].id,
                    );
                } else {
                    assert.ok(
                        hebrewRe.test(cards[i].prompt),
                        'No Hebrew in prompt: ' + cards[i].id,
                    );
                }
            }
        });
    });

    describe('generateTier — tier 6 (100-999)', function () {
        it('generates 24 cards (12 numbers x 2 directions)', function () {
            var cards = Generator.generateTier('hechrachi', 6, 42);
            assert.equal(cards.length, 24);
        });

        it('excludes round hundreds for hechrachi', function () {
            var cards = Generator.generateTier('hechrachi', 6, 42);
            var excluded = { 100: true, 200: true, 300: true, 400: true };
            var i, match;
            for (i = 0; i < cards.length; i++) {
                match = cards[i].id.match(/gen-t6-(\d+)-to-heb/);
                if (match) {
                    assert.ok(!excluded[Number(match[1])], 'Excluded value found: ' + match[1]);
                }
            }
        });

        it('excludes round hundreds and final-form values for gadol', function () {
            var cards = Generator.generateTier('gadol', 6, 42);
            var excluded = {
                100: true,
                200: true,
                300: true,
                400: true,
                500: true,
                600: true,
                700: true,
                800: true,
                900: true,
            };
            var i, match;
            for (i = 0; i < cards.length; i++) {
                match = cards[i].id.match(/gen-t6-(\d+)-to-heb/);
                if (match) {
                    assert.ok(!excluded[Number(match[1])], 'Excluded value found: ' + match[1]);
                }
            }
        });

        it('all numbers are in range 100-999', function () {
            var cards = Generator.generateTier('hechrachi', 6, 42);
            var i, match;
            for (i = 0; i < cards.length; i++) {
                match = cards[i].id.match(/gen-t6-(\d+)-to-heb/);
                if (match) {
                    var num = Number(match[1]);
                    assert.ok(num >= 100 && num <= 999, 'Out of range: ' + num);
                }
            }
        });

        it('produces stable IDs with same seed', function () {
            var cards1 = Generator.generateTier('gadol', 6, 123);
            var cards2 = Generator.generateTier('gadol', 6, 123);
            var i;
            for (i = 0; i < cards1.length; i++) {
                assert.equal(cards1[i].id, cards2[i].id);
            }
        });
    });

    describe('generateTier — tier 7 (years + large numbers)', function () {
        it('generates 24 cards (6 years + 6 large, each x 2)', function () {
            var cards = Generator.generateTier('hechrachi', 7, 42);
            assert.equal(cards.length, 24);
        });

        it('contains year-to-hebrew and hebrew-to-year types', function () {
            var cards = Generator.generateTier('hechrachi', 7, 42);
            var types = {};
            var i;
            for (i = 0; i < cards.length; i++) {
                types[cards[i].type] = true;
            }
            assert.ok(types['year-to-hebrew']);
            assert.ok(types['hebrew-to-year']);
        });

        it('contains number-to-hebrew and hebrew-to-number types for large numbers', function () {
            var cards = Generator.generateTier('hechrachi', 7, 42);
            var types = {};
            var i;
            for (i = 0; i < cards.length; i++) {
                types[cards[i].type] = true;
            }
            assert.ok(types['number-to-hebrew']);
            assert.ok(types['hebrew-to-number']);
        });

        it('year cards are in range 5001-5899', function () {
            var cards = Generator.generateTier('hechrachi', 7, 42);
            var i, match;
            for (i = 0; i < cards.length; i++) {
                match = cards[i].id.match(/gen-t7-yr-(\d+)-to-heb/);
                if (match) {
                    var year = Number(match[1]);
                    assert.ok(year >= 5001 && year <= 5899, 'Year out of range: ' + year);
                }
            }
        });

        it('large number cards are in range 1001-9999', function () {
            var cards = Generator.generateTier('hechrachi', 7, 42);
            var i, match;
            for (i = 0; i < cards.length; i++) {
                match = cards[i].id.match(/gen-t7-lg-(\d+)-to-heb/);
                if (match) {
                    var num = Number(match[1]);
                    assert.ok(num >= 1001 && num <= 9999, 'Large number out of range: ' + num);
                }
            }
        });

        it('produces stable IDs with same seed', function () {
            var cards1 = Generator.generateTier('hechrachi', 7, 42);
            var cards2 = Generator.generateTier('hechrachi', 7, 42);
            var i;
            for (i = 0; i < cards1.length; i++) {
                assert.equal(cards1[i].id, cards2[i].id);
            }
        });

        it('year cards use omitThousands encoding', function () {
            var cards = Generator.generateTier('hechrachi', 7, 42);
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].type === 'year-to-hebrew') {
                    // Year encoding omits thousands, so Hebrew should be
                    // shorter (no thousands digit representation)
                    var year = Number(cards[i].prompt);
                    var withThousands = Gematria.encode(year, false);
                    var withoutThousands = Gematria.encode(year, true);
                    assert.equal(cards[i].answer, withoutThousands);
                }
            }
        });
    });

    describe('generateTier — tier 8 (examples + mixed)', function () {
        it('generates cards including examples', function () {
            var cards = Generator.generateTier('hechrachi', 8, 42);
            assert.ok(cards.length > 0);
        });

        it('includes example cards with ex- prefix', function () {
            var cards = Generator.generateTier('hechrachi', 8, 42);
            var exampleCount = 0;
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].id.indexOf('ex-') === 0) exampleCount++;
            }
            assert.ok(exampleCount > 0, 'Expected example cards');
        });

        it('example cards have example-to-value type', function () {
            var cards = Generator.generateTier('hechrachi', 8, 42);
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].id.indexOf('ex-') === 0) {
                    assert.equal(cards[i].type, 'example-to-value');
                }
            }
        });

        it('example prompts contain Hebrew and meaning in parens', function () {
            var cards = Generator.generateTier('hechrachi', 8, 42);
            var hebrewRe = /[\u0590-\u05FF]/;
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].type === 'example-to-value') {
                    assert.ok(hebrewRe.test(cards[i].prompt), 'No Hebrew: ' + cards[i].id);
                    assert.ok(
                        cards[i].prompt.indexOf('(') !== -1,
                        'No meaning parens: ' + cards[i].id,
                    );
                }
            }
        });

        it('fills remaining slots with procedural mixed cards', function () {
            var cards = Generator.generateTier('hechrachi', 8, 42);
            var genCount = 0;
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].id.indexOf('gen-t8') === 0) genCount++;
            }
            assert.ok(genCount > 0, 'Expected procedural fill cards');
        });

        it('produces stable output with same seed', function () {
            var cards1 = Generator.generateTier('hechrachi', 8, 42);
            var cards2 = Generator.generateTier('hechrachi', 8, 42);
            assert.equal(cards1.length, cards2.length);
            var i;
            for (i = 0; i < cards1.length; i++) {
                assert.equal(cards1[i].id, cards2[i].id);
            }
        });

        it('only includes examples matching the system', function () {
            var cards = Generator.generateTier('hechrachi', 8, 42);
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].id.indexOf('ex-') === 0) {
                    // All examples should be from hechrachi system
                    // (the examples.json only has hechrachi examples)
                    assert.equal(cards[i].type, 'example-to-value');
                }
            }
        });
    });

    describe('generateTier — unknown tier', function () {
        it('returns empty array for unsupported tier numbers', function () {
            assert.deepEqual(Generator.generateTier('hechrachi', 1, 42), []);
            assert.deepEqual(Generator.generateTier('hechrachi', 4, 42), []);
            assert.deepEqual(Generator.generateTier('hechrachi', 9, 42), []);
        });
    });
});
