# @croco/utils-structure-react

React 컴포넌트의 로직과 뷰를 분리하는 구조적 유틸리티입니다.

## 설치

```bash
pnpm add @croco/utils-structure-react
```

## API

### bind

커스텀 훅과 뷰 컴포넌트를 바인딩하여 로직과 UI를 분리합니다.

```tsx
import { bind } from '@croco/utils-structure-react';

interface CounterProps {
  initialCount: number;
}

interface CounterViewProps {
  count: number;
  increment: () => void;
  decrement: () => void;
}

function useCounter({ initialCount }: CounterProps): CounterViewProps {
  const [count, setCount] = useState(initialCount);

  return {
    count,
    increment: () => setCount(c => c + 1),
    decrement: () => setCount(c => c - 1),
  };
}

export const Counter = bind(useCounter, ({ count, increment, decrement }) => (<div>
  <span>{count}</span>
  <button onClick={increment}>+</button>
  <button onClick={decrement}>-</button>
</div>));
```

## 특징

- **관심사 분리**: 비즈니스 로직(훅)과 프레젠테이션(뷰)을 명확히 분리합니다
- **자동 메모이제이션**: 훅과 뷰 컴포넌트 모두 `React.memo`로 래핑됩니다
- **테스트 용이성**: 뷰 컴포넌트를 독립적으로 테스트할 수 있습니다
- **ViewComponent 접근**: `Counter.ViewComponent`로 뷰 컴포넌트에 직접 접근 가능합니다

## 사용 패턴

```tsx
const MyComponent = bind(useMyLogic, MyView);

<MyComponent inputProp="value" />

<MyComponent.ViewComponent computedProp="value" />
```

## Peer Dependencies

- `react` ^18.0.0

