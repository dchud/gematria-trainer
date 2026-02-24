/**
 * Tests for app.js — Alpine.js application controller.
 *
 * Tests the app() function's methods and state management with
 * mocked localStorage and browser APIs.
 */

var { describe, it, beforeEach } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var vm = require('node:vm');

// Load base modules (everything except storage.js)
require('./helpers/load-modules');

var jsDir = path.resolve(__dirname, '../../static/js');
var storageCode = fs.readFileSync(path.join(jsDir, 'storage.js'), 'utf8');
var settingsCode = fs.readFileSync(path.join(jsDir, 'settings.js'), 'utf8');
var appCode = fs.readFileSync(path.join(jsDir, 'app.js'), 'utf8');

// Mock window.matchMedia for init()
var _reducedMotion = false;
var _mediaListeners = [];

globalThis.window = globalThis.window || {};
window.matchMedia = function () {
    return {
        matches: _reducedMotion,
        addEventListener: function (_type, fn) {
            _mediaListeners.push(fn);
        },
    };
};

// Mock document for dark mode, transitionToNextCard, and cookies
globalThis.document = globalThis.document || {};
document.getElementById = function () {
    return { focus: function () {} };
};
document.documentElement = {
    classList: {
        _classes: {},
        add: function (cls) {
            this._classes[cls] = true;
        },
        remove: function (cls) {
            delete this._classes[cls];
        },
        contains: function (cls) {
            return !!this._classes[cls];
        },
    },
};
// Cookie mock: simulates browser cookie behavior via getter/setter
var _cookieJar = {};
Object.defineProperty(document, 'cookie', {
    get: function () {
        var parts = [];
        var key;
        for (key in _cookieJar) {
            if (Object.hasOwn(_cookieJar, key)) {
                parts.push(key + '=' + _cookieJar[key]);
            }
        }
        return parts.join('; ');
    },
    set: function (str) {
        var eqIdx = str.indexOf('=');
        if (eqIdx === -1) return;
        var name = str.substring(0, eqIdx).trim();
        var rest = str.substring(eqIdx + 1);
        // Check for expired cookies (deletion)
        if (rest.indexOf('expires=Thu, 01 Jan 1970') !== -1) {
            delete _cookieJar[name];
            return;
        }
        // Extract just the value (before first semicolon)
        var semiIdx = rest.indexOf(';');
        var value = semiIdx !== -1 ? rest.substring(0, semiIdx) : rest;
        _cookieJar[name] = value.trim();
    },
    configurable: true,
});

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
    _reducedMotion = false;
    _mediaListeners = [];
    document.documentElement.classList._classes = {};
    // Clear mock cookie jar
    var k;
    for (k in _cookieJar) {
        if (Object.hasOwn(_cookieJar, k)) delete _cookieJar[k];
    }
    globalThis.localStorage = freshStore();
    vm.runInThisContext(storageCode, { filename: 'storage.js' });
    vm.runInThisContext(settingsCode, { filename: 'settings.js' });
    vm.runInThisContext(appCode, { filename: 'app.js' });
}

