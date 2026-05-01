import type { SstApp } from 'sst/constructs/App';
import { MyStack } from './stacks/MyStack';

export default {
  config(_input) {
    return {
      name: 'croco-app',
      region: 'ap-northeast-2',
    };
  },
  stacks(app) {
    app.stack(MyStack);
  },
} satisfies SstApp;
