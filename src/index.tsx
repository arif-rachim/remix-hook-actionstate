import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import type {Observer} from "react-hook-useobserver";
import {ObserverValue, useObserver} from "react-hook-useobserver";
import type {FormProps, SubmitFunction} from "@remix-run/react";
import {Form as RemixForm, useActionData, useSubmit} from "@remix-run/react";

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
        // this is where we can do saving or etc.
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
    try {
        const data = JSON.parse(dataString);
        return data as T;
    } catch (err) {
        console.error(err);
    }
    return undefined;
}

/**
 * Hook types for listening the actionState
 */
export type UseActionStateListener<T> = (selector: (param?: (T)) => any, listener: (newVal: any, oldVal: any) => void) => void

type RenderFC = (value: any) => React.ReactElement;

/**
 * Component type for getting the action state value
 */
export type ActionStateValueFC<T> = React.FC<{ selector: (param?: T) => any, render: RenderFC }>


/**
 * Hook types for getting the action state value
 */
export type UseActionStateValue<T> = (selector: (param?: T) => any) => any;

/**
 * FormContext to get the value of the action state
 */
const FormContext = createContext<RemixActionStateInFormHookType<any>>([] as any);

type RemixActionStateInFormHookType<T> = [Observer<T | undefined>, React.Dispatch<React.SetStateAction<T>>, {
    useActionStateListener: UseActionStateListener<T>,
    useActionStateValue: UseActionStateValue<T>,
    ActionStateValue: ActionStateValueFC<T>,
    submit:SubmitFunction
}];
/**
 * Hooks to get the formState by using the remix action state
 */
export function useRemixActionStateInForm<T>():RemixActionStateInFormHookType<T>  {
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
 4. useActionStateListener : This is a React Hook that consists of two functions: a selector function and a listener function. This is helpful if all you want to do is listen for changes in the action state, but you don't want to have to re-render the React component.
 5. Form : This is the React component that can be used as an alternative to remix Form. With this Form element, we do not need to Mount ActionStateField inside Remix Form anymore.
 * </pre>
 */
export function useRemixActionState<T extends object>(initValue?: (T | (() => T))): [Observer<T | undefined>, React.Dispatch<React.SetStateAction<T>>, {
    ActionStateField: React.FC,
    useActionStateListener: UseActionStateListener<T | undefined>,
    useActionStateValue: UseActionStateValue<T>,
    ActionStateValue: ActionStateValueFC<T>,
    Form: React.FC<FormProps & React.RefAttributes<HTMLFormElement>>,
    submit : SubmitFunction
}] {

    const actionData = useActionData<T>();
    const isMounted = useRef(false);
    const [$state, setState] = useObserver<T | undefined>(initValue);
    const remixSubmit = useSubmit();
    const hiddenActionStateRef = useRef<HTMLInputElement | null>(null);

    const submit:SubmitFunction = useCallback((props,options) => {
        const value = JSON.stringify($state.current);
        hiddenActionStateRef.current?.setAttribute('value', value);
        remixSubmit(props,options)
    },[$state, remixSubmit]);

    useEffect(() => {
        if (!isMounted.current) {
            isMounted.current = true;
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
            useActionStateListener(selector, function setValueWrapper(userSuppliedValue:any){
                setValue((oldVal:any) => {
                    let newVal = userSuppliedValue;
                    if(isFunction(newVal)){
                        newVal = newVal.call(null,oldVal);
                    }
                    if(newVal !== oldVal && Array.isArray(newVal) && Array.isArray(oldVal) && newVal.length === oldVal.length){
                        for (let i = 0; i < oldVal.length; i++) {
                            if(oldVal[i] !== newVal[i]){
                                return newVal;
                            }
                        }
                        return oldVal;
                    }
                    return newVal;
                })
            } );
            return value;
        }

        function ActionStateValue<T>(props: React.PropsWithChildren<{ selector: (param: T | undefined) => any, render: RenderFC }>) {
            const value = useActionStateValue(props.selector);
            return props.render(value);
        }

        function Form(props: FormProps & React.RefAttributes<HTMLFormElement>) {

            const onSubmit = props.onSubmit;
            const onSubmitCallback = useCallback((event) => {
                if (onSubmit) onSubmit(event);
                const value = JSON.stringify($state.current);
                hiddenActionStateRef.current?.setAttribute('value', value);
            }, [onSubmit]);
            return <RemixForm {...props} onSubmit={onSubmitCallback}>
                <FormContext.Provider
                    value={[$state, setState, {useActionStateListener, useActionStateValue, ActionStateValue,submit}]}>
                    <input ref={(dom) => hiddenActionStateRef.current = dom} type={'hidden'} name={'_actionState'}/>
                    {props.children}
                </FormContext.Provider>
            </RemixForm>
        }

        return {useActionStateListener, useActionStateValue, ActionStateValue, Form}
    }, [$state, setState]);

    const {ActionStateValue, useActionStateValue, useActionStateListener, Form} = hooks;

    return [$state, setState as React.Dispatch<React.SetStateAction<T>>, {
        ActionStateField,
        useActionStateListener,
        useActionStateValue,
        ActionStateValue,
        Form,
        submit
    }];
}

function isFunction(functionToCheck:any) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}