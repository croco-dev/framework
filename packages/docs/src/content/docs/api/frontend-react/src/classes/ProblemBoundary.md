---
editUrl: false
next: false
prev: false
title: "ProblemBoundary"
---

## Extends

- `Component`\<[`ProblemBoundaryProps`](/api/frontend-react/src/type-aliases/problemboundaryprops/), [`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/)\>

## Constructors

### Constructor

> **new ProblemBoundary**(`props`): `ProblemBoundary`

#### Parameters

##### props

[`ProblemBoundaryProps`](/api/frontend-react/src/type-aliases/problemboundaryprops/)

#### Returns

`ProblemBoundary`

#### Inherited from

`Component<ProblemBoundaryProps, ProblemBoundaryState>.constructor`

### Constructor With Context

> **new ProblemBoundary**(`props`, `context`): `ProblemBoundary`

#### Parameters

##### props

[`ProblemBoundaryProps`](/api/frontend-react/src/type-aliases/problemboundaryprops/)

##### context

`any`

value of the parent [Context](https://react.dev/reference/react/Component#context) specified
in `contextType`.

#### Returns

`ProblemBoundary`

#### Inherited from

`Component<ProblemBoundaryProps, ProblemBoundaryState>.constructor`

## Properties

### context

> **context**: `unknown`

If using React Context, re-declare this in your class to be the
`React.ContextType` of your `static contextType`.
Should be used with type annotation or static contextType.

#### Example

```ts
static contextType = MyContext
// For TS pre-3.7:
context!: React.ContextType<typeof MyContext>
// For TS 3.7 and above:
declare context: React.ContextType<typeof MyContext>
```

#### See

[React Docs](https://react.dev/reference/react/Component#context)

#### Inherited from

`Component.context`

---

### props

> `readonly` **props**: `Readonly`\<`P`\>

#### Inherited from

`Component.props`

---

### state

> **state**: [`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/) = `{}`

#### Overrides

`Component.state`

---

### contextType?

> `static` `optional` **contextType?**: `Context`\<`any`\>

If set, `this.context` will be set at runtime to the current value of the given Context.

#### Example

```ts
type MyContext = number
const Ctx = React.createContext<MyContext>(0)

class Foo extends React.Component {
  static contextType = Ctx
  context!: React.ContextType<typeof Ctx>
  render () {
    return <>My context's value: {this.context}</>;
  }
}
```

#### See

[https://react.dev/reference/react/Component#static-contexttype](https://react.dev/reference/react/Component#static-contexttype)

#### Inherited from

`Component.contextType`

---

### ~~propTypes?~~

> `static` `optional` **propTypes?**: `any`

Ignored by React.

:::caution[Deprecated]
Only kept in types for backwards compatibility. Will be removed in a future major release.
:::

#### Inherited from

`Component.propTypes`

## Methods

### componentDidCatch()

> **componentDidCatch**(`error`, `errorInfo`): `void`

Catches exceptions generated in descendant components. Unhandled exceptions will cause
the entire component tree to unmount.

#### Parameters

##### error

`unknown`

##### errorInfo

`ErrorInfo`

#### Returns

`void`

#### Overrides

`Component.componentDidCatch`

---

### componentDidMount()?

> `optional` **componentDidMount**(): `void`

Called immediately after a component is mounted. Setting state here will trigger re-rendering.

#### Returns

`void`

#### Inherited from

`Component.componentDidMount`

---

### componentDidUpdate()

> **componentDidUpdate**(`previousProps`): `void`

Called immediately after updating occurs. Not called for the initial render.

The snapshot is only present if [getSnapshotBeforeUpdate](/api/frontend-react/src/classes/problemboundary/#getsnapshotbeforeupdate) is present and returns non-null.

#### Parameters

##### previousProps

[`ProblemBoundaryProps`](/api/frontend-react/src/type-aliases/problemboundaryprops/)

#### Returns

`void`

#### Overrides

`Component.componentDidUpdate`

---

### ~~componentWillMount()?~~

> `optional` **componentWillMount**(): `void`

Called immediately before mounting occurs, and before Component.render.
Avoid introducing any side-effects or subscriptions in this method.

Note: the presence of NewLifecycle.getSnapshotBeforeUpdate getSnapshotBeforeUpdate
or StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps prevents
this from being invoked.

:::caution[Deprecated]
16.3, use ComponentLifecycle.componentDidMount componentDidMount or the constructor instead; will stop working in React 17
:::

#### Returns

`void`

#### See

- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#initializing-state](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#initializing-state)
- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path)

#### Inherited from

`Component.componentWillMount`

---

### ~~componentWillReceiveProps()?~~

> `optional` **componentWillReceiveProps**(`nextProps`, `nextContext`): `void`

Called when the component may be receiving new props.
React may call this even if props have not changed, so be sure to compare new and existing
props if you only want to handle changes.

Calling Component.setState generally does not trigger this method.

Note: the presence of NewLifecycle.getSnapshotBeforeUpdate getSnapshotBeforeUpdate
or StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps prevents
this from being invoked.

:::caution[Deprecated]
16.3, use static StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps instead; will stop working in React 17
:::

#### Parameters

##### nextProps

`Readonly`\<`P`\>

##### nextContext

`any`

#### Returns

`void`

#### See

- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#updating-state-based-on-props](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#updating-state-based-on-props)
- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path)

