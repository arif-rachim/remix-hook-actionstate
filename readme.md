# remix-hook-actionstate

remix-hook-actionstate is a small React hook library for [Remix](https://remix.run) (v1) apps that keeps one piece of client-side state in sync with a route's `action` function. Normally a Remix form only sends flat form fields, and the action's return value has to be wired back into component state by hand. This library serialises the whole state object as JSON into a hidden `_actionState` form field on submit, gives the action a helper to parse it back, and feeds whatever the action returns (via `useActionData`) back into the state. It is meant for Remix developers building forms around a nested state object who want to avoid manual field-by-field wiring and needless re-renders. State lives in an observer from `react-hook-useobserver`, so components can subscribe to a selected slice of it instead of re-rendering on every change. The code is a single TypeScript file, published to npm as `1.0.0-alpha.20`, and was last changed in July 2022.

> Status: alpha, not actively maintained. Built against `@remix-run/react` 1.6 and React 16.14+.

## Features

- `useRemixActionState<T>(initValue)` returns `[state, setState, helpers]`, similar to `useState`, where `state` is an observer whose current value is `state.current`.
- `actionStateFunction<T>({formData})` parses the `_actionState` field inside a Remix `action`.
- After each submission, the value returned by the action through `useActionData()` replaces the client state.
- `Form`: a drop-in replacement for Remix `Form` that adds the hidden `_actionState` field and fills it on submit.
- `ActionStateField`: the hidden input on its own, for use inside a normal Remix `Form`.
- `ActionStateValue`: a component that takes a `selector` and a `render` function and re-renders only when the selected value changes.
- `useActionStateValue(selector)`: a hook that returns the selected value (arrays are compared item by item).
- `useActionStateListener(selector, listener)`: a hook that calls `listener(newVal, oldVal)` without re-rendering.
- `submit`: a wrapper around Remix `useSubmit()` that writes the current state into the hidden field before submitting.
- `useRemixActionStateInForm<T>()`: reads the state, setter and helpers from any component rendered inside `Form`.

## Tech stack

TypeScript · React · Remix (`@remix-run/react`) · [react-hook-useobserver](https://www.npmjs.com/package/react-hook-useobserver)

## Installation

```bash
npm install remix-hook-actionstate
```

Peer dependencies: `react` and `react-dom` (>= 16.14.0). The package imports `@remix-run/react`, so it must be used inside a Remix app.

## Usage

In the route's action, read the state that the form sent and return it (changed if needed):

```tsx
import type {ActionFunction} from "@remix-run/node";
import {json} from "@remix-run/node";
import {actionStateFunction, useRemixActionState} from "remix-hook-actionstate";

interface StateData {
    user: { name: string; age: string; address: string };
}

export const action: ActionFunction = async ({request}) => {
    const formData = await request.formData();
    const actionState = await actionStateFunction<StateData>({formData});
    if (formData.get("action") === "save") {
        // save actionState.user here
    }
    return json(actionState);
};
```

In the route component, use the returned `Form` and helpers:

```tsx
export default function UserRoute() {
    const [state, setState, {Form, ActionStateValue}] = useRemixActionState<StateData>({
        user: {name: "", age: "", address: ""},
    });
    return (
        <Form method="post">
            <ActionStateValue
                selector={(s) => s?.user.name}
                render={(name) => (
                    <input
                        value={name}
                        onChange={(e) => {
                            const value = e.target.value;
                            setState((old) => ({...old, user: {...old.user, name: value}}));
                        }}
                    />
                )}
            />
            <button name="action" value="save">Save</button>
        </Form>
    );
}
```

If you prefer the stock Remix `Form`, render `<ActionStateField />` inside it instead.

## Development

```bash
npm install
npm run build   # compiles src/ to lib/cjs and lib/esm with tsc
npm start       # build in watch mode
```

`npm test` runs Jest, but the repository contains no test files yet, and `jest.config.js` points at a `src/setupEnzyme.ts` file that does not exist.

## License

MIT
