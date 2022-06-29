import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from "react";
import {ObserverValue, useObserver} from "react-hook-useobserver";
import {Form as RemixForm, FormProps, useActionData} from "@remix-run/react";

/**
 * we can use actionStateFunction in remix actionFunction to obtain the action state.
 * <pre>
 <code>
 interface StateData {
    user: {
        name: string,
        age: string,
        address: string
    }
}

 export const action: ActionFunction = async ({request}) => {
    const formData = await request.formData();
    const action = formData.get('action');
    const actionState = await actionStateFunction<StateData>({formData});
    if(action === 'save'){
        // this is where we can do saving or etc
    }
    return json(actionState);
}
 </code>
 * </pre>
 * @param formData
 */
export async function actionStateFunction<T>({formData}: { formData: FormData }) {
    const dataString = formData.get('_actionState');
    if (typeof dataString !== 'string') {
        throw new Error('Data should be string');
    }
    try{
        const data = JSON.parse(dataString);
        return data as T;
    }catch(err){
        console.error(err);
    }
    return undefined;
}

/**
 * Hook type for listening the actionState
 */
export type UseActionStateListener<T> = (selector: (param?: (T)) => any, listener: (newVal: any, oldVal: any) => void) => void

/**
 * Component type for getting the action state value
 */
export type ActionStateValueFC<T> = React.FC<{ selector: (param?: T) => any, render: (value: any) => React.ReactElement }>

/**
 * Hook type for getting the action state value
 */
export type UseActionStateValue<T> = (selector: (param?: T) => any) => any;

/**
 * FormContext to get the value of the action state
 */
const FormContext = createContext<any>([]);

/**
 * Hooks to get the formState by using the remix action state
 */
export function useFormState(): [any, React.Dispatch<React.SetStateAction<any>>, {
    useActionStateListener: UseActionStateListener<any>,
    useActionStateValue: UseActionStateValue<any>,
    ActionStateValue: ActionStateValueFC<any>
}] {
    const [state, setState, config] = useContext(FormContext);
    return [state, setState, config];
}

/**
 * <pre>
 A hook known as useRemixActionState can be utilized to facilitate the sharing of state between the client component and the server action function. The following is an explanation of how to use the useRemixActionState function:
 1. we make a call to the useRemixActionState hook inside the component.
 2. using useRemixActionState will result in the return of an array that has the following elements:
 array index to 0: the value of the state
 array index to 1: is a setState function, just how we use useState when we work with react.
 array index to 2: refers to an object that has the following values :

 1. ActionStateField : This is the React Component that needs to be mounted in the Form. This ActionStateField Component will render the html input element with the type hidden.
 2. ActionStateValue : This is the React Component, which can be used to render the state value based on the selector function. Means that it requires both a function for selecting state properties and a function for rendering the value. If the value that is picked by the selector changes, then the ActionStateValue component will be rendered. This is helpful for decreasing the amount of renderings that are done more frequently than necessary.
 3. useActionStateValue : This is a React Hook that has a selector function. The difference between this hook and the ActionStateValue component is that this hook returns the value of the state in a direct manner. There are situations when this can result in inefficient re-rendering of the component that uses it.
 4. useActionStateListener : This is a React Hook that consists of two functions: a selector function and a listener function. This is helpful if all you want to do is listen for changes in the action state, but you don't want to have to re-render the react component.
 * </pre>
 */
export function useRemixActionState<T>(initValue?: (T | (() => T))): [T | undefined, React.Dispatch<React.SetStateAction<T>>, {
    ActionStateField: React.FC,
    useActionStateListener: UseActionStateListener<T | undefined>,
    useActionStateValue: UseActionStateValue<T>,
    ActionStateValue: ActionStateValueFC<T>,
    Form: React.FC<FormProps & React.RefAttributes<HTMLFormElement>>
}] {

    const actionData = useActionData<T>();
    const isLoadedRef = useRef(false);
    const [$state, setState] = useObserver<T | undefined>(initValue);
    useEffect(() => {
        if (!isLoadedRef.current) {
            isLoadedRef.current = true;
            return;
        }
        setState(actionData);
    }, [actionData, setState]);

    const ActionStateField: React.FC = useMemo(() => {
        function ActionStateField() {
            return <ObserverValue observers={$state} render={() => {
                return <input type={'hidden'} name={'_actionState'} defaultValue={JSON.stringify($state.current)}/>
            }}/>
        }

        return ActionStateField;
    }, [$state]);

    const state = $state.current;

    const hooks = useMemo(() => {
        function useActionStateListener<T>(selector: (param?: (T)) => any, listener: (newVal: any, oldVal: any) => void) {
            const propsRef = useRef({selector, listener, oldVal: selector($state.current as any)});
            propsRef.current = {selector, listener, oldVal: propsRef.current.oldVal};

            useEffect(() => {
                return $state.addListener((value: any) => {
                    const newVal = propsRef.current.selector(value);
                    if (newVal !== propsRef.current.oldVal) {
                        propsRef.current.listener(newVal, propsRef.current.oldVal);
                    }
                    propsRef.current.oldVal = newVal;
                });
            }, []);
        }

        function useActionStateValue<T>(selector: (param: T | undefined) => any) {
            const [value, setValue] = useState(() => selector($state.current as any));
            useActionStateListener(selector, setValue);
            return value;
        }

        function ActionStateValue<T>(props: React.PropsWithChildren<{ selector: (param: T | undefined) => any, render: (value: any) => React.ReactElement }>) {
            const value = useActionStateValue(props.selector);
            return props.render(value);
        }

        function Form(props: FormProps & React.RefAttributes<HTMLFormElement>) {
            return <RemixForm {...props}>
                <FormContext.Provider
                    value={[state, setState, {useActionStateListener, useActionStateValue, ActionStateValue}]}>
                    <ActionStateField/>
                    {props.children}
                </FormContext.Provider>
            </RemixForm>
        }

        return {useActionStateListener, useActionStateValue, ActionStateValue, Form}
    }, [$state]);

    const {ActionStateValue, useActionStateValue, useActionStateListener, Form} = hooks;
    return [state, setState as React.Dispatch<React.SetStateAction<T>>, {
        ActionStateField,
        useActionStateListener,
        useActionStateValue,
        ActionStateValue,
        Form
    }];
}