#### Inherited from

`Component.componentWillReceiveProps`

---

### componentWillUnmount()?

> `optional` **componentWillUnmount**(): `void`

Called immediately before a component is destroyed. Perform any necessary cleanup in this method, such as
cancelled network requests, or cleaning up any DOM elements created in `componentDidMount`.

#### Returns

`void`

#### Inherited from

`Component.componentWillUnmount`

---

### ~~componentWillUpdate()?~~

> `optional` **componentWillUpdate**(`nextProps`, `nextState`, `nextContext`): `void`

Called immediately before rendering when new props or state is received. Not called for the initial render.

Note: You cannot call Component.setState here.

Note: the presence of NewLifecycle.getSnapshotBeforeUpdate getSnapshotBeforeUpdate
or StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps prevents
this from being invoked.

:::caution[Deprecated]
16.3, use getSnapshotBeforeUpdate instead; will stop working in React 17
:::

#### Parameters

##### nextProps

`Readonly`\<`P`\>

##### nextState

`Readonly`\<`S`\>

##### nextContext

`any`

#### Returns

`void`

#### See

- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#reading-dom-properties-before-an-update](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#reading-dom-properties-before-an-update)
- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path)

#### Inherited from

`Component.componentWillUpdate`

---

### forceUpdate()

> **forceUpdate**(`callback?`): `void`

#### Parameters

##### callback?

() => `void`

#### Returns

`void`

#### Inherited from

`Component.forceUpdate`

---

### getSnapshotBeforeUpdate()?

> `optional` **getSnapshotBeforeUpdate**(`prevProps`, `prevState`): `any`

