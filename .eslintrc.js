module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
    '@typescript-eslint/ban-types': ['error', {
      'types': {
        'Function': false
      }
    }]
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  env: {
    node: true,
    es6: true
  }
};
