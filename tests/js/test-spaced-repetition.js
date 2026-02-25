/**
 * Tests for the SpacedRepetition module (SM-2 algorithm).
 */

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

require('./helpers/load-modules');

describe('SpacedRepetition', function () {
    describe('createCard', function () {
        it('returns a card with default values', function () {
            var card = SpacedRepetition.createCard('test-card');
            assert.equal(card.card_id, 'test-card');
            assert.equal(card.ease_factor, 2.5);
            assert.equal(card.interval_minutes, 1);
            assert.equal(card.repetitions, 0);
            assert.equal(card.last_quality, null);
            assert.ok(card.next_review);
        });
    });

    describe('QUALITY constants', function () {
        it('has correct quality values', function () {
            assert.equal(SpacedRepetition.QUALITY.wrong, 1);
            assert.equal(SpacedRepetition.QUALITY.unsure, 3);
            assert.equal(SpacedRepetition.QUALITY.good, 4);
            assert.equal(SpacedRepetition.QUALITY.easy, 5);
        });
    });

    describe('review', function () {
        it('resets repetitions on wrong answer', function () {
            var card = SpacedRepetition.createCard('test');
            // First correct review to build up repetitions
            card = SpacedRepetition.review(card, 4);
            assert.equal(card.repetitions, 1);

            // Wrong answer resets
            card = SpacedRepetition.review(card, 1);
            assert.equal(card.repetitions, 0);
            assert.equal(card.interval_minutes, 1);
        });

        it('advances repetitions on correct answer', function () {
            var card = SpacedRepetition.createCard('test');
            card = SpacedRepetition.review(card, 4);
            assert.equal(card.repetitions, 1);
            assert.equal(card.interval_minutes, 2);

            card = SpacedRepetition.review(card, 4);
            assert.equal(card.repetitions, 2);
            assert.equal(card.interval_minutes, 10);
        });

        it('scales interval by ease factor after rep 2', function () {
            var card = SpacedRepetition.createCard('test');
            card = SpacedRepetition.review(card, 5); // rep 1, interval 2
            card = SpacedRepetition.review(card, 5); // rep 2, interval 10
            card = SpacedRepetition.review(card, 5); // rep 3, interval = 10 * newEf
            assert.equal(card.repetitions, 3);
            // EF adjusts again on this review, so interval = round(10 * currentEf)
            assert.equal(card.interval_minutes, Math.round(10 * card.ease_factor));
        });

        it('does not mutate the input card', function () {
            var card = SpacedRepetition.createCard('test');
            var updated = SpacedRepetition.review(card, 4);
            assert.equal(card.repetitions, 0);
            assert.equal(updated.repetitions, 1);
        });

        it('adjusts ease factor downward on wrong answer', function () {
            var card = SpacedRepetition.createCard('test');
            var updated = SpacedRepetition.review(card, 1);
            assert.ok(updated.ease_factor < card.ease_factor);
        });

        it('adjusts ease factor upward on easy answer', function () {
            var card = SpacedRepetition.createCard('test');
            var updated = SpacedRepetition.review(card, 5);
            assert.ok(updated.ease_factor > card.ease_factor);
        });

        it('never lets ease factor drop below MIN_EASE', function () {
            var card = SpacedRepetition.createCard('test');
            // Repeatedly get wrong answers to drive EF down
            for (var i = 0; i < 20; i++) {
                card = SpacedRepetition.review(card, 1);
            }
            assert.ok(card.ease_factor >= SpacedRepetition.MIN_EASE);
        });

        it('sets next_review in the future', function () {
            var card = SpacedRepetition.createCard('test');
            var before = Date.now();
            var updated = SpacedRepetition.review(card, 4);
            var nextReview = new Date(updated.next_review).getTime();
            assert.ok(nextReview >= before);
        });

        it('records last_quality', function () {
            var card = SpacedRepetition.createCard('test');
            var updated = SpacedRepetition.review(card, 3);
            assert.equal(updated.last_quality, 3);
        });

        it('throws on invalid quality value', function () {
            var card = SpacedRepetition.createCard('test');
            assert.throws(function () {
                SpacedRepetition.review(card, 0);
            }, /quality must be 1, 3, 4, or 5/);
            assert.throws(function () {
                SpacedRepetition.review(card, 2);
            }, /quality must be 1, 3, 4, or 5/);
            assert.throws(function () {
                SpacedRepetition.review(card, 6);
            }, /quality must be 1, 3, 4, or 5/);
        });
    });

    describe('isDue', function () {
        it('returns true for a new card', function () {
            var card = SpacedRepetition.createCard('test');
            assert.ok(SpacedRepetition.isDue(card));
        });

        it('returns false for a recently reviewed card', function () {
            var card = SpacedRepetition.createCard('test');
            var updated = SpacedRepetition.review(card, 4);
            assert.equal(SpacedRepetition.isDue(updated), false);
        });
    });

    describe('overdueMinutes', function () {
        it('returns positive for overdue cards', function () {
            var card = SpacedRepetition.createCard('test');
            // A new card is due immediately, so should be >= 0
            var overdue = SpacedRepetition.overdueMinutes(card);
            assert.ok(overdue >= 0);
        });

        it('returns negative for cards not yet due', function () {
            var card = SpacedRepetition.createCard('test');
            var updated = SpacedRepetition.review(card, 4);
            var overdue = SpacedRepetition.overdueMinutes(updated);
            assert.ok(overdue < 0);
        });
    });
});