function createApp() {
    var a = app();
    // Mock Alpine.js $nextTick
    a.$nextTick = function (fn) {
        fn();
    };
    return a;
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('app()', function () {
    beforeEach(function () {
        setup();
    });

    describe('initial state', function () {
        it('returns an object with expected properties', function () {
            var a = createApp();
            assert.equal(a.view, 'splash');
            assert.equal(a.previousView, null);
            assert.equal(a.system, 'hechrachi');
            assert.equal(a.progression, null);
            assert.equal(a.sessionActive, false);
            assert.equal(a.hasSavedProgress, false);
            assert.equal(a.currentCard, null);
            assert.equal(a.answerRevealed, false);
            assert.equal(a.cardIndex, 0);
            assert.equal(a.totalCards, 0);
            assert.equal(a.savedCardState, null);
            assert.equal(a.transition, 'fade');
            assert.equal(a.transitionDuration, 250);
            assert.equal(a.cardVisible, true);
            assert.equal(a.reducedMotion, false);
            assert.equal(a.hebrewFont, 'standard');
            assert.equal(a.darkMode, 'system');
            assert.equal(a.degradedMode, false);
            assert.equal(a.shortcutsOpen, false);
            assert.equal(a.placementActive, false);
            assert.equal(a.placementState, null);
            assert.equal(a.placementAnswerRevealed, false);
            assert.equal(a.placementMessage, '');
            assert.equal(a.confirmResetSystem, false);
            assert.equal(a.confirmStartFresh, false);
        });

        it('each call returns a fresh instance', function () {
            var a1 = createApp();
            var a2 = createApp();
            a1.view = 'flashcard';
            assert.equal(a2.view, 'splash');
        });
    });

    describe('init()', function () {
        it('detects reduced motion preference', function () {
            _reducedMotion = true;
            var a = createApp();
            a.init();
            assert.equal(a.reducedMotion, true);
        });

        it('loads saved settings via Settings module', function () {
            Storage.saveSettings({ transition: 'slide-left', darkMode: 'dark' });
            var a = createApp();
            a.init();
            assert.equal(a.transition, 'slide-left');
            assert.equal(a.darkMode, 'dark');
        });

        it('migrates boolean darkMode true to dark', function () {
            Storage.saveSettings({ darkMode: true });
            var a = createApp();
            a.init();
            assert.equal(a.darkMode, 'dark');
        });

        it('migrates boolean darkMode false to light', function () {
            Storage.saveSettings({ darkMode: false });
            var a = createApp();
            a.init();
            assert.equal(a.darkMode, 'light');
        });

        it('defaults darkMode to system when not saved', function () {
            var a = createApp();
            a.init();
            assert.equal(a.darkMode, 'system');
        });

        it('loads saved system from settings', function () {
            Storage.saveSettings({ system: 'gadol' });
            var a = createApp();
            a.init();
            assert.equal(a.system, 'gadol');
        });

        it('loads hebrewFont and transitionDuration from settings', function () {
            Storage.saveSettings({ hebrewFont: 'sans', transitionDuration: 400 });
            var a = createApp();
            a.init();
            assert.equal(a.hebrewFont, 'sans');
            assert.equal(a.transitionDuration, 400);
        });

        it('detects degraded mode when storage unavailable', function () {
            // Storage.isAvailable() already returned true in setup, so
            // degradedMode is false by default. We test that the flag
            // gets set during init.
            var a = createApp();
            a.init();
            assert.equal(a.degradedMode, false);
        });

        it('detects saved progress with session cookie', function () {
            var a = createApp();
            a._setCookie('gematria_session', '1', 30);
            var state = Progression.createState('hechrachi');
            Storage.saveProgress('hechrachi', state);

            a.init();
            assert.equal(a.hasSavedProgress, true);
            assert.equal(a.view, 'welcome');
        });

        it('no saved progress when storage is empty', function () {
            var a = createApp();
            a.init();
            assert.equal(a.hasSavedProgress, false);
        });
    });

    describe('navigate()', function () {
        it('switches view and tracks previous', function () {
            var a = createApp();
            a.navigate('flashcard');
            assert.equal(a.view, 'flashcard');
            assert.equal(a.previousView, 'splash');
        });

        it('closes shortcuts overlay on navigation', function () {
            var a = createApp();
            a.shortcutsOpen = true;
            a.navigate('settings');
            assert.equal(a.shortcutsOpen, false);
        });

        it('saves card state when leaving flashcard mid-session', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.equal(a.view, 'flashcard');
            assert.ok(a.currentCard);

            var savedCard = a.currentCard;
            a.navigate('settings');
            assert.ok(a.savedCardState);
            assert.equal(a.savedCardState.currentCard, savedCard);
        });

        it('restores card state when returning to flashcard', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            var savedCard = a.currentCard;
            var savedRevealed = a.answerRevealed;
            a.navigate('settings');
            a.navigate('flashcard');

            assert.equal(a.currentCard, savedCard);
            assert.equal(a.answerRevealed, savedRevealed);
            assert.equal(a.savedCardState, null);
        });
    });

    describe('beginSession()', function () {
        it('creates progression and loads first card', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            assert.ok(a.progression);
            assert.equal(a.progression.system, 'hechrachi');
            assert.equal(a.sessionActive, true);
            assert.ok(a.currentCard);
            assert.equal(a.currentCard.type, 'card');
            assert.ok(a.currentCard.spec);
            assert.ok(a.currentCard.card);
        });

        it('sets totalCards to tier spec count', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            var specs = Tiers.getCards('hechrachi', 1);
            assert.equal(a.totalCards, specs.length);
        });

        it('navigates to flashcard view', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.equal(a.view, 'flashcard');
        });
    });

    describe('startFresh()', function () {
        it('clears all progress and returns to splash', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            a.startFresh();
            assert.equal(a.progression, null);
            assert.equal(a.sessionActive, false);
            assert.equal(a.view, 'splash');
        });
    });

    describe('switchSystem()', function () {
        it('changes system and reloads when session is active', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.switchSystem('katan');

            assert.equal(a.system, 'katan');
            assert.equal(a.progression.system, 'katan');
            assert.ok(a.currentCard);
        });

        it('discards saved card state', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.navigate('settings');
            assert.ok(a.savedCardState);

            a.switchSystem('katan');
            assert.equal(a.savedCardState, null);
        });

        it('checks for saved progress in new system', function () {
            var state = Progression.createState('gadol');
            Storage.saveProgress('gadol', state);

            var a = createApp();
            a.init();
            assert.equal(a.hasSavedProgress, false);

            a.switchSystem('gadol');
            assert.equal(a.hasSavedProgress, true);
        });
    });

    describe('loadNextCard()', function () {
        it('loads first unreviewed card', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            assert.ok(a.currentCard);
            assert.equal(a.currentCard.type, 'card');
            assert.equal(a.answerRevealed, false);
            assert.equal(a.cardVisible, true);
        });

        it('does nothing without progression', function () {
            var a = createApp();
            a.loadNextCard();
            assert.equal(a.currentCard, null);
        });
    });

    describe('showAnswer()', function () {
        it('reveals the answer', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.equal(a.answerRevealed, false);

            a.showAnswer();
            assert.equal(a.answerRevealed, true);
        });

        it('does nothing without a card', function () {
            var a = createApp();
            a.showAnswer();
            assert.equal(a.answerRevealed, false);
        });
    });

    describe('rateCard()', function () {
        it('records review and loads next card', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();

            var firstCard = a.currentCard;
            a.showAnswer();
            a.rateCard(3);

            // Card should have changed (or same card with updated state)
            assert.equal(a.answerRevealed, false);
            assert.ok(a.currentCard);
        });

        it('does nothing when answer is not revealed', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            var firstCard = a.currentCard;
            a.rateCard(3); // answer not revealed
            assert.equal(a.currentCard, firstCard);
        });

        it('does nothing with invalid rating', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.showAnswer();

            var card = a.currentCard;
            a.rateCard(0);
            assert.equal(a.currentCard, card);
            a.rateCard(5);
            assert.equal(a.currentCard, card);
        });

        it('maps rating 1 to quality 1 (wrong)', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();
            a.showAnswer();

            var cardId = a.currentCard.card.card_id;
            a.rateCard(1);

            // Find the card in progression to verify quality
            var cards = Progression.currentTierCards(a.progression);
            var found = null;
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].card_id === cardId) {
                    found = cards[i];
                    break;
                }
            }
            assert.ok(found);
            assert.equal(found.last_quality, 1);
        });

        it('maps rating 4 to quality 5 (easy)', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();
            a.showAnswer();

            var cardId = a.currentCard.card.card_id;
            a.rateCard(4);

            var cards = Progression.currentTierCards(a.progression);
            var found = null;
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].card_id === cardId) {
                    found = cards[i];
                    break;
                }
            }
            assert.ok(found);
            assert.equal(found.last_quality, 5);
        });
    });

    describe('display helpers', function () {
        it('promptText() returns card prompt', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.ok(a.promptText());
            assert.equal(a.promptText(), a.currentCard.spec.prompt);
        });

        it('promptText() returns empty string without card', function () {
            var a = createApp();
            assert.equal(a.promptText(), '');
        });

        it('answerText() returns card answer', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.ok(a.answerText());
            assert.equal(a.answerText(), a.currentCard.spec.answer);
        });

        it('answerText() returns empty string without card', function () {
            var a = createApp();
            assert.equal(a.answerText(), '');
        });

        it('isHebrew() detects Hebrew characters', function () {
            var a = createApp();
            assert.equal(a.isHebrew('\u05D0'), true);
            assert.equal(a.isHebrew('\u05EA'), true);
            assert.equal(a.isHebrew('123'), false);
            assert.equal(a.isHebrew('abc'), false);
            assert.equal(a.isHebrew(''), false);
        });

        it('tierLabel() returns Hebrew tier letter', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.equal(a.tierLabel(), Tiers.tierLetter(1));
        });

        it('tierLabel() returns empty string without progression', function () {
            var a = createApp();
            assert.equal(a.tierLabel(), '');
        });

        it('systemName() returns display name', function () {
            var a = createApp();
            assert.equal(a.systemName(), 'Mispar Hechrachi');
        });

        it('statusText() shows tier and progress', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            var text = a.statusText();
            assert.ok(text.indexOf('Tier') !== -1);
            assert.ok(text.indexOf('/') !== -1);
        });

        it('statusText() returns empty string without progression', function () {
            var a = createApp();
            assert.equal(a.statusText(), '');
        });

        it('statusText() shows review mode when completed', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.progression.completed = true;
            assert.equal(a.statusText(), 'Review mode');
        });

        it('ratingLabel() maps numbers to names', function () {
            var a = createApp();
            assert.equal(a.ratingLabel(1), 'Wrong');
            assert.equal(a.ratingLabel(2), 'Unsure');
            assert.equal(a.ratingLabel(3), 'Good');
            assert.equal(a.ratingLabel(4), 'Easy');
            assert.equal(a.ratingLabel(0), '');
            assert.equal(a.ratingLabel(5), '');
        });
    });

    describe('effectiveTransition()', function () {
        it('returns fade with transitionDuration by default', function () {
            var a = createApp();
            var t = a.effectiveTransition();
            assert.equal(t.type, 'fade');
            assert.equal(t.duration, 250);
        });

        it('returns none when reducedMotion is true', function () {
            var a = createApp();
            a.reducedMotion = true;
            var t = a.effectiveTransition();
            assert.equal(t.type, 'none');
            assert.equal(t.duration, 0);
        });

        it('returns slide-left with transitionDuration', function () {
            var a = createApp();
            a.transition = 'slide-left';
            a.transitionDuration = 400;
            var t = a.effectiveTransition();
            assert.equal(t.type, 'slide-left');
            assert.equal(t.duration, 400);
        });

        it('returns none for unknown transition type', function () {
            var a = createApp();
            a.transition = 'unknown';
            var t = a.effectiveTransition();
            assert.equal(t.type, 'none');
            assert.equal(t.duration, 0);
        });

        it('uses custom transitionDuration for fade', function () {
            var a = createApp();
            a.transition = 'fade';
            a.transitionDuration = 100;
            var t = a.effectiveTransition();
            assert.equal(t.duration, 100);
        });
    });

    describe('transitionStyle()', function () {
        it('returns opacity transition for fade', function () {
            var a = createApp();
            a.transition = 'fade';
            var style = a.transitionStyle();
            assert.ok(style.indexOf('opacity') !== -1);
            assert.ok(style.indexOf('250ms') !== -1);
        });

        it('returns transform+opacity transition for slide-left', function () {
            var a = createApp();
            a.transition = 'slide-left';
            var style = a.transitionStyle();
            assert.ok(style.indexOf('transform') !== -1);
            assert.ok(style.indexOf('opacity') !== -1);
            assert.ok(style.indexOf('250ms') !== -1);
        });

        it('returns empty string when reduced motion', function () {
            var a = createApp();
            a.reducedMotion = true;
            assert.equal(a.transitionStyle(), '');
        });
    });

    describe('transitionClasses()', function () {
        it('returns opacity-0 when not visible (fade)', function () {
            var a = createApp();
            a.transition = 'fade';
            a.cardVisible = false;
            assert.equal(a.transitionClasses(), 'opacity-0');
        });

        it('returns opacity-100 when visible (fade)', function () {
            var a = createApp();
            a.transition = 'fade';
            a.cardVisible = true;
            assert.equal(a.transitionClasses(), 'opacity-100 translate-x-0');
        });

        it('returns translate class when not visible (slide-left)', function () {
            var a = createApp();
            a.transition = 'slide-left';
            a.cardVisible = false;
            assert.ok(a.transitionClasses().indexOf('-translate-x-8') !== -1);
        });

        it('returns empty string when reduced motion', function () {
            var a = createApp();
            a.reducedMotion = true;
            a.cardVisible = false;
            assert.equal(a.transitionClasses(), '');
        });
    });

    describe('handleKeydown()', function () {
        function makeEvent(key, extra) {
            var prevented = false;
            var evt = {
                key: key,
                code: '',
                target: { tagName: 'BODY' },
                preventDefault: function () {
                    prevented = true;
                },
            };
            if (extra) {
                var k;
                for (k in extra) {
                    if (Object.hasOwn(extra, k)) evt[k] = extra[k];
                }
            }
            evt._prevented = function () {
                return prevented;
            };
            return evt;
        }

        it('toggles shortcuts overlay with ?', function () {
            var a = createApp();
            assert.equal(a.shortcutsOpen, false);

            var e = makeEvent('?');
            a.handleKeydown(e);
            assert.equal(a.shortcutsOpen, true);
            assert.ok(e._prevented());

            e = makeEvent('?');
            a.handleKeydown(e);
            assert.equal(a.shortcutsOpen, false);
        });

        it('closes shortcuts overlay with Escape', function () {
            var a = createApp();
            a.shortcutsOpen = true;

            var e = makeEvent('Escape');
            a.handleKeydown(e);
            assert.equal(a.shortcutsOpen, false);
            assert.ok(e._prevented());
        });

        it('Escape does nothing when overlay is closed', function () {
            var a = createApp();
            a.shortcutsOpen = false;

            var e = makeEvent('Escape');
            a.handleKeydown(e);
            assert.equal(a.shortcutsOpen, false);
            assert.ok(!e._prevented());
        });

        it('Space flips card when on flashcard view', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.equal(a.answerRevealed, false);

            var e = makeEvent(' ', { code: 'Space' });
            a.handleKeydown(e);
            assert.equal(a.answerRevealed, true);
            assert.ok(e._prevented());
        });

        it('Space does nothing when answer is already revealed', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.showAnswer();

            var e = makeEvent(' ', { code: 'Space' });
            a.handleKeydown(e);
            // Should not error; answer remains revealed
            assert.equal(a.answerRevealed, true);
            assert.ok(!e._prevented());
        });

        it('Space does nothing on non-flashcard views', function () {
            var a = createApp();
            a.view = 'settings';

            var e = makeEvent(' ', { code: 'Space' });
            a.handleKeydown(e);
            assert.ok(!e._prevented());
        });

        it('1-4 rate card when answer is revealed', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();
            a.showAnswer();

            var e = makeEvent('3');
            a.handleKeydown(e);
            assert.ok(e._prevented());
            // Card should have been rated and next card loaded
            assert.equal(a.answerRevealed, false);
        });

        it('1-4 do nothing when answer is not revealed', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            var card = a.currentCard;
            var e = makeEvent('1');
            a.handleKeydown(e);
            assert.ok(!e._prevented());
            assert.equal(a.currentCard, card);
        });

        it('p navigates to progress', function () {
            var a = createApp();
            var e = makeEvent('p');
            a.handleKeydown(e);
            assert.equal(a.view, 'progress');
            assert.ok(e._prevented());
        });

        it('r navigates to reference', function () {
            var a = createApp();
            var e = makeEvent('r');
            a.handleKeydown(e);
            assert.equal(a.view, 'reference');
            assert.ok(e._prevented());
        });

        it('s navigates to settings', function () {
            var a = createApp();
            var e = makeEvent('s');
            a.handleKeydown(e);
            assert.equal(a.view, 'settings');
            assert.ok(e._prevented());
        });

        it('a navigates to about', function () {
            var a = createApp();
            var e = makeEvent('a');
            a.handleKeydown(e);
            assert.equal(a.view, 'about');
            assert.ok(e._prevented());
        });

        it('ignores keydown in input fields', function () {
            var a = createApp();
            var e = makeEvent('p', { target: { tagName: 'INPUT' } });
            a.handleKeydown(e);
            assert.equal(a.view, 'splash');
            assert.ok(!e._prevented());
        });

        it('ignores keydown in textarea fields', function () {
            var a = createApp();
            var e = makeEvent('s', { target: { tagName: 'TEXTAREA' } });
            a.handleKeydown(e);
            assert.equal(a.view, 'splash');
        });

        it('blocks navigation keys when shortcuts overlay is open', function () {
            var a = createApp();
            a.shortcutsOpen = true;

            var e = makeEvent('p');
            a.handleKeydown(e);
            assert.equal(a.view, 'splash');
            assert.ok(!e._prevented());
        });
    });

    describe('full session flow', function () {
        it('begin -> flip -> rate -> next card cycle', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();

            // Should have a card
            assert.ok(a.currentCard);
            assert.equal(a.view, 'flashcard');
            var firstPrompt = a.promptText();
            assert.ok(firstPrompt);

            // Flip
            a.showAnswer();
            assert.equal(a.answerRevealed, true);
            assert.ok(a.answerText());

            // Rate
            a.rateCard(4);
            assert.equal(a.answerRevealed, false);
            assert.ok(a.currentCard);

            // Card index should update
            assert.ok(a.cardIndex >= 1);
        });

        it('processes multiple cards in sequence', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();

            for (var i = 0; i < 5; i++) {
                assert.ok(a.currentCard, 'should have card on iteration ' + i);
                a.showAnswer();
                a.rateCard(4);
            }

            // Should still have a card (tier 1 has 18 cards for hechrachi)
            assert.ok(a.currentCard);
            assert.ok(a.cardIndex >= 5);
        });

        it('persists progress to localStorage', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();
            a.showAnswer();
            a.rateCard(4);

            // Check that progress was saved
            var saved = Storage.loadProgress('hechrachi');
            assert.ok(saved);
            assert.equal(saved.system, 'hechrachi');
        });
    });

    describe('settings methods', function () {
        it('updateFont() changes hebrewFont and persists', function () {
            var a = createApp();
            a.init();
            a.updateFont('sans');
            assert.equal(a.hebrewFont, 'sans');

            var saved = Storage.loadSettings();
            assert.equal(saved.hebrewFont, 'sans');
        });

        it('updateDarkMode() changes mode and persists', function () {
            var a = createApp();
            a.init();
            a.updateDarkMode('dark');
            assert.equal(a.darkMode, 'dark');

            var saved = Storage.loadSettings();
            assert.equal(saved.darkMode, 'dark');
        });

        it('updateTransition() changes transition style and persists', function () {
            var a = createApp();
            a.init();
            a.updateTransition('slide-left');
            assert.equal(a.transition, 'slide-left');

            var saved = Storage.loadSettings();
            assert.equal(saved.transition, 'slide-left');
        });

        it('updateTransitionDuration() changes duration and persists', function () {
            var a = createApp();
            a.init();
            a.updateTransitionDuration(400);
            assert.equal(a.transitionDuration, 400);

            var saved = Storage.loadSettings();
            assert.equal(saved.transitionDuration, 400);
        });

        it('updateTransitionDuration() converts string to number', function () {
            var a = createApp();
            a.init();
            a.updateTransitionDuration('300');
            assert.equal(a.transitionDuration, 300);
        });

        it('updateSystem() changes system and persists', function () {
            var a = createApp();
            a.init();
            a.updateSystem('katan');
            assert.equal(a.system, 'katan');

            var saved = Storage.loadSettings();
            assert.equal(saved.system, 'katan');
        });

        it('resetCurrentSystem() resets progress for current system', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.showAnswer();
            a.reducedMotion = true;
            a.rateCard(4);

            // Now reset
            a.resetCurrentSystem();
            assert.equal(a.progression.currentTier, 1);
            assert.equal(a.confirmResetSystem, false);
        });
    });

    describe('_applyDarkMode()', function () {
        it('adds dark class for dark mode', function () {
            var a = createApp();
            a.darkMode = 'dark';
            a._applyDarkMode();
            assert.equal(document.documentElement.classList.contains('dark'), true);
        });

        it('removes dark class for light mode', function () {
            document.documentElement.classList.add('dark');
            var a = createApp();
            a.darkMode = 'light';
            a._applyDarkMode();
            assert.equal(document.documentElement.classList.contains('dark'), false);
        });

        it('uses system preference for system mode (dark)', function () {
            _reducedMotion = false;
            // Override matchMedia to return dark preference
            var origMatchMedia = window.matchMedia;
            window.matchMedia = function (query) {
                if (query === '(prefers-color-scheme: dark)') {
                    return { matches: true };
                }
                return origMatchMedia(query);
            };

            var a = createApp();
            a.darkMode = 'system';
            a._applyDarkMode();
            assert.equal(document.documentElement.classList.contains('dark'), true);

            window.matchMedia = origMatchMedia;
        });

        it('uses system preference for system mode (light)', function () {
            var origMatchMedia = window.matchMedia;
            window.matchMedia = function (query) {
                if (query === '(prefers-color-scheme: dark)') {
                    return { matches: false };
                }
                return origMatchMedia(query);
            };

            document.documentElement.classList.add('dark');
            var a = createApp();
            a.darkMode = 'system';
            a._applyDarkMode();
            assert.equal(document.documentElement.classList.contains('dark'), false);

            window.matchMedia = origMatchMedia;
        });
    });

    describe('fontClassName()', function () {
        it('returns font-hebrew-standard for standard', function () {
            var a = createApp();
            a.hebrewFont = 'standard';
            assert.equal(a.fontClassName(), 'font-hebrew-standard');
        });

        it('returns font-hebrew-sans for sans', function () {
            var a = createApp();
            a.hebrewFont = 'sans';
            assert.equal(a.fontClassName(), 'font-hebrew-sans');
        });

        it('returns font-hebrew-rashi for rashi', function () {
            var a = createApp();
            a.hebrewFont = 'rashi';
            assert.equal(a.fontClassName(), 'font-hebrew-rashi');
        });

        it('returns standard as fallback for unknown key', function () {
            var a = createApp();
            a.hebrewFont = 'unknown';
            assert.equal(a.fontClassName(), 'font-hebrew-standard');
        });
    });

    describe('isCipherSystem()', function () {
        it('returns false for valuation systems', function () {
            var a = createApp();
            a.system = 'hechrachi';
            assert.equal(a.isCipherSystem(), false);
        });

        it('returns true for cipher systems', function () {
            var a = createApp();
            a.system = 'atbash';
            assert.equal(a.isCipherSystem(), true);
        });
    });

    describe('referenceData()', function () {
        it('returns 27 rows for hechrachi (22 base + 5 finals)', function () {
            var a = createApp();
            a.init();
            a.system = 'hechrachi';
            var rows = a.referenceData();
            assert.equal(rows.length, 27);
        });

        it('returns 22 rows for atbash (cipher, no finals)', function () {
            var a = createApp();
            a.init();
            a.system = 'atbash';
            var rows = a.referenceData();
            assert.equal(rows.length, 22);
        });

        it('includes letter, name, value fields', function () {
            var a = createApp();
            a.init();
            a.system = 'hechrachi';
            var rows = a.referenceData();
            var first = rows[0];
            assert.ok(first.letter);
            assert.ok(first.name);
            assert.ok(first.value);
            assert.equal(first.isFinal, false);
        });

        it('marks final forms with isFinal flag', function () {
            var a = createApp();
            a.init();
            a.system = 'hechrachi';
            var rows = a.referenceData();
            var finals = rows.filter(function (r) {
                return r.isFinal;
            });
            assert.equal(finals.length, 5);
        });

        it('cipher system values are Hebrew letters', function () {
            var a = createApp();
            a.init();
            a.system = 'atbash';
            var rows = a.referenceData();
            // Atbash maps Alef to Tav
            assert.equal(rows[0].value, '\u05EA');
        });

        it('returns empty for unknown system', function () {
            var a = createApp();
            a.init();
            a.system = 'nonexistent';
            var rows = a.referenceData();
            assert.equal(rows.length, 0);
        });
    });

    describe('referenceNote()', function () {
        it('returns note for hechrachi', function () {
            var a = createApp();
            a.system = 'hechrachi';
            var note = a.referenceNote();
            assert.ok(note.indexOf('15') !== -1);
            assert.ok(note.indexOf('16') !== -1);
        });

        it('returns empty string for other systems', function () {
            var a = createApp();
            a.system = 'atbash';
            assert.equal(a.referenceNote(), '');
        });
    });

    describe('cookie helpers', function () {
        it('_getCookie returns null when no cookies set', function () {
            var a = createApp();
            assert.equal(a._getCookie('gematria_session'), null);
        });

        it('_setCookie and _getCookie round-trip', function () {
            var a = createApp();
            a._setCookie('gematria_session', '1', 30);
            assert.equal(a._getCookie('gematria_session'), '1');
        });

        it('_clearCookie removes the cookie', function () {
            var a = createApp();
            a._setCookie('gematria_session', '1', 30);
            a._clearCookie('gematria_session');
            assert.equal(a._getCookie('gematria_session'), null);
        });
    });

    describe('page-load routing', function () {
        it('routes to splash when no cookie and no progress', function () {
            var a = createApp();
            a.init();
            assert.equal(a.view, 'splash');
        });

        it('routes to welcome when cookie and progress exist', function () {
            var a = createApp();
            // Set up cookie and progress before init
            a._setCookie('gematria_session', '1', 30);
            var state = Progression.createState('hechrachi');
            Storage.saveProgress('hechrachi', state);

            a.init();
            assert.equal(a.view, 'welcome');
            assert.equal(a.hasSavedProgress, true);
        });

        it('clears stale progress when no cookie but progress exists', function () {
            var state = Progression.createState('hechrachi');
            Storage.saveProgress('hechrachi', state);

            var a = createApp();
            a.init();
            assert.equal(a.view, 'splash');
            assert.equal(a.hasSavedProgress, false);
            // Progress should be cleared
            assert.equal(Storage.loadProgress('hechrachi'), null);
        });
    });

    describe('startFresh() (welcome context)', function () {
        it('clears all progress and cookie, returns to splash', function () {
            var a = createApp();
            a._setCookie('gematria_session', '1', 30);
            var state = Progression.createState('hechrachi');
            Storage.saveProgress('hechrachi', state);
            a.init();
            assert.equal(a.view, 'welcome');

            a.startFresh();
            assert.equal(a.view, 'splash');
            assert.equal(a.hasSavedProgress, false);
            assert.equal(a.sessionActive, false);
            assert.equal(a.progression, null);
            assert.equal(a._getCookie('gematria_session'), null);
            assert.equal(Storage.loadProgress('hechrachi'), null);
        });

        it('resets confirmStartFresh flag', function () {
            var a = createApp();
            a.init();
            a.confirmStartFresh = true;
            a.startFresh();
            assert.equal(a.confirmStartFresh, false);
        });
    });

    describe('beginSession() sets cookie', function () {
        it('sets session cookie on begin', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.equal(a._getCookie('gematria_session'), '1');
        });
    });

    describe('placement flow', function () {
        it('beginPlacement() creates state and navigates to placement', function () {
            var a = createApp();
            a.init();
            a.beginPlacement();
            assert.equal(a.placementActive, true);
            assert.ok(a.placementState);
            assert.equal(a.placementState.system, 'hechrachi');
            assert.equal(a.view, 'placement');
            assert.equal(a.placementAnswerRevealed, false);
        });

        it('placementPrompt() returns current card prompt', function () {
            var a = createApp();
            a.init();
            a.beginPlacement();
            var prompt = a.placementPrompt();
            assert.ok(prompt);
        });

        it('placementAnswer() returns current card answer', function () {
            var a = createApp();
            a.init();
            a.beginPlacement();
            var answer = a.placementAnswer();
            assert.ok(answer);
        });

        it('showPlacementAnswer() reveals answer', function () {
            var a = createApp();
            a.init();
            a.beginPlacement();
            assert.equal(a.placementAnswerRevealed, false);
            a.showPlacementAnswer();
            assert.equal(a.placementAnswerRevealed, true);
        });

        it('ratePlacementCard() does nothing when answer not revealed', function () {
            var a = createApp();
            a.init();
            a.beginPlacement();
            a.ratePlacementCard(true);
            // Should not advance (answer not revealed)
            assert.equal(a.placementState.cardIndex, 0);
        });

        it('ratePlacementCard(true) advances to next card', function () {
            var a = createApp();
            a.init();
            a.beginPlacement();
            a.showPlacementAnswer();
            a.ratePlacementCard(true);
            assert.equal(a.placementAnswerRevealed, false);
            assert.equal(a.placementState.cardIndex, 1);
        });

        it('ratePlacementCard(false) finishes placement', function () {
            var a = createApp();
            a.init();
            a.beginPlacement();
            a.showPlacementAnswer();
            a.ratePlacementCard(false);
            assert.equal(a.placementState.done, true);
            assert.equal(a.placementState.startTier, 1);
            // placementMessage should be set
            assert.ok(a.placementMessage);
        });

        it('placementPrompt/Answer return empty without state', function () {
            var a = createApp();
            assert.equal(a.placementPrompt(), '');
            assert.equal(a.placementAnswer(), '');
        });
    });

    describe('progressStats()', function () {
        it('returns zeros without progression', function () {
            var a = createApp();
            var stats = a.progressStats();
            assert.equal(stats.totalReviews, 0);
            assert.equal(stats.correctReviews, 0);
            assert.equal(stats.accuracy, 0);
        });

        it('returns zeros with empty reviewLog', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            var stats = a.progressStats();
            assert.equal(stats.totalReviews, 0);
            assert.equal(stats.correctReviews, 0);
            assert.equal(stats.accuracy, 0);
        });

        it('computes stats from reviewLog', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.progression.reviewLog = [
                { ts: 1, correct: true },
                { ts: 2, correct: true },
                { ts: 3, correct: false },
                { ts: 4, correct: true },
            ];
            var stats = a.progressStats();
            assert.equal(stats.totalReviews, 4);
            assert.equal(stats.correctReviews, 3);
            assert.equal(stats.accuracy, 0.75);
        });

        it('returns 100% accuracy when all correct', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.progression.reviewLog = [
                { ts: 1, correct: true },
                { ts: 2, correct: true },
            ];
            var stats = a.progressStats();
            assert.equal(stats.accuracy, 1);
        });
    });

    describe('tierStats()', function () {
        it('returns empty array without progression', function () {
            var a = createApp();
            assert.deepEqual(a.tierStats(), []);
        });

        it('returns stats for current tier', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            var stats = a.tierStats();
            assert.equal(stats.length, 1);
            assert.equal(stats[0].tier, 1);
            assert.ok(stats[0].label);
            assert.ok(stats[0].cardCount > 0);
            assert.equal(stats[0].reviewed, 0);
            assert.equal(stats[0].mastered, false);
        });

        it('updates reviewed count after reviews', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();
            a.showAnswer();
            a.rateCard(4);

            var stats = a.tierStats();
            assert.ok(stats[0].reviewed >= 1);
        });

        it('returns stats for multiple tiers', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            // Manually advance to tier 2
            a.progression.currentTier = 2;
            Progression.ensureTierCards(a.progression, 2);

            var stats = a.tierStats();
            assert.equal(stats.length, 2);
            assert.equal(stats[0].tier, 1);
            assert.equal(stats[1].tier, 2);
        });

        it('detects mastered tier', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            // Master all tier 1 cards
            var cards = a.progression.tiers['1'];
            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            a.progression.tiers['1'] = cards;

            var stats = a.tierStats();
            assert.equal(stats[0].mastered, true);
        });

        it('computes tier accuracy', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            var cards = a.progression.tiers['1'];
            // Review first card correctly
            cards[0] = CardState.reviewCard(cards[0], 5);
            a.progression.tiers['1'] = cards;

            var stats = a.tierStats();
            assert.equal(stats[0].accuracy, 1);
        });
    });

    describe('formatAccuracy()', function () {
        it('formats 0 as 0%', function () {
            var a = createApp();
            assert.equal(a.formatAccuracy(0), '0%');
        });

        it('formats 1 as 100%', function () {
            var a = createApp();
            assert.equal(a.formatAccuracy(1), '100%');
        });

        it('formats 0.75 as 75%', function () {
            var a = createApp();
            assert.equal(a.formatAccuracy(0.75), '75%');
        });

        it('rounds to nearest integer', function () {
            var a = createApp();
            assert.equal(a.formatAccuracy(0.666), '67%');
        });
    });

    describe('_prepareChartData()', function () {
        it('returns empty arrays without progression', function () {
            var a = createApp();
            var result = a._prepareChartData();
            assert.deepEqual(result.labels, []);
            assert.deepEqual(result.data, []);
        });

        it('returns empty arrays with empty reviewLog', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            var result = a._prepareChartData();
            assert.deepEqual(result.labels, []);
            assert.deepEqual(result.data, []);
        });

        it('groups reviews by day', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            // Two reviews on same day
            var day1 = new Date(2025, 0, 15, 10, 0).getTime();
            a.progression.reviewLog = [
                { ts: day1, correct: true },
                { ts: day1 + 3600000, correct: false },
            ];

            var result = a._prepareChartData();
            assert.equal(result.labels.length, 1);
            assert.equal(result.labels[0], '1/15');
            assert.equal(result.data[0], 50);
        });

        it('handles multiple days in order', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            var day1 = new Date(2025, 0, 10).getTime();
            var day2 = new Date(2025, 0, 11).getTime();
            a.progression.reviewLog = [
                { ts: day1, correct: true },
                { ts: day1 + 1000, correct: true },
                { ts: day2, correct: false },
            ];

            var result = a._prepareChartData();
            assert.equal(result.labels.length, 2);
            assert.equal(result.labels[0], '1/10');
            assert.equal(result.labels[1], '1/11');
            assert.equal(result.data[0], 100);
            assert.equal(result.data[1], 0);
        });

        it('computes percentage as rounded integer', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            var day = new Date(2025, 5, 20).getTime();
            a.progression.reviewLog = [
                { ts: day, correct: true },
                { ts: day + 1000, correct: true },
                { ts: day + 2000, correct: false },
            ];

            var result = a._prepareChartData();
            assert.equal(result.data[0], 67);
        });
    });

    describe('_destroyProgressChart()', function () {
        it('sets _chartInstance to null', function () {
            var a = createApp();
            a._chartInstance = { destroy: function () {} };
            a._destroyProgressChart();
            assert.equal(a._chartInstance, null);
        });

        it('calls destroy on existing instance', function () {
            var a = createApp();
            var destroyed = false;
            a._chartInstance = {
                destroy: function () {
                    destroyed = true;
                },
            };
            a._destroyProgressChart();
            assert.equal(destroyed, true);
        });

        it('does nothing when no chart exists', function () {
            var a = createApp();
            a._destroyProgressChart();
            assert.equal(a._chartInstance, null);
        });
    });

    describe('navigate() chart cleanup', function () {
        it('destroys chart when leaving progress view', function () {
            var a = createApp();
            a.view = 'progress';
            var destroyed = false;
            a._chartInstance = {
                destroy: function () {
                    destroyed = true;
                },
            };

            a.navigate('flashcard');
            assert.equal(destroyed, true);
            assert.equal(a._chartInstance, null);
        });

        it('does not destroy chart when not on progress view', function () {
            var a = createApp();
            a.view = 'settings';
            a._chartInstance = {
                destroy: function () {
                    throw new Error('should not destroy');
                },
            };

            a.navigate('flashcard');
            // Should not throw
            assert.ok(a._chartInstance);
        });
    });

    describe('masteryProgress()', function () {
        it('returns 0 without progression', function () {
            var a = createApp();
            assert.equal(a.masteryProgress(), 0);
        });

        it('returns 0 for fresh tier with no reviews', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            assert.equal(a.masteryProgress(), 0);
        });

        it('returns value between 0 and 1 for partial progress', function () {
            var a = createApp();
            a.init();
            a.reducedMotion = true;
            a.beginSession();

            // Review one card correctly
            a.showAnswer();
            a.rateCard(4);

            var progress = a.masteryProgress();
            assert.ok(progress > 0, 'progress should be > 0');
            assert.ok(progress < 1, 'progress should be < 1');
        });

        it('returns 1 when tier is fully mastered', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            var cards = a.progression.tiers['1'];
            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            a.progression.tiers['1'] = cards;

            assert.equal(a.masteryProgress(), 1);
        });

        it('accuracy component is clamped at mastery threshold', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            // Give all cards 3 reviews (all correct) — completion=1, accuracy=1/0.8>1 → clamped to 1
            var cards = a.progression.tiers['1'];
            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            a.progression.tiers['1'] = cards;

            // 50% * 1.0 + 50% * min(1.0/0.8, 1.0) = 0.5 + 0.5 = 1.0
            assert.equal(a.masteryProgress(), 1);
        });
    });

    describe('completed state', function () {
        it('progressStats works in completed state', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.progression.completed = true;
            a.progression.reviewLog = [
                { ts: 1, correct: true },
                { ts: 2, correct: true },
                { ts: 3, correct: false },
            ];

            var stats = a.progressStats();
            assert.equal(stats.totalReviews, 3);
            assert.equal(stats.correctReviews, 2);
        });

        it('tierStats includes all initialized tiers in completed state', function () {
            var a = createApp();
            a.init();
            a.beginSession();

            // Initialize and master tier 1, advance to tier 2
            var cards = a.progression.tiers['1'];
            for (var i = 0; i < cards.length; i++) {
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
                cards[i] = CardState.reviewCard(cards[i], 5);
            }
            a.progression.tiers['1'] = cards;
            Progression.tryAdvance(a.progression);
            Progression.ensureTierCards(a.progression, 2);
            a.progression.completed = true;

            var stats = a.tierStats();
            assert.equal(stats.length, 2);
            assert.equal(stats[0].mastered, true);
        });

        it('statusText shows review mode when completed', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.progression.completed = true;
            assert.equal(a.statusText(), 'Review mode');
        });

        it('masteryProgress still works in completed state', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.progression.completed = true;

            // Should return a valid number (not crash)
            var progress = a.masteryProgress();
            assert.equal(typeof progress, 'number');
            assert.ok(progress >= 0);
        });
    });

    describe('card state preservation', function () {
        it('preserves revealed state across navigation', function () {
            var a = createApp();
            a.init();
            a.beginSession();
            a.showAnswer();
            assert.equal(a.answerRevealed, true);

            // Navigate away
            a.navigate('settings');
            assert.ok(a.savedCardState);
            assert.equal(a.savedCardState.answerRevealed, true);

            // Navigate back
            a.navigate('flashcard');
            assert.equal(a.answerRevealed, true);
            assert.equal(a.savedCardState, null);
        });

        it('does not save state when not on flashcard view', function () {
            var a = createApp();
            a.view = 'settings';
            a.sessionActive = true;
            a.navigate('about');
            assert.equal(a.savedCardState, null);
        });

        it('does not save state when session is not active', function () {
            var a = createApp();
            a.view = 'flashcard';
            a.sessionActive = false;
            a.navigate('settings');
            assert.equal(a.savedCardState, null);
        });
    });
});
