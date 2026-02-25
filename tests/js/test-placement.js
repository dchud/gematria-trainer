'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');

require('./helpers/load-modules');

// Initialize gematria data
Gematria.initialize();

test('Placement', function (t) {
    // ---------------------------------------------------------------
    // create()
    // ---------------------------------------------------------------

    t.test('create()', function (t2) {
        t2.test('creates state for 8-level system', function () {
            var state = Placement.create('hechrachi');
            assert.equal(state.system, 'hechrachi');
            assert.equal(state.steps.length, 4);
            assert.equal(state.currentStep, 0);
            assert.equal(state.cardIndex, 0);
            assert.equal(state.cards.length, 3);
            assert.equal(state.done, false);
            assert.equal(state.startLevel, null);
        });

        t2.test('creates state for 4-level system', function () {
            var state = Placement.create('katan');
            assert.equal(state.steps.length, 3);
            assert.equal(state.cards.length, 3);
        });

        t2.test('creates state for 3-level system', function () {
            var state = Placement.create('atbash');
            assert.equal(state.steps.length, 2);
            assert.equal(state.cards.length, 3);
        });

        t2.test('first step cards come from level 1', function () {
            var state = Placement.create('hechrachi');
            var t1Specs = Levels.getCards('hechrachi', 1);
            var t1Ids = {};
            for (var i = 0; i < t1Specs.length; i++) {
                t1Ids[t1Specs[i].id] = true;
            }
            for (var j = 0; j < state.cards.length; j++) {
                assert.ok(t1Ids[state.cards[j].id], 'card should be from level 1');
            }
        });
    });

    // ---------------------------------------------------------------
    // currentCard()
    // ---------------------------------------------------------------

    t.test('currentCard()', function (t2) {
        t2.test('returns first card', function () {
            var state = Placement.create('hechrachi');
            var card = Placement.currentCard(state);
            assert.ok(card);
            assert.ok(card.prompt);
            assert.ok(card.answer);
        });

        t2.test('returns null when done', function () {
            var state = Placement.create('hechrachi');
            state.done = true;
            assert.equal(Placement.currentCard(state), null);
        });
    });

    // ---------------------------------------------------------------
    // recordResponse() - failure cases
    // ---------------------------------------------------------------

    t.test('recordResponse() failure', function (t2) {
        t2.test('incorrect response ends assessment at current level', function () {
            var state = Placement.create('hechrachi');
            var result = Placement.recordResponse(state, false);
            assert.equal(result.done, true);
            assert.equal(result.startLevel, 1);
            assert.equal(state.done, true);
            assert.equal(state.startLevel, 1);
        });

        t2.test('failure on second step places at step 2 level', function () {
            var state = Placement.create('hechrachi');
            // Pass all 3 cards in step 1
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            assert.equal(state.currentStep, 1);

            // Fail on step 2
            var result = Placement.recordResponse(state, false);
            assert.equal(result.done, true);
            assert.equal(result.startLevel, 2);
        });

        t2.test('failure on last step places at that level', function () {
            var state = Placement.create('atbash'); // 3-level: 2 steps
            // Pass step 1 (3 cards)
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            // Fail on step 2
            var result = Placement.recordResponse(state, false);
            assert.equal(result.done, true);
            assert.equal(result.startLevel, 2);
        });
    });

    // ---------------------------------------------------------------
    // recordResponse() - success / pass all
    // ---------------------------------------------------------------

    t.test('recordResponse() pass all', function (t2) {
        t2.test('passing all steps in 3-level places at level 3', function () {
            var state = Placement.create('atbash'); // 2 steps
            // Pass step 1
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            // Pass step 2
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            var result = Placement.recordResponse(state, true);
            assert.equal(result.done, true);
            assert.equal(result.startLevel, 3);
        });

        t2.test('passing all steps in 4-level places at level 4', function () {
            var state = Placement.create('katan'); // 3 steps
            // Pass all 9 cards (3 steps x 3 cards)
            for (var i = 0; i < 9; i++) {
                Placement.recordResponse(state, true);
            }
            assert.equal(state.done, true);
            assert.equal(state.startLevel, 4);
        });

        t2.test('passing all steps in 8-level places at level 4 (max static)', function () {
            var state = Placement.create('hechrachi'); // 4 steps
            // Pass all 12 cards (4 steps x 3 cards)
            for (var i = 0; i < 12; i++) {
                Placement.recordResponse(state, true);
            }
            assert.equal(state.done, true);
            // lastLevel=4, levelCount=8, min(5, 8)=5
            // But static levels only go to 4, so placement
            // caps at min(lastLevel+1, levelCount) = 5
            assert.equal(state.startLevel, 5);
        });
    });

    // ---------------------------------------------------------------
    // Step advancement
    // ---------------------------------------------------------------

    t.test('step advancement', function (t2) {
        t2.test('advances step and loads new cards after passing a step', function () {
            var state = Placement.create('hechrachi');
            var firstCards = state.cards.slice();

            // Pass step 1
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            var result = Placement.recordResponse(state, true);

            assert.equal(result.done, false);
            assert.equal(state.currentStep, 1);
            assert.equal(state.cardIndex, 0);
            assert.equal(state.cards.length, 3);

            // New cards should come from level 2
            var t2Specs = Levels.getCards('hechrachi', 2);
            var t2Ids = {};
            for (var i = 0; i < t2Specs.length; i++) {
                t2Ids[t2Specs[i].id] = true;
            }
            for (var j = 0; j < state.cards.length; j++) {
                assert.ok(t2Ids[state.cards[j].id], 'step 2 cards should be from level 2');
            }
        });

        t2.test('cardIndex resets after step advancement', function () {
            var state = Placement.create('katan');
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            Placement.recordResponse(state, true);
            assert.equal(state.cardIndex, 0);
            assert.equal(state.currentStep, 1);
        });
    });

    // ---------------------------------------------------------------
    // isComplete() and result()
    // ---------------------------------------------------------------

    t.test('isComplete() and result()', function (t2) {
        t2.test('isComplete returns false before completion', function () {
            var state = Placement.create('hechrachi');
            assert.equal(Placement.isComplete(state), false);
        });

        t2.test('isComplete returns true after failure', function () {
            var state = Placement.create('hechrachi');
            Placement.recordResponse(state, false);
            assert.equal(Placement.isComplete(state), true);
        });

        t2.test('result returns null before completion', function () {
            var state = Placement.create('hechrachi');
            assert.equal(Placement.result(state), null);
        });

        t2.test('result returns startLevel after completion', function () {
            var state = Placement.create('hechrachi');
            Placement.recordResponse(state, false);
            assert.equal(Placement.result(state), 1);
        });
    });
});
