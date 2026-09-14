import {useEffect, useRef, useState} from 'react';
import {toMathFieldValue,toQuirkExpression} from './math-field-value.js';

/** Rich notation is opt-in; opening it never rewrites the user's raw expression. */
export function MathField({id,value,onChange,inputRef,label,allowComplex = false,invalid = false,describedBy,onKeyboardShow}) {
    const [rich,setRich] = useState(false);
    const [loading,setLoading] = useState(false);
    const [error,setError] = useState('');
    const [keyboardHeight,setKeyboardHeight] = useState(0);
    const field = useRef(null);
    const rawField = useRef(null);
    const wasRich = useRef(false);
    const keyboardHost = useRef(null);
    const current = useRef({value,onChange}); current.current = {value,onChange};
    const emitted = useRef(value);
    const alive = useRef(true);
    useEffect(() => {
        if (keyboardHeight > 0) keyboardHost.current?.scrollIntoView({block:'nearest'});
    },[keyboardHeight]);
    useEffect(() => {alive.current=true; return () => {alive.current=false;};},[]);
    useEffect(() => {
        if (wasRich.current && !rich) rawField.current?.focus({preventScroll:true});
        wasRich.current=rich;
    },[rich]);
    const showMath = async () => {
        if (value.trim() && !toMathFieldValue(value).ok) {setError('Use Raw expression for this notation.'); return;}
        setLoading(true);
        try {
            await import('./math-live-runtime.js');
            if (alive.current) {setRich(true); setError('');}
        } catch {if (alive.current) setError('Math input could not load. Raw expression is still available.');}
        finally {if (alive.current) setLoading(false);}
    };
    useEffect(() => {
        if (!rich) return;
        const element = field.current;
        element.mathVirtualKeyboardPolicy = 'manual';
        element.smartMode = false;
        element.setValue(toMathFieldValue(current.current.value).latex ?? '',{silenceNotifications:true});
        emitted.current = current.current.value;
        const input = () => {
            const result = toQuirkExpression(element.value,{allowComplex});
            setError(result.ok ? '' : result.error);
            emitted.current = result.ok ? result.text : '';
            current.current.onChange(emitted.current);
        };
        const keyboard = window.mathVirtualKeyboard;
        const geometry = () => setKeyboardHeight(keyboard.visible && keyboard.container === keyboardHost.current ? Math.max(200,keyboard.boundingRect.height+24) : 0);
        element.addEventListener('input',input);
        keyboard.addEventListener('geometrychange',geometry);
        element.focus();
        return () => {
            element.removeEventListener('input',input);
            keyboard.removeEventListener('geometrychange',geometry);
            if (keyboard.container === keyboardHost.current) {keyboard.hide(); keyboard.container=null;}
        };
    }, [rich,allowComplex]);
    useEffect(() => {
        if (rich && value !== emitted.current) {
            const next = toMathFieldValue(value);
            if (next.ok) field.current?.setValue(next.latex,{silenceNotifications:true});
            emitted.current = value;
        }
    },[value,rich]);
    return <div className="math-entry">
        {rich ? <math-field ref={field} id={id} aria-label={label} aria-invalid={invalid || !!error} aria-describedby={describedBy}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing) {if (event.key === 'Enter') event.preventDefault(); return;}
                if (event.key === 'Escape') {
                    if (window.mathVirtualKeyboard.visible) {window.mathVirtualKeyboard.hide(); setKeyboardHeight(0);}
                    else {setRich(false); setError(''); setKeyboardHeight(0);}
                    event.preventDefault(); event.stopPropagation();
                }
                if (event.key === 'Enter' && !error) {event.preventDefault(); event.currentTarget.closest('form')?.requestSubmit();}
            }} /> : <input id={id} ref={element=>{rawField.current=element;if (inputRef) inputRef.current=element;}} value={value} aria-label={label} aria-invalid={invalid} aria-describedby={describedBy}
                autoComplete="off" spellCheck={false} onChange={event => {setError(''); onChange(event.target.value);}} />}
        <div className="math-entry-actions">
            <button type="button" disabled={loading} onClick={() => rich ? (setRich(false),setKeyboardHeight(0),setError('')) : void showMath()}>
                {loading ? 'Loading…' : rich ? 'Raw expression' : 'Math input'}</button>
            {rich && <button type="button" aria-expanded={keyboardHeight > 0} onClick={() => {
                const keyboard = window.mathVirtualKeyboard;
                if (keyboardHeight) {keyboard.hide(); setKeyboardHeight(0);}
                else {onKeyboardShow?.(); keyboard.container=keyboardHost.current; field.current.focus(); setKeyboardHeight(280); keyboard.show();}
            }}>Math keyboard</button>}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        {rich && <div className="math-keyboard-host" ref={keyboardHost} style={{height:keyboardHeight,'--keycap-height':'30px','--keycap-font-size':'15px','--keyboard-padding-top':'0px'}} />}
    </div>;
}
