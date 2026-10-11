/**
 * Where a view finds the target string it should compare chromosomes with. The app sets it once for the whole screen
 * (a getter, so it follows the running problem); views that draw chromosomes read it and mark matching positions.
 * With no target (Goldberg, or a view drawn on its own in a test) nothing is compared.
 */
export const targetContextKey = Symbol('target string');
export type TargetGetter = () => string | undefined;
