# Share only the run, history and playback layers across algorithms; keep the GA engine specific

The shared layers know only that a run is a sequence of cycles, each cycle a sequence of named stages holding events, with metrics per cycle. Population, generation, mating pool and the six GA stages stay inside the GA engine and its views. More algorithms are planned (evolution strategies, differential evolution, simulated annealing, PSO, ACO), and some of them, like simulated annealing, have no population, so a generalised evolutionary framework built now would encode GA assumptions. We extract further common structure only after the second algorithm exists.

"Cycle" is a working name in code and is deliberately not in `CONTEXT.md` until a second algorithm needs a shared word.
