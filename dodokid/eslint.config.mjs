// Flat ESLint config for Expo SDK 53 (ESLint 9, ESM).
// eslint-config-expo v57 仍是 legacy(eslintrc) 配置，用 FlatCompat 转换为 flat config。
// Run with `npm run lint` (expo lint)。规则额外强化项目 P0 护栏（emoji 图标禁用）。
import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'node:url';

const compat = new FlatCompat({ baseDirectory: fileURLToPath(import.meta.url) });

const NO_EMOJI = /[🌀-🿿☀-➿⤀-⤿🀀-🯿]/u;

export default [
  {
    ignores: ['node_modules/**', 'cloudbase/**', 'dist/**', 'web-build/**', '*.config.js', '*.config.mjs'],
  },
  ...compat.extends('expo'),
  {
    rules: {
      // 禁止在源码中出现 emoji 作为功能图标（应使用 phosphor-react-native）。
      'no-restricted-syntax': [
        'warn',
        {
          selector: `Literal[value=${NO_EMOJI}]`,
          message: '禁止使用 emoji 作为功能图标，请使用 phosphor-react-native 的语义图标。',
        },
      ],
    },
  },
];
