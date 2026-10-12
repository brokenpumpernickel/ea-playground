# Evolutionary Algorithms Teaching App

An interactive web app that lets students watch and step through evolutionary algorithms, starting with genetic algorithms, so they can connect each algorithm mechanic to the changing solutions.

## Language

### Execution

**Run**:
One execution of an algorithm, fully determined by its configuration and seed.
_Avoid_: Simulation, experiment, session

**Generation**:
One full cycle that turns the current population into the next one.
_Avoid_: Iteration, epoch, round

**Stage**:
One phase of a generation, in order: selection, pairing, crossover, mutation, evaluation of offspring, replacement. The initial population is evaluated once as a setup stage before generation 1.
_Avoid_: Step (when meaning a phase), phase, operator (an operator is the method used inside a stage)

**Micro-step**:
One individual or pair processed inside a stage, such as a single crossover of one pair.
_Avoid_: Sub-step, tick

**Run history**:
The recorded sequence of everything that happened in a run, which the user can scrub backward and forward when paused.
_Avoid_: Log, replay buffer

**Playback tier**:
One of the continuous-run speeds, each defined by how much advances per tick and what is animated: slow (a micro-step), medium (a stage), fast (a generation, animating only the population view and plots), maximum (no animation). Tiers never change a run's results.
_Avoid_: Speed level, animation speed

**Preset**:
A named, curated configuration plus seed that reproduces a specific teaching scenario. A preset expected to fail says so in its description.
_Avoid_: Template, scenario, demo

**Share link**:
A URL that carries a complete configuration and seed (problem, setup including any hand-edited population, every parameter), so that opening it starts a fresh, paused run at generation 0 that is identical to the one it was copied from. It carries no history and no cursor position.
_Avoid_: Permalink, saved run, session link

**Pending parameter**:
An operator setting changed mid-generation that takes effect at the next generation boundary.
_Avoid_: Queued setting, draft setting

**Reset**:
Starting a new run from generation zero, required when changing the problem, representation, population size, initialization, or seed.
_Avoid_: Restart (ambiguous with re-running the same seed)

### Individuals and scores

**Individual**:
A chromosome together with its decoded solution and its scores.
_Avoid_: Candidate, member, solution (a solution is the decoded part only)

**Chromosome**:
The genotype of an individual: a sequence of genes (bits, characters, or real numbers depending on the example).
_Avoid_: Genome, string (for non-string examples)

**Alphabet**:
The ordered set of symbols a gene can take in a problem: 0 and 1 for the binary examples, the allowed letters for the target string. A gene is stored as a position in the alphabet and shown as its symbol.
_Avoid_: Character set, charset

**Gene**:
One position in a chromosome.
_Avoid_: Locus (the position is the index; the gene is its value), allele

**Decoded solution**:
What a chromosome means in the problem's terms, shown to students: an x value, chosen items, a string, a point. Shown as "phenotype" in parentheses only where students need the textbook link.
_Avoid_: Phenotype (as the primary term), expression

**Objective value**:
The problem's native measure of a decoded solution: x², total value, matching positions, f(x, y).
_Avoid_: Raw fitness, score, cost

**Fitness**:
The always-maximised quantity derived from the objective value by a visible rule (identity, minus a penalty, negated for minimisation).
_Avoid_: Utility, goodness

### Constraint handling

**Feasible**:
An individual whose packed set respects the problem's constraint (for the knapsack, a total weight within capacity). Problems without a constraint have only feasible individuals. Success and the stop criteria refer to feasible individuals only.
_Avoid_: Valid, legal

**Packed set**:
The items an individual actually carries after the constraint-handling method has been applied. It can differ from the genes: the first-fit decoder and Baldwinian repair leave genes set to 1 that are not packed, and Lamarckian repair rewrites the genes to match.
_Avoid_: Solution (a solution is the decoded part generally), phenotype

**Penalty**:
A reduction applied to the fitness of an infeasible individual, shown separately from its objective value.
_Avoid_: Cost, discount

**Repair**:
Turning an infeasible decoded solution into a feasible one by dropping items. Lamarckian repair writes the repaired chromosome back into the individual; Baldwinian repair changes only the decoded solution used for scoring and leaves the chromosome as it was.
_Avoid_: Fix, correction

**First-fit decoder**:
A decoding rule that makes every chromosome feasible by construction: walk the items in order, include an item if its gene is 1 and it still fits, otherwise skip it and continue. Genes set to 1 but skipped stay visible.
_Avoid_: Greedy decoder, repair decoder

### Building blocks

**Block**:
A fixed group of genes that the fitness function scores together. The trap problem's chromosome is divided into equal blocks, and the individual's fitness is the sum of its blocks' contributions.
_Avoid_: Segment, chunk, module

