import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const layers = ['app', 'ui', 'render', 'platform', 'sim', 'content']

// Which layers each layer may import, as in the playbook's layer table.
const allowedImports = {
  app: layers,
  ui: ['sim', 'content'],
  render: ['sim', 'content'],
  platform: ['sim', 'content'],
  sim: ['content'],
  content: [],
}

function layerBoundary(layer) {
  const forbidden = layers.filter((other) => other !== layer && !allowedImports[layer].includes(other))
  return {
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbidden.map((other) => ({
              group: [`**/${other}`, `**/${other}/**`],
              message: `The ${layer} layer may not import the ${other} layer.`,
            })),
            ...(layer === 'sim' || layer === 'content'
              ? [{ group: ['three', 'three/**', 'preact', 'preact/**', 'howler'], message: `The ${layer} layer stays free of browser libraries.` }]
              : []),
          ],
        },
      ],
    },
  }
}

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    },
  },
  ...layers.map(layerBoundary),
  {
    files: ['src/sim/**/*.ts', 'src/content/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'window', 'document', 'performance', 'requestAnimationFrame', 'setTimeout', 'setInterval', 'Date'],
      'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use the seeded RNG passed in.' }],
    },
  },
)
