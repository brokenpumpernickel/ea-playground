# 16 Share links for the target string

Status: open
Type: task (test-first)
Blocked by: 04, 14, 15
Spec: ../spec.md

## What to build

Extend the link tests and codec to the new problem: the problem's options (alphabet, target) are part of the configuration, validated by the same rules as the drawer. Cover every preset of both problems, generated string configurations (large alphabets, a space, a 24-letter target, hand-edited string populations) and the new bad-link cases (a target character outside the alphabet, a duplicate symbol, a target that is too long).

## Done when

- Round-trip and run-equality tests for every preset and generated configurations.
- Bad-link cases each give a readable message; a Playwright scenario copies a target-string link and opens it in a fresh page.

## Comments
