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
        transitionDuration: 250,
        cardVisible: true,
        reducedMotion: false,

        // UI
        hebrewFont: 'standard',
        darkMode: 'system',
        degradedMode: false,
        shortcutsOpen: false,

        // Placement assessment
        placementActive: false,
        placementState: null,
        placementAnswerRevealed: false,
        placementMessage: '',

        // Confirmation dialogs
        confirmResetSystem: false,
        confirmStartFresh: false,

        // Chart
        _chartInstance: null,

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

            // Check storage availability
            this.degradedMode = !Storage.isAvailable();

            // Load saved settings via Settings module
            var settings = Settings.load();

            // Migrate boolean darkMode to string
            if (settings.darkMode === true) {
                settings.darkMode = 'dark';
            } else if (settings.darkMode === false) {
                settings.darkMode = 'light';
            }

            this.system = settings.system;
            this.hebrewFont = settings.hebrewFont;
            this.darkMode = settings.darkMode;
            this.transition = settings.transition;
            this.transitionDuration = settings.transitionDuration;

            // Apply dark mode to HTML element
            this._applyDarkMode();

            // Ensure gematria data is ready
            Gematria.initialize();

            // Page-load routing
            var hasCookie = !!this._getCookie('gematria_session');
            var saved = Storage.loadProgress(this.system);
            this.hasSavedProgress = !!(saved && saved.system === this.system);

            if (hasCookie && this.hasSavedProgress) {
                this.view = 'welcome';
            } else if (!hasCookie && this.hasSavedProgress) {
                // Stale progress without session cookie — clear it
                Storage.clearProgress(this.system);
                this.hasSavedProgress = false;
                this.view = 'splash';
            } else {
                this.view = 'splash';
            }
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

            // Destroy chart when leaving progress view
            if (this.view === 'progress' && target !== 'progress') {
                this._destroyProgressChart();
            }

            this.previousView = this.view;
            this.view = target;

            // Close shortcuts overlay on any navigation
            this.shortcutsOpen = false;

            // Init chart when entering progress view
            if (target === 'progress' && this.$nextTick) {
                var self = this;
                this.$nextTick(function () {
                    self.initProgressChart();
                });
            }
        },

        // -----------------------------------------------------------
        // Session management
        // -----------------------------------------------------------

        beginSession: function () {
            this.progression = Progression.loadOrCreate(this.system);
            Progression.ensureTierCards(this.progression, this.progression.currentTier);
            this.sessionActive = true;
            this.savedCardState = null;
            this._setCookie('gematria_session', '1', 30);
            this._updateTierInfo();
            this.loadNextCard();
            this.navigate('flashcard');
        },

        resumeSession: function () {
            // loadOrCreate will find saved progress
            this.beginSession();
        },

        startFresh: function () {
            // Clear ALL system progress and cookie, return to splash
            Storage.clearAllProgress();
            this._clearCookie('gematria_session');
            this.hasSavedProgress = false;
            this.sessionActive = false;
            this.progression = null;
            this.currentCard = null;
            this.savedCardState = null;
            this.confirmStartFresh = false;
            this.navigate('splash');
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
        // Settings methods
        // -----------------------------------------------------------

        _currentSettings: function () {
            return {
                system: this.system,
                hebrewFont: this.hebrewFont,
                darkMode: this.darkMode,
                transition: this.transition,
                transitionDuration: this.transitionDuration,
            };
        },

        _saveSetting: function (key, value) {
            this[key] = value;
            Settings.save(this._currentSettings());
        },

        updateSystem: function (key) {
            this._saveSetting('system', key);
            this.switchSystem(key);
        },

        updateFont: function (key) {
            this._saveSetting('hebrewFont', key);
        },

        updateDarkMode: function (mode) {
            this._saveSetting('darkMode', mode);
            this._applyDarkMode();
        },

        updateTransition: function (style) {
            this._saveSetting('transition', style);
        },

        updateTransitionDuration: function (ms) {
            this._saveSetting('transitionDuration', Number(ms));
        },

        resetCurrentSystem: function () {
            Progression.reset(this.system);
            if (this.sessionActive) {
                this.progression = Progression.loadOrCreate(this.system);
                Progression.ensureTierCards(this.progression, this.progression.currentTier);
                this._updateTierInfo();
                this.loadNextCard();
            }
            this.confirmResetSystem = false;
        },

        _applyDarkMode: function () {
            var html = document.documentElement;
            if (!html) return;

            if (this.darkMode === 'dark') {
                html.classList.add('dark');
            } else if (this.darkMode === 'light') {
                html.classList.remove('dark');
            } else {
                // system
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                    html.classList.add('dark');
                } else {
                    html.classList.remove('dark');
                }
            }
        },

        fontClassName: function () {
            var fonts = Settings.FONTS;
            for (var i = 0; i < fonts.length; i++) {
                if (fonts[i].key === this.hebrewFont) {
                    return fonts[i].className;
                }
            }
            return 'font-hebrew-standard';
        },

        // -----------------------------------------------------------
        // Placement assessment
        // -----------------------------------------------------------

        beginPlacement: function () {
            this.placementState = Placement.create(this.system);
            this.placementActive = true;
            this.placementAnswerRevealed = false;
            this.placementMessage = '';
            this.navigate('placement');
        },

        placementPrompt: function () {
            if (!this.placementState) return '';
            var card = Placement.currentCard(this.placementState);
            return card ? card.prompt : '';
        },

        placementAnswer: function () {
            if (!this.placementState) return '';
            var card = Placement.currentCard(this.placementState);
            return card ? card.answer : '';
        },

        showPlacementAnswer: function () {
            this.placementAnswerRevealed = true;
        },

        ratePlacementCard: function (correct) {
            if (!this.placementState || !this.placementAnswerRevealed) return;

            var result = Placement.recordResponse(this.placementState, correct);
            this.placementAnswerRevealed = false;

            if (result.done) {
                this.finishPlacement(result.startTier);
            }
        },

        finishPlacement: function (startTier) {
            var self = this;
            var tierLabel = Tiers.tierLetter(startTier);
            this.placementMessage = 'Starting at Tier ' + tierLabel;

            setTimeout(function () {
                self.placementActive = false;
                self.placementState = null;
                self.placementMessage = '';

                // Create progression at determined tier
                self.progression = Progression.createState(self.system);
                self.progression.currentTier = startTier;
                Progression.ensureTierCards(self.progression, startTier);
                Progression.save(self.progression);

                self.sessionActive = true;
                self._setCookie('gematria_session', '1', 30);
                self._updateTierInfo();
                self.loadNextCard();
                self.navigate('flashcard');
            }, 1500);
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
            var duration = this.transitionDuration;
            if (this.transition === 'fade') {
                return { type: 'fade', duration: duration };
            }
            if (this.transition === 'slide-left') {
                return { type: 'slide-left', duration: duration };
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

        isCipherSystem: function () {
            var sys = GematriaRegistry.get(this.system);
            return sys ? sys.type === 'cipher' : false;
        },

        referenceData: function () {
            var alpha = Gematria.alphabet();
            var sys = GematriaRegistry.get(this.system);
            if (!sys) return [];

            var rows = [];
            var i, letter, info, value;

            if (sys.type === 'cipher') {
                // Cipher systems: 22 rows, Letter | Name | Maps To
                for (i = 0; i < alpha.length; i++) {
                    letter = alpha[i];
                    info = Gematria.letterInfo(letter);
                    rows.push({
                        letter: letter,
                        name: info.name,
                        value: sys.fn(letter),
                        isFinal: false,
                    });
                }
            } else {
                // Valuation systems: 22 base + 5 final forms
                for (i = 0; i < alpha.length; i++) {
                    letter = alpha[i];
                    info = Gematria.letterInfo(letter);
                    value = sys.fn(letter);
                    rows.push({
                        letter: letter,
                        name: info.name,
                        value: String(value),
                        isFinal: false,
                    });
                    // Add final form if exists
                    if (info.finalForm) {
                        var finalValue = sys.fn(info.finalForm);
                        rows.push({
                            letter: info.finalForm,
                            name: info.name + ' (final)',
                            value: String(finalValue),
                            isFinal: true,
                        });
                    }
                }
            }

            return rows;
        },

        referenceNote: function () {
            if (this.system === 'hechrachi') {
                return 'Note: 15 and 16 are written as \u05D8\u05F4\u05D5 and \u05D8\u05F4\u05D6 to avoid spelling divine names.';
            }
            return '';
        },

        // -----------------------------------------------------------
        // Progress display
        // -----------------------------------------------------------

        /**
         * Compute aggregate progress statistics from the review log.
         *
         * @returns {object} { totalReviews, correctReviews, accuracy }
         */
        progressStats: function () {
            if (!this.progression || !this.progression.reviewLog) {
                return { totalReviews: 0, correctReviews: 0, accuracy: 0 };
            }

            var log = this.progression.reviewLog;
            var total = log.length;
            var correct = 0;
            var i;
            for (i = 0; i < total; i++) {
                if (log[i].correct) correct++;
            }

            return {
                totalReviews: total,
                correctReviews: correct,
                accuracy: total > 0 ? correct / total : 0,
            };
        },

        /**
         * Compute per-tier statistics for progress display.
         *
         * Returns an array of tier stat objects (1-indexed by tier number),
         * up to and including the current tier.
         *
         * @returns {object[]} Array of { tier, label, cardCount, reviewed,
         *     mastered, accuracy }
         */
        tierStats: function () {
            if (!this.progression) return [];

            var stats = [];
            var tier, key, cards, specs, reviewed, i, acc;

            for (tier = 1; tier <= this.progression.currentTier; tier++) {
                key = String(tier);
                cards = this.progression.tiers[key];
                if (!cards) continue;

                if (this.progression.tierSpecs?.[key]) {
                    specs = this.progression.tierSpecs[key];
                } else {
                    specs = Tiers.getCards(this.progression.system, tier);
                }

                reviewed = 0;
                for (i = 0; i < cards.length; i++) {
                    if (cards[i].review_count > 0) reviewed++;
                }

                acc = CardState.tierAccuracy(cards);

                stats.push({
                    tier: tier,
                    label: Tiers.tierLetter(tier),
                    cardCount: specs.length,
                    reviewed: reviewed,
                    mastered: CardState.checkMastery(cards),
                    accuracy: acc,
                });
            }

            return stats;
        },

        /**
         * Format a decimal accuracy as a percentage string.
         *
         * @param {number} acc - Accuracy value 0-1.
         * @returns {string} Formatted percentage (e.g. "82%").
         */
        formatAccuracy: function (acc) {
            if (acc === 0) return '0%';
            return Math.round(acc * 100) + '%';
        },

        /**
         * Compute overall mastery progress for the current tier as 0-1.
         *
         * Combined metric:
         *   50% weight: cards with >= minReps reviews / total cards
         *   50% weight: min(tier accuracy / mastery threshold, 1.0)
         *
         * Returns 0 when no cards exist. Returns 1 when tier is mastered.
         *
         * @returns {number} Progress value between 0 and 1.
         */
        masteryProgress: function () {
            if (!this.progression) return 0;

            var cards = Progression.currentTierCards(this.progression);
            if (cards.length === 0) return 0;

            var minReps = Tiers.MASTERY.minReps;
            var threshold = Tiers.MASTERY.accuracy;

            // Card completion: fraction of cards with enough reviews
            var readyCount = 0;
            var i;
            for (i = 0; i < cards.length; i++) {
                if (cards[i].review_count >= minReps) readyCount++;
            }
            var completionRatio = readyCount / cards.length;

            // Accuracy component: clamped to mastery threshold
            var acc = CardState.tierAccuracy(cards);
            var accuracyRatio = Math.min(acc / threshold, 1.0);

            return 0.5 * completionRatio + 0.5 * accuracyRatio;
        },

        /**
         * Prepare chart data by grouping reviewLog entries by day.
         *
         * Returns { labels: string[], data: number[] } where labels are
         * date strings (MM/DD) and data are daily accuracy percentages.
         *
         * @returns {object} Chart-ready data.
         */
        _prepareChartData: function () {
            if (
                !this.progression ||
                !this.progression.reviewLog ||
                this.progression.reviewLog.length === 0
            ) {
                return { labels: [], data: [] };
            }

            var log = this.progression.reviewLog;
            var buckets = {};
            var order = [];
            var i, d, key;

            for (i = 0; i < log.length; i++) {
                d = new Date(log[i].ts);
                key = d.getMonth() + 1 + '/' + d.getDate();
                if (!buckets[key]) {
                    buckets[key] = { correct: 0, total: 0 };
                    order.push(key);
                }
                buckets[key].total++;
                if (log[i].correct) buckets[key].correct++;
            }

            var labels = [];
            var data = [];
            for (i = 0; i < order.length; i++) {
                labels.push(order[i]);
                data.push(Math.round((buckets[order[i]].correct / buckets[order[i]].total) * 100));
            }

            return { labels: labels, data: data };
        },

        /**
         * Initialize the Chart.js accuracy chart on the progress view.
         *
         * Creates a line chart from reviewLog data grouped by day.
         * Destroys any existing chart instance first.
         */
        initProgressChart: function () {
            this._destroyProgressChart();

            var chartData = this._prepareChartData();
            if (chartData.labels.length === 0) return;

            var canvas = document.getElementById('accuracy-chart');
            if (!canvas) return;

            var ctx = canvas.getContext('2d');
            if (!ctx) return;

            this._chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartData.labels,
                    datasets: [
                        {
                            label: 'Daily Accuracy %',
                            data: chartData.data,
                            borderColor: 'rgb(59, 130, 246)',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.3,
                            pointRadius: 3,
                        },
                    ],
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            min: 0,
                            max: 100,
                            ticks: {
                                callback: function (v) {
                                    return v + '%';
                                },
                            },
                        },
                    },
                    plugins: {
                        legend: { display: false },
                    },
                },
            });
        },

        /**
         * Destroy the current Chart.js instance if one exists.
         */
        _destroyProgressChart: function () {
            if (this._chartInstance) {
                this._chartInstance.destroy();
                this._chartInstance = null;
            }
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
        // Cookie helpers
        // -----------------------------------------------------------

        _getCookie: function (name) {
            var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
            return match ? decodeURIComponent(match[1]) : null;
        },

        _setCookie: function (name, value, days) {
            var expires = '';
            if (days) {
                var d = new Date();
                d.setTime(d.getTime() + days * 86400000);
                expires = '; expires=' + d.toUTCString();
            }
            document.cookie =
                name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
        },

        _clearCookie: function (name) {
            document.cookie =
                name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
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
