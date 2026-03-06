import { strict as assert } from 'node:assert';
import test from 'node:test';
import { z } from 'zod';
import { createEnv } from '../libs/createEnv.js';

test('createEnv returns parsed environment values for valid input', () => {
  const result = createEnv(
    {
      APP_NAME: z.string(),
      PORT: z.coerce.number().int().positive(),
    },
    {
      APP_NAME: 'croco-app',
      PORT: '3000',
    }
  );

  assert.deepEqual(result, {
    APP_NAME: 'croco-app',
    PORT: 3000,
  });
});

test('createEnv throws ZodError instead of exiting the process for invalid input', () => {
  assert.throws(
    () =>
      createEnv(
        {
          APP_NAME: z.string().min(1),
          PORT: z.coerce.number().int().positive(),
        },
        {
          APP_NAME: '',
          PORT: 'not-a-number',
        }
      ),
    (error) => {
      assert(error instanceof z.ZodError);

      const issues = error.issues.map((issue) => issue.path.join('.'));

      assert(issues.includes('APP_NAME'));
      assert(issues.includes('PORT'));

      return true;
    }
  );
});
