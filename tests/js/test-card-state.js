/**
 * Tests for the CardState module (extended card state and mastery).
 */

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

require('./helpers/load-modules');

describe('CardState', function () {
    describe('createCard', function () {
        it('creates a card with review tracking fields', function () {
            var card = CardState.createCard('test-card');
            assert.equal(card.card_id, 'test-card');
            assert.equal(card.review_count, 0);
            assert.equal(card.correct_count, 0);
            // Should also have SM-2 fields
            assert.equal(card.ease_factor, 2.5);
            assert.equal(card.repetitions, 0);
        });
    });

    describe('reviewCard', function () {
        it('increments review_count on any review', function () {
            var card = CardState.createCard('test');
            var updated = CardState.reviewCard(card, 1);
            assert.equal(updated.review_count, 1);
        });

        it('increments correct_count on quality >= 3', function () {
            var card = CardState.createCard('test');
            var updated = CardState.reviewCard(card, 4);
            assert.equal(updated.correct_count, 1);
        });

        it('does not increment correct_count on quality < 3', function () {
            var card = CardState.createCard('test');
            var updated = CardState.reviewCard(card, 1);
            assert.equal(updated.correct_count, 0);
        });

        it('does not mutate the input card', function () {
            var card = CardState.createCard('test');
            CardState.reviewCard(card, 4);
            assert.equal(card.review_count, 0);
        });

        it('delegates to SM-2 for scheduling', function () {
            var card = CardState.createCard('test');
            var updated = CardState.reviewCard(card, 4);
            assert.equal(updated.repetitions, 1);
            assert.equal(updated.last_quality, 4);
        });
    });

    describe('initLevel', function () {
        it('creates cards for all specs in a level', function () {
            var cards = CardState.initLevel('hechrachi', 1);
            var specs = Levels.getCards('hechrachi', 1);
            assert.equal(cards.length, specs.length);
        });

        it('cards have matching IDs to specs', function () {
            var cards = CardState.initLevel('hechrachi', 1);
            var specs = Levels.getCards('hechrachi', 1);
            for (var i = 0; i < cards.length; i++) {
                assert.equal(cards[i].card_id, specs[i].id);
            }
        });
    });

    describe('findCard', function () {
        it('finds a card by ID', function () {
            var cards = CardState.initLevel('hechrachi', 1);
            var found = CardState.findCard(cards, 'alef-to-val');
            assert.ok(found);
            assert.equal(found.card_id, 'alef-to-val');
        });

        it('returns null for missing ID', function () {
            var cards = CardState.initLevel('hechrachi', 1);
            assert.equal(CardState.findCard(cards, 'nonexistent'), null);
        });
    });

    describe('replaceCard', function () {
        it('replaces a card in the array', function () {
            var cards = CardState.initLevel('hechrachi', 1);
            var updated = CardState.reviewCard(cards[0], 4);
            CardState.replaceCard(cards, updated);
            assert.equal(cards[0].review_count, 1);
        });
    });

    describe('levelAccuracy', function () {
        it('returns 0 for unreviewed cards', function () {
            var cards = CardState.initLevel('hechrachi', 1);
            assert.equal(CardState.levelAccuracy(cards), 0);
        });

        it('returns 1.0 for all correct', function () {
            var cards = [CardState.createCard('a'), CardState.createCard('b')];
            cards[0] = CardState.reviewCard(cards[0], 4);
            cards[1] = CardState.reviewCard(cards[1], 5);
            assert.equal(CardState.levelAccuracy(cards), 1.0);
        });

        it('computes accuracy across all cards', function () {
            var cards = [CardState.createCard('a'), CardState.createCard('b')];
            cards[0] = CardState.reviewCard(cards[0], 4); // correct
            cards[1] = CardState.reviewCard(cards[1], 1); // wrong
            // 1 correct out of 2 reviews = 0.5
            assert.equal(CardState.levelAccuracy(cards), 0.5);
        });
    });

    describe('checkMastery', function () {
        it('returns false for empty cards', function () {
            assert.equal(CardState.checkMastery([]), false);
        });

        it('returns false with insufficient reviews', function () {
            var cards = [CardState.createCard('a')];
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 5);
            // Only 2 reviews, need 3
            assert.equal(CardState.checkMastery(cards), false);
        });

        it('returns true when all criteria met', function () {
            var cards = [CardState.createCard('a')];
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 5);
            // 3 reviews, 100% accuracy
            assert.ok(CardState.checkMastery(cards));
        });

        it('returns false when accuracy is too low', function () {
            var cards = [CardState.createCard('a')];
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 1);
            cards[0] = CardState.reviewCard(cards[0], 1);
            // 3 reviews, ~33% accuracy
            assert.equal(CardState.checkMastery(cards), false);
        });

        it('returns false when any card has too few reviews', function () {
            var cards = [CardState.createCard('a'), CardState.createCard('b')];
            // Card a: 3 reviews, all correct
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 5);
            // Card b: only 2 reviews
            cards[1] = CardState.reviewCard(cards[1], 5);
            cards[1] = CardState.reviewCard(cards[1], 5);
            assert.equal(CardState.checkMastery(cards), false);
        });
    });
});
