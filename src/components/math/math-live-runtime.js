import {MathfieldElement} from 'mathlive';
import 'mathlive/fonts.css';

// Vite emits the bundled font files. Quirk remains the only formula evaluator.
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;
MathfieldElement.computeEngine = null;
export {MathfieldElement};
