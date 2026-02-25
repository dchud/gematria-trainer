"""E2E tests verifying card randomization on new level introduction.

When starting a fresh session or advancing to a new level, the order in
which new cards are introduced should be randomized (not deterministic
spec order). These tests verify that behavior by collecting card prompt
sequences across multiple fresh page loads and checking they differ.
"""


def _fresh_progression(system="hechrachi", level=1):
    """Build a minimal progression state that the app will load."""
    return {
        "system": system,
        "currentLevel": level,
        "levelCount": 8,
        "completed": False,
        "levels": {},
        "seeds": {},
        "levelSpecs": {},
        "reviewLog": [],
    }


def _collect_card_prompts(page, base_url, n=5, level=1):
    """Start a fresh session and collect the first n card prompts.

    Injects localStorage state so the app thinks it has saved progress
    at the given level (but with no cards initialized yet, so
    ensureLevelCards will populate them fresh with randomization).
    Sets the session cookie so the app routes to the welcome view.
    """
    # Navigate to the page first so we can set localStorage on the right origin
    page.goto(base_url)
    page.wait_for_load_state("domcontentloaded")

    # Clear all state
    page.evaluate("localStorage.clear()")
    clear_cookie = (
        "document.cookie = 'gematria_session=;"
        " expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'"
    )
    page.evaluate(clear_cookie)

    # Inject fresh progression state and schema version
    state = _fresh_progression(level=level)
    page.evaluate(
        """(state) => {
            localStorage.setItem('schema_version', '3');
            localStorage.setItem('progress_hechrachi', JSON.stringify(state));
        }""",
        state,
    )

    # Set session cookie so app shows welcome view
    page.evaluate("document.cookie = 'gematria_session=1; path=/; SameSite=Lax'")

    # Reload to pick up the injected state
    page.reload()
    page.wait_for_load_state("domcontentloaded")

    # Click "Continue" on the welcome view
    page.get_by_role("button", name="Continue previous session").click()

    # Wait for the flashcard view prompt to appear
    page.locator("[aria-label='Prompt']").wait_for(state="visible", timeout=5000)

    prompts = []
    for _ in range(n):
        # Read the prompt text
        prompt = page.locator("[aria-label='Prompt']").inner_text()
        prompts.append(prompt)

        # Click "Show Answer"
        page.get_by_role("button", name="Show answer").click()

        # Click "Easy" (rating 4)
        page.get_by_role("button", name="Easy, rating 4 of 4").click()

        # Wait briefly for the next card to appear
        # The card transition should complete and show a new prompt
        if _ < n - 1:
            page.locator("[aria-label='Prompt']").wait_for(
                state="visible", timeout=5000
            )

    return prompts


def test_two_fresh_sessions_differ(page, base_url):
    """Two fresh sessions should produce different card orderings."""
    seq1 = _collect_card_prompts(page, base_url, n=5, level=1)
    seq2 = _collect_card_prompts(page, base_url, n=5, level=1)
    assert seq1 != seq2, (
        f"Two fresh sessions produced identical card sequences: {seq1}. "
        "Card introduction order should be randomized."
    )


def test_cards_not_monotonically_sequential(page, base_url):
    """First 5 cards should not appear in spec-definition order.

    Maps each prompt to its position in the canonical spec list and
    verifies the positions are not monotonically increasing. This catches
    the specific failure mode of cards always appearing as 1, 2, 3, 4, 5.
    """
    prompts = _collect_card_prompts(page, base_url, n=5, level=1)

    # Get the canonical spec order from the app
    spec_prompts = page.evaluate(
        """() => {
            var specs = Levels.getCards('hechrachi', 1);
            return specs.map(function(s) { return s.prompt; });
        }"""
    )

    # Map collected prompts to their positions in the spec list
    positions = []
    for p in prompts:
        if p in spec_prompts:
            positions.append(spec_prompts.index(p))

    # Check that positions are NOT monotonically increasing
    is_monotonic = all(
        positions[i] < positions[i + 1] for i in range(len(positions) - 1)
    )
    assert not is_monotonic, (
        f"Card positions {positions} are monotonically increasing, "
        "suggesting cards are not randomized."
    )


def test_new_level_cards_are_randomized(page, base_url):
    """Verify randomization applies when advancing to level 2."""
    seq1 = _collect_card_prompts(page, base_url, n=5, level=2)
    seq2 = _collect_card_prompts(page, base_url, n=5, level=2)
    assert seq1 != seq2, (
        f"Two fresh level-2 sessions produced identical card sequences: {seq1}. "
        "Card introduction order should be randomized."
    )
