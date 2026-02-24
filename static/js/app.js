/**
 * Alpine.js application controller.
 *
 * Thin layer that wires Alpine.js reactive state to the existing
 * IIFE modules (Progression, CardSelection, Storage, Tiers, etc.).
 * All business logic lives in those modules; this file handles
 * view routing, UI state, and event binding.
 *
 * Loaded after progression.js and before alpine.min.js.
 * Not an IIFE — defines a global app() function for Alpine x-data.
 * No arrow functions, no let/const. Requires ES2022+ (Object.hasOwn).
 */

function app() {
    'use strict';

    // Rating buttons 1-4 map to SM-2 quality values
    var QUALITY_MAP = [0, 1, 3, 4, 5];

    return {
        // -----------------------------------------------------------
        // State
        // -----------------------------------------------------------

        // View routing
        view: 'splash',
        previousView: null,

        // Session
        system: 'hechrachi',
        progression: null,
        sessionActive: false,
        hasSavedProgress: false,

        // Card
        currentCard: null,
        answerRevealed: false,
        cardIndex: 0,
        totalCards: 0,

        // Card preservation (save/restore when navigating away from flashcard)
        savedCardState: null,

        // Transitions
        transition: 'fade',
        cardVisible: true,
        reducedMotion: false,

        // UI
        darkMode: true,
        shortcutsOpen: false,

        // -----------------------------------------------------------
        // Lifecycle
        // -----------------------------------------------------------

        init: function () {
            // Detect reduced motion preference
            var mql = window.matchMedia('(prefers-reduced-motion: reduce)');
            this.reducedMotion = mql.matches;
            var self = this;
            mql.addEventListener('change', function (e) {
                self.reducedMotion = e.matches;
            });

            // Load saved settings
            var settings = Storage.loadSettings();
            if (settings) {
                if (settings.transition) this.transition = settings.transition;
                if (settings.darkMode !== undefined) this.darkMode = settings.darkMode;
                if (settings.system) this.system = settings.system;
            }

            // Check for saved progress
            var saved = Storage.loadProgress(this.system);
            this.hasSavedProgress = !!(saved && saved.system === this.system);

            // Ensure gematria data is ready
            Gematria.initialize();
        },

        // -----------------------------------------------------------
        // Navigation
        // -----------------------------------------------------------

        navigate: function (target) {
            // Save card state when leaving flashcard view mid-session
            if (this.view === 'flashcard' && target !== 'flashcard' && this.sessionActive) {
                this.savedCardState = {
                    currentCard: this.currentCard,
                    answerRevealed: this.answerRevealed,
                    cardIndex: this.cardIndex,
                };
            }

            // Restore card state when returning to flashcard view
            if (target === 'flashcard' && this.savedCardState) {
                this.currentCard = this.savedCardState.currentCard;
                this.answerRevealed = this.savedCardState.answerRevealed;
                this.cardIndex = this.savedCardState.cardIndex;
                this.savedCardState = null;
            }

            this.previousView = this.view;
            this.view = target;

            // Close shortcuts overlay on any navigation
            this.shortcutsOpen = false;
        },

        // -----------------------------------------------------------
        // Session management
        // -----------------------------------------------------------

        beginSession: function () {
            this.progression = Progression.loadOrCreate(this.system);
            Progression.ensureTierCards(this.progression, this.progression.currentTier);
            this.sessionActive = true;
            this.savedCardState = null;
            this._updateTierInfo();
            this.loadNextCard();
            this.navigate('flashcard');
        },

        resumeSession: function () {
            // loadOrCreate will find saved progress
            this.beginSession();
        },

        startFresh: function () {
            this.progression = Progression.reset(this.system);
            Progression.ensureTierCards(this.progression, this.progression.currentTier);
            this.sessionActive = true;
            this.savedCardState = null;
            this._updateTierInfo();
            this.loadNextCard();
            this.navigate('flashcard');
        },

        switchSystem: function (newSystem) {
            this.system = newSystem;
            this.savedCardState = null;

            var saved = Storage.loadProgress(newSystem);
            this.hasSavedProgress = !!(saved && saved.system === newSystem);

            if (this.sessionActive) {
                this.progression = Progression.loadOrCreate(newSystem);
                Progression.ensureTierCards(this.progression, this.progression.currentTier);
                this._updateTierInfo();
                this.loadNextCard();
            }
        },

        // -----------------------------------------------------------
        // Card flow
        // -----------------------------------------------------------

        loadNextCard: function () {
            if (!this.progression) return;

            var result = Progression.nextCard(this.progression);

            if (result.type === 'advance') {
                var adv = Progression.tryAdvance(this.progression);
                Progression.save(this.progression);

                if (adv.advanced) {
                    Progression.ensureTierCards(this.progression, this.progression.currentTier);
                    this._updateTierInfo();
                }

                result = Progression.nextCard(this.progression);
            }

            if (result.type === 'card') {
                this.currentCard = result;
                this.answerRevealed = false;
                this.cardVisible = true;
            } else {
                // Review mode idle — nothing due
                this.currentCard = null;
                this.answerRevealed = false;
            }

            this._updateCardIndex();
        },

        showAnswer: function () {
            if (!this.currentCard) return;
            this.answerRevealed = true;
        },

        rateCard: function (rating) {
            if (!this.currentCard || !this.answerRevealed) return;
            if (rating < 1 || rating > 4) return;

            var quality = QUALITY_MAP[rating];
            var cardId = this.currentCard.card.card_id;
            Progression.recordReview(this.progression, cardId, quality);

            this.transitionToNextCard();
        },

        transitionToNextCard: function () {
            var self = this;
            var trans = this.effectiveTransition();

            if (trans.type === 'none' || trans.duration === 0) {
                this.loadNextCard();
                return;
            }

            // Animate out
            this.cardVisible = false;

            setTimeout(function () {
                self.loadNextCard();
                // Animate in after DOM update
                if (self.$nextTick) {
                    self.$nextTick(function () {
                        self.cardVisible = true;
                        var container = document.getElementById('flashcard-container');
                        if (container) container.focus();
                    });
                } else {
                    self.cardVisible = true;
                }
            }, trans.duration);
        },

        // -----------------------------------------------------------
        // Transition helpers
        // -----------------------------------------------------------

        effectiveTransition: function () {
            if (this.reducedMotion) {
                return { type: 'none', duration: 0 };
            }
            if (this.transition === 'fade') {
                return { type: 'fade', duration: 250 };
            }
            if (this.transition === 'slide-left') {
                return { type: 'slide-left', duration: 300 };
            }
            return { type: 'none', duration: 0 };
        },

        transitionStyle: function () {
            var trans = this.effectiveTransition();
            if (trans.type === 'none') return '';
            if (trans.type === 'fade') {
                return 'transition: opacity ' + trans.duration + 'ms ease-in-out;';
            }
            if (trans.type === 'slide-left') {
                return (
                    'transition: transform ' +
                    trans.duration +
                    'ms ease-in-out, opacity ' +
                    trans.duration +
                    'ms ease-in-out;'
                );
            }
            return '';
        },

        transitionClasses: function () {
            var trans = this.effectiveTransition();
            if (trans.type === 'none') return '';
            if (!this.cardVisible) {
                if (trans.type === 'fade') return 'opacity-0';
                if (trans.type === 'slide-left') return 'opacity-0 -translate-x-8';
            }
            return 'opacity-100 translate-x-0';
        },

        // -----------------------------------------------------------
        // Display helpers
        // -----------------------------------------------------------

        promptText: function () {
            if (!this.currentCard || !this.currentCard.spec) return '';
            return this.currentCard.spec.prompt;
        },

        answerText: function () {
            if (!this.currentCard || !this.currentCard.spec) return '';
            return this.currentCard.spec.answer;
        },

        isHebrew: function (text) {
            return /[\u0590-\u05FF]/.test(text);
        },

        tierLabel: function () {
            if (!this.progression) return '';
            return Tiers.tierLetter(this.progression.currentTier);
        },

        systemName: function () {
            var sys = GematriaRegistry.get(this.system);
            return sys ? sys.name : this.system;
        },

        statusText: function () {
            if (!this.progression) return '';
            if (this.progression.completed) return 'Review mode';
            return 'Tier ' + this.tierLabel() + ' \u2014 ' + this.cardIndex + '/' + this.totalCards;
        },

        ratingLabel: function (rating) {
            var labels = ['', 'Wrong', 'Unsure', 'Good', 'Easy'];
            return labels[rating] || '';
        },

        // -----------------------------------------------------------
        // Keyboard handling
        // -----------------------------------------------------------

        handleKeydown: function (event) {
            // Ignore when typing in form fields
            var tag = event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            // Escape closes shortcuts overlay
            if (event.key === 'Escape') {
                if (this.shortcutsOpen) {
                    this.shortcutsOpen = false;
                    event.preventDefault();
                }
                return;
            }

            // ? toggles shortcuts overlay
            if (event.key === '?') {
                this.shortcutsOpen = !this.shortcutsOpen;
                event.preventDefault();
                return;
            }

            // Block other shortcuts when overlay is open
            if (this.shortcutsOpen) return;

            // Space: flip card (only when not yet revealed)
            if (event.key === ' ' || event.code === 'Space') {
                if (this.view === 'flashcard' && !this.answerRevealed && this.currentCard) {
                    this.showAnswer();
                    event.preventDefault();
                }
                return;
            }

            // 1-4: rate card (only when answer is revealed)
            if (event.key >= '1' && event.key <= '4') {
                if (this.view === 'flashcard' && this.answerRevealed) {
                    this.rateCard(Number(event.key));
                    event.preventDefault();
                }
                return;
            }

            // Navigation shortcuts
            switch (event.key.toLowerCase()) {
                case 'p':
                    this.navigate('progress');
                    event.preventDefault();
                    break;
                case 'r':
                    this.navigate('reference');
                    event.preventDefault();
                    break;
                case 's':
                    this.navigate('settings');
                    event.preventDefault();
                    break;
                case 'a':
                    this.navigate('about');
                    event.preventDefault();
                    break;
            }
        },

        // -----------------------------------------------------------
        // Internal helpers
        // -----------------------------------------------------------

        _updateTierInfo: function () {
            if (!this.progression) return;
            var specs = Progression.currentTierSpecs(this.progression);
            this.totalCards = specs.length;
        },

        _updateCardIndex: function () {
            if (!this.progression) return;
            var cards = Progression.currentTierCards(this.progression);
            var count = 0;
            for (var i = 0; i < cards.length; i++) {
                if (cards[i].review_count > 0) count++;
            }
            this.cardIndex = count;
        },
    };
}
