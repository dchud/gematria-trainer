/**
 * Tests for the Tiers module (tier definitions and card generation).
 */

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

require('./helpers/load-modules');

describe('Tiers', function () {
    describe('tierCount', function () {
        it('returns 8 for hechrachi and gadol', function () {
            assert.equal(Tiers.tierCount('hechrachi'), 8);
            assert.equal(Tiers.tierCount('gadol'), 8);
        });

        it('returns 4 for katan and siduri', function () {
            assert.equal(Tiers.tierCount('katan'), 4);
            assert.equal(Tiers.tierCount('siduri'), 4);
        });

        it('returns 3 for cipher systems', function () {
            assert.equal(Tiers.tierCount('atbash'), 3);
            assert.equal(Tiers.tierCount('albam'), 3);
            assert.equal(Tiers.tierCount('avgad'), 3);
        });

        it('returns 0 for unknown system', function () {
            assert.equal(Tiers.tierCount('unknown'), 0);
        });
    });

    describe('tierLetter', function () {
        it('returns Hebrew letters for valid tiers', function () {
            assert.equal(Tiers.tierLetter(1), '\u05D0'); // א
            assert.equal(Tiers.tierLetter(2), '\u05D1'); // ב
            assert.equal(Tiers.tierLetter(8), '\u05D7'); // ח
        });

        it('returns empty string for invalid tiers', function () {
            assert.equal(Tiers.tierLetter(0), '');
            assert.equal(Tiers.tierLetter(9), '');
        });
    });

    describe('MASTERY', function () {
        it('requires 80% accuracy and 3 minimum reps', function () {
            assert.equal(Tiers.MASTERY.accuracy, 0.8);
            assert.equal(Tiers.MASTERY.minReps, 3);
        });
    });

    describe('isStatic', function () {
        it('returns true for 8-tier tiers 1-4', function () {
            for (var t = 1; t <= 4; t++) {
                assert.ok(Tiers.isStatic('hechrachi', t));
            }
        });

        it('returns false for 8-tier tiers 5-8', function () {
            for (var t = 5; t <= 8; t++) {
                assert.equal(Tiers.isStatic('hechrachi', t), false);
            }
        });

        it('returns true for all 4-tier tiers', function () {
            for (var t = 1; t <= 4; t++) {
                assert.ok(Tiers.isStatic('katan', t));
            }
        });

        it('returns true for all 3-tier tiers', function () {
            for (var t = 1; t <= 3; t++) {
                assert.ok(Tiers.isStatic('atbash', t));
            }
        });
    });

    describe('getCards - 8-tier systems', function () {
        it('tier 1: letters alef-tet, both directions', function () {
            var cards = Tiers.getCards('hechrachi', 1);
            // 9 letters * 2 directions = 18 cards
            assert.equal(cards.length, 18);
            // First card should be letter-to-value for alef
            assert.equal(cards[0].id, 'alef-to-val');
            assert.equal(cards[0].type, 'letter-to-value');
            assert.equal(cards[0].prompt, '\u05D0');
            assert.equal(cards[0].answer, '1');
            // Second card should be value-to-letter for alef
            assert.equal(cards[1].id, 'val-to-alef');
            assert.equal(cards[1].type, 'value-to-letter');
        });

        it('tier 2: letters yod-tsade, both directions', function () {
            var cards = Tiers.getCards('hechrachi', 2);
            assert.equal(cards.length, 18); // 9 letters * 2
            assert.equal(cards[0].prompt, '\u05D9'); // Yod
            assert.equal(cards[0].answer, '10');
        });

        it('tier 3: letters qof-tav, both directions', function () {
            var cards = Tiers.getCards('hechrachi', 3);
            assert.equal(cards.length, 8); // 4 letters * 2
            assert.equal(cards[0].prompt, '\u05E7'); // Qof
            assert.equal(cards[0].answer, '100');
        });

        it('tier 4: final forms, both directions', function () {
            var cards = Tiers.getCards('hechrachi', 4);
            assert.equal(cards.length, 10); // 5 finals * 2
        });

        it('tiers 5-8 return empty (procedural)', function () {
            for (var t = 5; t <= 8; t++) {
                assert.equal(Tiers.getCards('hechrachi', t).length, 0);
            }
        });

        it('gadol tier 4 has different values than hechrachi', function () {
            var gadolCards = Tiers.getCards('gadol', 4);
            var hechrachiCards = Tiers.getCards('hechrachi', 4);
            // Find the first letter-to-value card in each
            var gadolVal = gadolCards[0].answer;
            var hechrachiVal = hechrachiCards[0].answer;
            assert.notEqual(gadolVal, hechrachiVal);
        });
    });

    describe('getCards - 4-tier systems', function () {
        it('tier 1: first 9 letters', function () {
            var cards = Tiers.getCards('katan', 1);
            assert.equal(cards.length, 18);
        });

        it('tier 2: next 9 letters', function () {
            var cards = Tiers.getCards('katan', 2);
            assert.equal(cards.length, 18);
        });

        it('tier 3: last 4 + 5 finals', function () {
            var cards = Tiers.getCards('katan', 3);
            assert.equal(cards.length, 18); // (4 + 5) * 2
        });

        it('tier 4: all letters + finals (cumulative)', function () {
            var cards = Tiers.getCards('katan', 4);
            // 22 base + 5 finals = 27, * 2 directions = 54
            assert.equal(cards.length, 54);
        });
    });

    describe('getCards - 3-tier cipher systems', function () {
        it('tier 1: first 11 letters, forward only', function () {
            var cards = Tiers.getCards('atbash', 1);
            assert.equal(cards.length, 11);
            assert.equal(cards[0].type, 'cipher-forward');
        });

        it('tier 2: last 11 letters, forward only', function () {
            var cards = Tiers.getCards('atbash', 2);
            assert.equal(cards.length, 11);
        });

        it('tier 3 atbash: all 22, forward only (symmetric)', function () {
            var cards = Tiers.getCards('atbash', 3);
            assert.equal(cards.length, 22);
        });

        it('tier 3 avgad: all 22 forward + 22 reverse', function () {
            var cards = Tiers.getCards('avgad', 3);
            assert.equal(cards.length, 44); // 22 forward + 22 reverse
            // Check that reverse cards exist
            var reverseCards = cards.filter(function (c) {
                return c.type === 'cipher-reverse';
            });
            assert.equal(reverseCards.length, 22);
        });
    });

    describe('getCards - edge cases', function () {
        it('returns empty for tier 0', function () {
            assert.equal(Tiers.getCards('hechrachi', 0).length, 0);
        });

        it('returns empty for tier beyond count', function () {
            assert.equal(Tiers.getCards('hechrachi', 9).length, 0);
            assert.equal(Tiers.getCards('katan', 5).length, 0);
            assert.equal(Tiers.getCards('atbash', 4).length, 0);
        });

        it('returns empty for unknown system', function () {
            assert.equal(Tiers.getCards('unknown', 1).length, 0);
        });
    });

    describe('card ID stability', function () {
        it('generates consistent IDs across calls', function () {
            var cards1 = Tiers.getCards('hechrachi', 1);
            var cards2 = Tiers.getCards('hechrachi', 1);
            assert.deepEqual(
                cards1.map(function (c) {
                    return c.id;
                }),
                cards2.map(function (c) {
                    return c.id;
                }),
            );
        });

        it('uses letter name slugs in IDs', function () {
            var cards = Tiers.getCards('hechrachi', 1);
            assert.ok(cards[0].id.indexOf('alef') >= 0);
        });
    });
});