Runs before React applies the result of Component.render render to the document, and
returns an object to be given to [componentDidUpdate](/api/frontend-react/src/classes/problemboundary/#componentdidupdate). Useful for saving
things such as scroll position before Component.render render causes changes to it.

Note: the presence of this method prevents any of the deprecated
lifecycle events from running.

#### Parameters

##### prevProps

`Readonly`\<`P`\>

##### prevState

`Readonly`\<`S`\>

#### Returns

`any`

#### Inherited from

`Component.getSnapshotBeforeUpdate`

---

### render()

> **render**(): `ReactNode`

#### Returns

`ReactNode`

#### Overrides

`Component.render`

---

### setState()

> **setState**\<`K`\>(`state`, `callback?`): `void`

#### Type Parameters

##### K

`K` _extends_ keyof [`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/)

#### Parameters

##### state

[`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/) \| ((`prevState`, `props`) => [`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/) \| `Pick`\<[`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/), `K`\> \| `null`) \| `Pick`\<[`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/), `K`\> \| `null`

##### callback?

() => `void`

#### Returns

`void`

#### Inherited from

`Component.setState`

---

### shouldComponentUpdate()?

> `optional` **shouldComponentUpdate**(`nextProps`, `nextState`, `nextContext`): `boolean`

Called to determine whether the change in props and state should trigger a re-render.

`Component` always returns true.
`PureComponent` implements a shallow comparison on props and state and returns true if any
props or states have changed.

If false is returned, Component.render, `componentWillUpdate`
and `componentDidUpdate` will not be called.

#### Parameters

##### nextProps

`Readonly`\<`P`\>

##### nextState

`Readonly`\<`S`\>

##### nextContext

`any`

#### Returns

`boolean`

#### Inherited from

`Component.shouldComponentUpdate`

---

### ~~UNSAFE_componentWillMount()?~~

> `optional` **UNSAFE_componentWillMount**(): `void`

Called immediately before mounting occurs, and before Component.render.
Avoid introducing any side-effects or subscriptions in this method.

This method will not stop working in React 17.

Note: the presence of NewLifecycle.getSnapshotBeforeUpdate getSnapshotBeforeUpdate
or StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps prevents
this from being invoked.

:::caution[Deprecated]
16.3, use ComponentLifecycle.componentDidMount componentDidMount or the constructor instead
:::

#### Returns

`void`

#### See

- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#initializing-state](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#initializing-state)
- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path)

#### Inherited from

`Component.UNSAFE_componentWillMount`

---

### ~~UNSAFE_componentWillReceiveProps()?~~

> `optional` **UNSAFE_componentWillReceiveProps**(`nextProps`, `nextContext`): `void`

Called when the component may be receiving new props.
React may call this even if props have not changed, so be sure to compare new and existing
props if you only want to handle changes.

Calling Component.setState generally does not trigger this method.

This method will not stop working in React 17.

Note: the presence of NewLifecycle.getSnapshotBeforeUpdate getSnapshotBeforeUpdate
or StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps prevents
this from being invoked.

:::caution[Deprecated]
16.3, use static StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps instead
:::

#### Parameters

##### nextProps

`Readonly`\<`P`\>

##### nextContext

`any`

#### Returns

`void`

#### See

- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#updating-state-based-on-props](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#updating-state-based-on-props)
- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path)

#### Inherited from

`Component.UNSAFE_componentWillReceiveProps`

---

### ~~UNSAFE_componentWillUpdate()?~~

> `optional` **UNSAFE_componentWillUpdate**(`nextProps`, `nextState`, `nextContext`): `void`

Called immediately before rendering when new props or state is received. Not called for the initial render.

Note: You cannot call Component.setState here.

This method will not stop working in React 17.

Note: the presence of NewLifecycle.getSnapshotBeforeUpdate getSnapshotBeforeUpdate
or StaticLifecycle.getDerivedStateFromProps getDerivedStateFromProps prevents
this from being invoked.

:::caution[Deprecated]
16.3, use getSnapshotBeforeUpdate instead
:::

#### Parameters

##### nextProps

`Readonly`\<`P`\>

##### nextState

`Readonly`\<`S`\>

##### nextContext

`any`

#### Returns

`void`

#### See

- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#reading-dom-properties-before-an-update](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#reading-dom-properties-before-an-update)
- [https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path](https://legacy.reactjs.org/blog/2018/03/27/update-on-async-rendering.html#gradual-migration-path)

#### Inherited from

`Component.UNSAFE_componentWillUpdate`

---

### getDerivedStateFromError()

> `static` **getDerivedStateFromError**(`error`): [`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/)

#### Parameters

##### error

`unknown`

#### Returns

[`ProblemBoundaryState`](/api/frontend-react/src/type-aliases/problemboundarystate/)