**Trap function**:
The score of one block as a function of how many of its genes are 1: the best score when all are 1, but otherwise a score that rises as genes are turned to 0. Every block therefore pulls the search toward all zeros, away from its optimum.
_Avoid_: Deceptive function (a trap is one kind of deceptive function)

**Deceptive attractor**:
The block setting a trap function leads toward, all zeros, which is locally best but not the optimum.
_Avoid_: Local optimum (all zeros in one block is a local optimum of that block only)

**Linkage**:
How close together a block's genes sit on the chromosome. Tight linkage puts a block's genes side by side; loose linkage spreads them out. It decides how often a crossover cut falls inside a block and splits it.
_Avoid_: Epistasis (a related but wider idea), locality

**Schema**:
A pattern over the chromosome that fixes some genes and leaves the others free (written with `*`), such as `1111****`. An individual is an instance of a schema when it matches every fixed gene.
_Avoid_: Template, mask (a crossover mask is a different thing)

### Real-valued search

**Real-valued chromosome**:
A chromosome whose genes are numbers within bounds rather than symbols, such as the pair (x, y) of a point on a landscape. Its genes are shown by value, never through an alphabet.
_Avoid_: Float string, continuous chromosome

**Bounds**:
The lowest and highest value a real gene may take. A value that would leave its bounds is clamped to the nearest bound, and the run history says so.
_Avoid_: Limits, range (the range of a gene is its upper bound minus its lower bound)

**Landscape**:
The fitness of every point of a real-valued search space, drawn as a heatmap or a surface. Higher fitness is always better on it; for a function that is minimised the landscape is of fitness, the negated objective.
_Avoid_: Fitness function (that is the rule; the landscape is its picture), terrain

**Blend crossover (BLX-α)**:
A crossover for real genes in which each child gene is drawn uniformly from the interval between the two parents' values widened on each side by α times the interval's length. With α = 0 children stay between their parents.
_Avoid_: Blend, interpolation crossover

**Arithmetic crossover**:
A crossover for real genes in which the two children are weighted averages of the parents, λ·A + (1 − λ)·B and (1 − λ)·A + λ·B, with one λ drawn per pair.
_Avoid_: Averaging crossover, linear crossover

**Gaussian mutation**:
A mutation for real genes in which a gene chosen to mutate is moved by a normal random step whose standard deviation is a set share (σ) of the gene's range.
_Avoid_: Noise, jitter

**Binary coding**:
Writing a real variable as a fixed number of bits, which stand for one of evenly spaced values between the variable's bounds. The bits of the variable are read as an ordinary binary number or, in Gray coding, as a Gray code.
_Avoid_: Discretisation, bit encoding

**Gray code**:
A way of numbering the values so that neighbouring values differ in exactly one bit, which removes the jumps of ordinary binary, where neighbours such as 0111 and 1000 differ in every bit.
_Avoid_: Reflected binary (the name of the construction, not of the idea students need)

**Trail**:
The positions a population had in the last few generations, drawn faded behind its present positions to show movement. It shows where individuals were, not which one descended from which.
_Avoid_: Path, lineage

### Selection and variation

**Mating pool**:
The parents drawn by selection, with replacement, so one individual can appear several times. Pairing takes it in order, neighbours together. When an odd number of offspring is wanted, selection draws one extra parent and the last pair's second child is dropped.
_Avoid_: Parent list, breeding pool

**Selection weight**:
The non-negative number each individual carries into selection after the weight transformations, which determines its selection probability.
_Avoid_: Scaled fitness, roulette fitness

**Weight transformation**:
One visible step in the ordered chain that turns raw fitness into selection weights, such as shifting by the minimum or mapping to ranks. Users can select and reorder the steps.
_Avoid_: Scaling, normalization (these are specific kinds)

**Bypass**:
A deliberately skipped operation, such as crossover disabled or a pair failing its crossover draw, shown in the execution narrative as a pass-through of copies.
_Avoid_: Skip, no-op

### Replacement

**Replacement**:
The stage that forms the next population, currently always generational: offspring replace the population, with elites carried over.
_Avoid_: Survivor selection

**Offspring truncation**:
An optional mode where λ offspring are generated and evaluated, and only the best N − k survive into the next population, the rest shown as discarded. λ must be at least N − k. Survivors follow the elites best first, ties going to the earlier-made offspring. Off by default, in which case N − k offspring are generated and all survive.
_Avoid_: Overproduction, offspring culling

**Elite**:
An individual copied unchanged into the next population by elitism.
_Avoid_: Survivor, champion
