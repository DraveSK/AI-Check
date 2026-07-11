// @ts-check
import tseslint from 'typescript-eslint';

/**
 * Minimal, non-opinionated lint config — catches real mistakes
 * (unresolved types, unused vars via TS's own checker) without imposing
 * a style guide on top of what Prettier/formatting would already do. See
 * docs/SCANNER_DESIGN.md "prefer simple functions" — the same instinct
 * applies to tooling: recommended rules, not a large custom rule set.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.ai-check-history/**', 'public/ai-check-history/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
