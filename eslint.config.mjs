// Flat ESLint config shared across the monorepo.
// Per-package configs can extend this with framework plugins (e.g. Next.js in apps/web).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/drizzle/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      // Vote-integrity guardrail: never log raw identity fields. Enforced more strictly
      // by the pii-assertion job, but flag the obvious cases at lint time.
      'no-restricted-syntax': [
        'warn',
        {
          selector:
            "CallExpression[callee.object.name='console'] Identifier[name=/nin|bvn|vnin|selfie/i]",
          message: 'Do not log raw identity fields (NIN/BVN/vNIN/selfie). See R-D / NDPA rules.',
        },
      ],
    },
  },
);
