import {FormulaParser} from '../../engine/math/formula/FormulaParser.js';

const functions = ['cos','sin','acos','asin','tan','atan','ln','sqrt','exp'];
const names = {arccos:'acos',arcsin:'asin',arctan:'atan'};
function treeMap() {
    const map = new Map([['(', '('], [')', ')'], ['pi', '\\pi'], ['π','\\pi'], ['e','e'], ['i','i']]);
    for (const name of functions) map.set(name,{priority:4,unary_action:a => ({name,a})});
    for (const [name,priority] of [['+',1],['-',1],['*',2],['/',2],['^',3]]) {
        map.set(name,{priority,binary_action:(a,b) => ({name,a,b}),
            ...(['+','-'].includes(name) ? {unary_action:a => ({name:name === '-' ? 'neg' : 'pos',a})} : {})});
    }
    return map;
}
function expressionTree(text) {
    if (!text.trim() || text.length > 4096 || /[+*/^-]\s*$/.test(text)) throw new Error('Complete the expression.');
    return FormulaParser.parse(text,treeMap());
}
function latexOf(tree) {
    if (typeof tree === 'number') {
        if (!Number.isFinite(tree)) throw new Error('Use a finite number.');
        const [n,power] = String(tree).split('e');
        return power === undefined ? n : `${n}\\cdot 10^{${power}}`;
    }
    if (typeof tree === 'string') return tree;
    const a = latexOf(tree.a);
    if (tree.b !== undefined) {
        const b = latexOf(tree.b);
        if (tree.name === '/') return `\\frac{${a}}{${b}}`;
        if (tree.name === '^') return `{${a}}^{${b}}`;
        return `\\left(${a}${tree.name === '*' ? '\\cdot ' : tree.name}${b}\\right)`;
    }
    if (tree.name === 'neg' || tree.name === 'pos') return `${tree.name === 'neg' ? '-' : '+'}\\left(${a}\\right)`;
    if (tree.name === 'sqrt') return `\\sqrt{${a}}`;
    return `\\operatorname{${tree.name}}\\left(${a}\\right)`;
}

/** Reuses Quirk's operator precedence and implicit multiplication, with symbolic token actions. */
export function toMathFieldValue(text) {
    try {return {ok:true,latex:latexOf(expressionTree(text))};}
    catch {return {ok:false,error:'Use Raw expression for this notation.'};}
}

/** A bounded notation translator, never an evaluator. Unknown commands are rejected, not removed. */
export function toQuirkExpression(latex,{allowComplex = false} = {}) {
    try {
        if (latex.length > 4096) throw new Error('Expression is too long.');
        const source = latex.replace(/\\(?:left|right)(?![a-z])/g,'').replace(/\\[,;!]|\\quad(?![a-z])/g,' ');
        let pos = 0;
        const skip = () => {while (/\s/.test(source[pos] ?? '') && pos < source.length) pos++;};
        const group = depth => {
            skip();
            const open = source[pos];
            if (!['{','('].includes(open)) throw new Error('Use parentheses around function arguments.');
            pos++;
            return sequence(open === '{' ? '}' : ')',depth + 1);
        };
        const atom = depth => {
            skip();
            if (depth > 64) throw new Error('Expression is nested too deeply.');
            const c = source[pos];
            if (c === '{' || c === '(') return `(${group(depth)})`;
            if (c === '\\') {
                const match = /^\\([a-zA-Z]+)/.exec(source.slice(pos));
                if (!match) throw new Error('Unsupported mathematical notation.');
                pos += match[0].length;
                let name = match[1];
                if (name === 'frac' || name === 'dfrac' || name === 'tfrac') return `((${group(depth)})/(${group(depth)}))`;
                if (name === 'sqrt') return `sqrt(${group(depth)})`;
                if (name === 'pi') return 'pi';
                if (name === 'cdot' || name === 'times') return '*';
                if (name === 'div') return '/';
                if (name === 'operatorname' || name === 'mathrm') {
                    skip();
                    const word = /^\{([a-z]+)\}/.exec(source.slice(pos));
                    if (!word) throw new Error('Unsupported function.');
                    pos += word[0].length;
                    name = word[1];
                    if (name === 'e' || name === 'i') return name;
                }
                name = names[name] ?? name;
                if (functions.includes(name)) return `${name}(${group(depth)})`;
                throw new Error(`Unsupported command: ${name}. Use Raw expression.`);
            }
            const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(pos));
            if (number) {pos += number[0].length; return number[0];}
            if (['e','i','π'].includes(c)) {pos++; return c === 'π' ? 'pi' : c;}
            if ('+-*/^'.includes(c) && c !== undefined) {pos++; return c;}
            throw new Error('Unsupported mathematical notation. Use Raw expression.');
        };
        const sequence = (end,depth) => {
            const parts = [];
            while (true) {
                skip();
                if (pos === source.length) {if (end) throw new Error('Close the expression.'); break;}
                if (source[pos] === end) {pos++; break;}
                parts.push(atom(depth));
            }
            return parts.join(' ');
        };
        const text = sequence(undefined,0);
        if (!allowComplex && /\bi\b/.test(text)) throw new Error('Angle must be real.');
        expressionTree(text);
        return {ok:true,text};
    } catch (error) {return {ok:false,error:error.message};}
}
