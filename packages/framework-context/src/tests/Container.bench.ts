import { bench, describe } from 'vitest';
import { Container } from '../libs/Container';

class TestService1 {}
class TestService2 {}
class TestService3 {}
class TestService4 {}
class TestService5 {}
class TestService6 {}
class TestService7 {}
class TestService8 {}
class TestService9 {}
class TestService10 {}
class TestService11 {}
class TestService12 {}
class TestService13 {}
class TestService14 {}
class TestService15 {}
class TestService16 {}
class TestService17 {}
class TestService18 {}
class TestService19 {}
class TestService20 {}
class TestService21 {}
class TestService22 {}
class TestService23 {}
class TestService24 {}
class TestService25 {}
class TestService26 {}
class TestService27 {}
class TestService28 {}
class TestService29 {}
class TestService30 {}
class TestService31 {}
class TestService32 {}
class TestService33 {}
class TestService34 {}
class TestService35 {}
class TestService36 {}
class TestService37 {}
class TestService38 {}
class TestService39 {}
class TestService40 {}
class TestService41 {}
class TestService42 {}
class TestService43 {}
class TestService44 {}
class TestService45 {}
class TestService46 {}
class TestService47 {}
class TestService48 {}
class TestService49 {}
class TestService50 {}

class DepServiceA {
  constructor(public dep: TestService1) {}
}

const serviceClasses = [
  TestService1,
  TestService2,
  TestService3,
  TestService4,
  TestService5,
  TestService6,
  TestService7,
  TestService8,
  TestService9,
  TestService10,
  TestService11,
  TestService12,
  TestService13,
  TestService14,
  TestService15,
  TestService16,
  TestService17,
  TestService18,
  TestService19,
  TestService20,
  TestService21,
  TestService22,
  TestService23,
  TestService24,
  TestService25,
  TestService26,
  TestService27,
  TestService28,
  TestService29,
  TestService30,
  TestService31,
  TestService32,
  TestService33,
  TestService34,
  TestService35,
  TestService36,
  TestService37,
  TestService38,
  TestService39,
  TestService40,
  TestService41,
  TestService42,
  TestService43,
  TestService44,
  TestService45,
  TestService46,
  TestService47,
  TestService48,
  TestService49,
  TestService50,
];

describe('Container benchmarks', () => {
  bench(
    'Container.register × 50 components',
    () => {
      Container.reset();
      for (const ServiceClass of serviceClasses) {
        Container.register(ServiceClass, 'singleton');
      }
    },
    { iterations: 50, warmupIterations: 10 }
  );

  bench(
    'Container.get singleton (cold)',
    () => {
      Container.reset();
      Container.register(TestService1, 'singleton');
      Container.get(TestService1);
    },
    { iterations: 100, warmupIterations: 5 }
  );

  bench(
    'Container.validate (50 components)',
    () => {
      Container.reset();
      for (const ServiceClass of serviceClasses) {
        Container.register(ServiceClass, 'singleton');
      }
      Container.register(DepServiceA, 'singleton');
      Container.validate();
    },
    { iterations: 50, warmupIterations: 5 }
  );
});

describe('Container.get singleton (warm)', () => {
  bench(
    'warm - returns cached instance',
    () => {
      Container.get(TestService1);
    },
    {
      iterations: 200,
      warmupIterations: 20,
      setup: () => {
        Container.reset();
        Container.register(TestService1, 'singleton');
        Container.set(TestService1, new TestService1());
      },
    }
  );
});
