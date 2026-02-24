/**
 * Tests for the CardSelection module (card scheduling).
 */

var { describe, it } = require('node:test');
var assert = require('node:assert/strict');

require('./helpers/load-modules');

describe('CardSelection', function () {
    describe('selectNext', function () {
        it('returns a new card when all are unreviewed', function () {
            var cards = CardState.initTier('hechrachi', 1);
            var specs = Tiers.getCards('hechrachi', 1);
            var result = CardSelection.selectNext(cards, specs);
            assert.equal(result.type, 'card');
            assert.ok(result.card);
            assert.ok(result.spec);
            assert.equal(result.card.review_count, 0);
        });

        it('presents cards in spec order for new cards', function () {
            var cards = CardState.initTier('hechrachi', 1);
            var specs = Tiers.getCards('hechrachi', 1);
            var result = CardSelection.selectNext(cards, specs);
            // First new card should be the first spec
            assert.equal(result.card.card_id, specs[0].id);
        });

        it('selects overdue card over new card', function () {
            var cards = CardState.initTier('hechrachi', 1);
            var specs = Tiers.getCards('hechrachi', 1);

            // Review the first card so it's been seen
            var reviewed = CardState.reviewCard(cards[0], 4);
            // Make it overdue by backdating next_review
            reviewed.next_review = new Date(Date.now() - 60000).toISOString();
            CardState.replaceCard(cards, reviewed);

            var result = CardSelection.selectNext(cards, specs);
            assert.equal(result.type, 'card');
            assert.equal(result.card.card_id, cards[0].card_id);
        });

        it('returns advance when tier is mastered', function () {
            // Create a single-card tier by making a minimal set
            var specs = [{ id: 'test-card', type: 'letter-to-value', prompt: 'x', answer: '1' }];
            var cards = [CardState.createCard('test-card')];

            // Review enough to achieve mastery
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 5);
            cards[0] = CardState.reviewCard(cards[0], 5);

            var result = CardSelection.selectNext(cards, specs);
            assert.equal(result.type, 'advance');
        });

        it('returns soonest-due card when nothing is overdue and no new cards', function () {
            var specs = [
                { id: 'a', type: 'letter-to-value', prompt: 'x', answer: '1' },
                { id: 'b', type: 'letter-to-value', prompt: 'y', answer: '2' },
            ];
            var cards = [CardState.createCard('a'), CardState.createCard('b')];

            // Review both cards once (not mastered, nothing new)
            cards[0] = CardState.reviewCard(cards[0], 4);
            cards[1] = CardState.reviewCard(cards[1], 4);

            var result = CardSelection.selectNext(cards, specs);
            assert.equal(result.type, 'card');
            assert.ok(result.card);
        });
    });

    describe('selectReview', function () {
        it('returns overdue card from all tiers', function () {
            var cards = [CardState.createCard('test')];
            var specs = [{ id: 'test', type: 'letter-to-value', prompt: 'x', answer: '1' }];

            // Make it overdue
            cards[0] = CardState.reviewCard(cards[0], 4);
            cards[0].next_review = new Date(Date.now() - 60000).toISOString();

            var result = CardSelection.selectReview(cards, specs);
            assert.ok(result);
            assert.equal(result.type, 'card');
            assert.equal(result.card.card_id, 'test');
        });

        it('returns soonest-due when nothing overdue', function () {
            var cards = [CardState.createCard('test')];
            var specs = [{ id: 'test', type: 'letter-to-value', prompt: 'x', answer: '1' }];

            // Review but keep due in the future
            cards[0] = CardState.reviewCard(cards[0], 4);

            var result = CardSelection.selectReview(cards, specs);
            assert.ok(result);
            assert.equal(result.type, 'card');
        });
    });
});
