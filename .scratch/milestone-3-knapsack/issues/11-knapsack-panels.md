# 11 Views: chosen per item, the feasible line, and the feasible count

Status: open
Type: task
Blocked by: 03, 08
Spec: ../spec.md

## What to build

- The gene-share panel becomes **Chosen per item** for this problem (share of the population with each item's gene set to 1, labelled by item letter), with a printed percentage and the same description as the match-rate strip.
- The fitness plot gains the **best feasible so far** line under the penalty method (a distinct marker and dash, in the legend and in the hidden table); the optimum reference line is the DP value and can be exceeded.
- The stats line says how many of the N individuals are feasible.

## Done when

- Playwright: the chosen-per-item shares equal the population's counts at every generation; the feasible line equals the metrics, and with a small ρ the best fitness line passes the optimum line while the feasible line does not; the line is absent for the other methods and problems.
- Goldberg's and the string problem's panels and plots are unchanged.

## Comments
