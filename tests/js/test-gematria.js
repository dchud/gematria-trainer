/**
 * Tests for the Gematria module (valuation and cipher systems).
 */

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

require('./helpers/load-modules');

describe('Gematria', function () {
    describe('alphabet', function () {
        it('returns 22 base letters', function () {
            assert.equal(Gematria.alphabet().length, 22);
        });

        it('starts with Alef and ends with Tav', function () {
            var alpha = Gematria.alphabet();
            assert.equal(alpha[0], '\u05D0'); // א
            assert.equal(alpha[21], '\u05EA'); // ת
        });

        it('returns a copy (not the internal array)', function () {
            var a = Gematria.alphabet();
            var b = Gematria.alphabet();
            assert.notEqual(a, b);
            assert.deepEqual(a, b);
        });
    });

    describe('letterInfo', function () {
        it('returns info for Alef', function () {
            var info = Gematria.letterInfo('\u05D0');
            assert.equal(info.name, 'Alef');
            assert.equal(info.position, 1);
            assert.equal(info.standardValue, 1);
        });

        it('returns info for a letter with final form', function () {
            var info = Gematria.letterInfo('\u05DB'); // Kaf
            assert.equal(info.name, 'Kaf');
            assert.equal(info.position, 11);
            assert.equal(info.standardValue, 20);
            assert.equal(info.finalForm, '\u05DA'); // ך
            assert.equal(info.finalValue, 500);
        });

        it('returns null for non-Hebrew characters', function () {
            assert.equal(Gematria.letterInfo('A'), null);
        });
    });

    describe('hechrachi (standard value)', function () {
        it('computes single letter values', function () {
            assert.equal(Gematria.hechrachi('\u05D0'), 1); // Alef
            assert.equal(Gematria.hechrachi('\u05D9'), 10); // Yod
            assert.equal(Gematria.hechrachi('\u05E7'), 100); // Qof
        });

        it('sums multi-letter text', function () {
            // אבג = 1 + 2 + 3 = 6
            assert.equal(Gematria.hechrachi('\u05D0\u05D1\u05D2'), 6);
        });

        it('treats final forms same as non-final', function () {
            // Kaf = 20, Kaf-final = 20 (same in hechrachi)
            assert.equal(Gematria.hechrachi('\u05DB'), Gematria.hechrachi('\u05DA'));
        });

        it('ignores non-Hebrew characters', function () {
            assert.equal(Gematria.hechrachi('\u05D0 \u05D1'), 3); // א ב with space
        });
    });

    describe('gadol', function () {
        it('uses distinct values for final forms', function () {
            assert.equal(Gematria.gadol('\u05DA'), 500); // Kaf-final
            assert.equal(Gematria.gadol('\u05DD'), 600); // Mem-final
            assert.equal(Gematria.gadol('\u05DF'), 700); // Nun-final
            assert.equal(Gematria.gadol('\u05E3'), 800); // Pe-final
            assert.equal(Gematria.gadol('\u05E5'), 900); // Tsade-final
        });

        it('matches hechrachi for non-final letters', function () {
            assert.equal(Gematria.gadol('\u05D0'), 1);
            assert.equal(Gematria.gadol('\u05D9'), 10);
        });
    });

    describe('katan (reduced value)', function () {
        it('reduces values to single digits', function () {
            assert.equal(Gematria.katan('\u05D0'), 1); // 1 -> 1
            assert.equal(Gematria.katan('\u05D9'), 1); // 10 -> 1
            assert.equal(Gematria.katan('\u05E7'), 1); // 100 -> 1
        });

        it('handles mid-range values', function () {
            assert.equal(Gematria.katan('\u05DB'), 2); // 20 -> 2
            assert.equal(Gematria.katan('\u05E8'), 2); // 200 -> 2
        });
    });

    describe('siduri (ordinal value)', function () {
        it('returns position in alphabet', function () {
            assert.equal(Gematria.siduri('\u05D0'), 1); // Alef = position 1
            assert.equal(Gematria.siduri('\u05D9'), 10); // Yod = position 10
            assert.equal(Gematria.siduri('\u05EA'), 22); // Tav = position 22
        });

        it('treats final forms same as non-final', function () {
            assert.equal(Gematria.siduri('\u05DA'), 11); // Kaf-final = position 11
        });
    });

    describe('atbash (mirror cipher)', function () {
        it('maps first letter to last', function () {
            assert.equal(Gematria.atbash('\u05D0'), '\u05EA'); // א -> ת
        });

        it('maps last letter to first', function () {
            assert.equal(Gematria.atbash('\u05EA'), '\u05D0'); // ת -> א
        });

        it('is symmetric (double application is identity)', function () {
            var alpha = Gematria.alphabet();
            for (var i = 0; i < alpha.length; i++) {
                assert.equal(
                    Gematria.atbash(Gematria.atbash(alpha[i])),
                    alpha[i],
                    'atbash(atbash(' + alpha[i] + ')) should equal ' + alpha[i],
                );
            }
        });
    });

    describe('albam (half-split cipher)', function () {
        it('maps first half to second half', function () {
            assert.equal(Gematria.albam('\u05D0'), '\u05DC'); // א -> ל
        });

        it('maps second half back to first', function () {
            assert.equal(Gematria.albam('\u05DC'), '\u05D0'); // ל -> א
        });

        it('is symmetric', function () {
            var alpha = Gematria.alphabet();
            for (var i = 0; i < alpha.length; i++) {
                assert.equal(Gematria.albam(Gematria.albam(alpha[i])), alpha[i]);
            }
        });
    });

    describe('avgad (shift cipher)', function () {
        it('shifts forward by one position', function () {
            assert.equal(Gematria.avgad('\u05D0'), '\u05D1'); // א -> ב
        });

        it('wraps around at end of alphabet', function () {
            assert.equal(Gematria.avgad('\u05EA'), '\u05D0'); // ת -> א
        });

        it('shifts backward in reverse mode', function () {
            assert.equal(Gematria.avgad('\u05D1', true), '\u05D0'); // ב -> א
        });

        it('reverse wraps around at start', function () {
            assert.equal(Gematria.avgad('\u05D0', true), '\u05EA'); // א -> ת
        });

        it('forward and reverse are inverses', function () {
            var alpha = Gematria.alphabet();
            for (var i = 0; i < alpha.length; i++) {
                assert.equal(Gematria.avgad(Gematria.avgad(alpha[i]), true), alpha[i]);
            }
        });
    });

    describe('encode (number to Hebrew)', function () {
        it('encodes single-letter numbers with geresh', function () {
            assert.equal(Gematria.encode(1), '\u05D0\u05F3'); // א׳
            assert.equal(Gematria.encode(9), '\u05D8\u05F3'); // ט׳
        });

        it('encodes two-letter numbers with gershayim', function () {
            assert.equal(Gematria.encode(11), '\u05D9\u05F4\u05D0'); // י״א
        });

        it('handles special case 15 (not yod-he)', function () {
            var result = Gematria.encode(15);
            // Should be ט״ו not י״ה
            assert.ok(result.indexOf('\u05D8') >= 0, '15 should contain Tet');
            assert.ok(result.indexOf('\u05D5') >= 0, '15 should contain Vav');
        });

        it('handles special case 16 (not yod-vav)', function () {
            var result = Gematria.encode(16);
            // Should be ט״ז not י״ו
            assert.ok(result.indexOf('\u05D8') >= 0, '16 should contain Tet');
            assert.ok(result.indexOf('\u05D6') >= 0, '16 should contain Zayin');
        });

        it('strips thousands by default', function () {
            // 5784 -> 784 -> תשפ״ד
            var full = Gematria.encode(784);
            var stripped = Gematria.encode(5784);
            assert.equal(full, stripped);
        });

        it('throws on zero', function () {
            assert.throws(function () {
                Gematria.encode(0);
            }, /positive integer/);
        });

        it('throws on negative numbers', function () {
            assert.throws(function () {
                Gematria.encode(-5);
            }, /positive integer/);
        });

        it('throws on non-integer input', function () {
            assert.throws(function () {
                Gematria.encode(1.5);
            }, /positive integer/);
        });

        it('handles exact multiples of 1000 with omitThousands', function () {
            // 1000 % 1000 = 0, falls back to encoding the full number
            var result = Gematria.encode(1000);
            assert.ok(result.length > 0);
        });
    });
});
