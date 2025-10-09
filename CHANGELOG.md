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
