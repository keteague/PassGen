## v0.03.35 - Fix misaligned "Minimum amount of symbols" label
- The "Minimum amount of symbols:" text sat visibly lower than its checkbox and the number field beside it. Root cause: `applyModeOptionVisibility()` (run on every load and mode switch) walks a list of option ids and does `closest('label').style.display = ''` to reveal each option's row; `optForceSymbols`'s nearest `<label>` ancestor is the small inline-flex label around just the checkbox + text (not the row), so this was clearing that label's own hand-authored `display:inline-flex` every time, collapsing it to the browser's block default. The row is already hidden/shown correctly as a side effect of its Symbols-row ancestor, so `optForceSymbols` no longer needs to be in that list.

## v0.03.34 - URL/API bug fixes
- Fixed a crash: any URL with query parameters threw `Cannot access 'selectAllBtn' before initialization`, aborting the whole script (so the API/URL feature was completely non-functional). `selectAllBtn` is now declared before it can be referenced.
- Fixed `format=text` output being built with unescaped `innerHTML`, which allowed `prefixCustom`/`suffixCustom` URL params to inject arbitrary HTML/script (reflected XSS). Output is now built via safe DOM/textContent APIs.
- Fixed custom Prefix (`prefixType=custom`) silently producing nothing whenever the (irrelevant, disabled) length field was empty/zero, which is its normal state in custom mode.
- Fixed `hexBeginLetter`/`hexNoSequential` URL params being silently overwritten by the generic Begin-with-letter/No-sequential checkboxes right after being applied.
- Fixed passphrase generation via URL (`mode=passphrase`) always failing on a fresh load with "Word list still loading" — it now waits for `words.txt` to finish loading before generating.
- Added `optSymbols` to the recognized URL params and to "Copy URL" output (previously the only password character-class checkbox with no way to toggle via URL, and dropped when copying the current settings as a URL).
- Clamped Prefix/Suffix length to 1-32 at generation time, preventing a pathological `prefixLen` value (e.g. via URL) from building a huge string.
- Fixed "Reset Defaults" not refreshing mode-dependent panel visibility (e.g. leaving the Hex/Passphrase options panel visible after resetting to Password mode).
- `format=text` now reports the actual validation/generation error as plaintext instead of returning a silent blank response when generation fails.

## v0.03.33 - Strength badge + URL API
- Password strength badge shown next to length (very weak → very strong), based on a rough entropy estimate.
- Added URL/API support: configure via query parameters and optional plaintext output with `format=text` for curl.

## v0.02.32 - Hex mode (phase 1)
Added Hexadecimal mode with options:
- Hex letters casing (Uppercase/Lowercase)
- Begin with a letter
- No sequential characters
- Prefix/Suffix supported (same logic as Password/Passphrase)

## v0.01.31 - Passphrase affix visibility
Prefix & Suffix options are now visible and usable in Passphrase mode (previously hidden inadvertently).

## v0.01.30 - Affixes, symbol quotas & reset
Added Prefix & Suffix (uppercase, lowercase, numbers, symbols, custom; suffix mirror).
Removed deprecated Random affix type; legacy prefs remapped.
Added per-password length badge.
Introduced minimum symbol quota feature (configurable 1-9, enabled by default).
Improved quota error feedback (distinct length vs duplicates causes).
Randomized placement of required symbols (avoids clustering).
Reset Defaults modal button restoring all options regardless of saved prefs.
Enhanced descriptive error messages for affix and symbol constraints.

## v0.0.4 - Length range & selection actions
Added Length Mode (fixed or range with random length per password).
Added per-password selection checkboxes.
Added Copy All, Select All/None toggle, and Download selected passwords.

## v0.0.3 - Advanced constraints & prefs
Added options: Begin with a letter, No similar, No duplicates, No sequential, Save preferences (cookie).
Strict symbol field: no letters/digits/whitespace; auto de-dup.
Constraint-aware generation with retries.

## v0.0.2 - Add whitespace option & UI refinements
Added Whitespace option.
Repositioned copy icon to left gutter, numbering first.
Replaced +/- collapse with triangle disclosure icons.
Updated header styling distinct from section background.
Version bump to v0.0.2.

## v0.0.1 - Initial rebuild
Initial minimal password generator with length, count, symbol editing.
