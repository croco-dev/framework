import base from '@croco/eslint-config';

export default [...base, { rules: { '@typescript-eslint/no-explicit-any': 'warns' } }];
