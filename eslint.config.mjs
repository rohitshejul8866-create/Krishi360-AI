import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'frontend/**/*', 'backend/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
