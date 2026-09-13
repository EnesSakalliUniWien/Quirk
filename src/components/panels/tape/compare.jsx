import { useMemo } from "react";
import { distributions } from "../../../results/take.js";
import { COLOURS } from "./colours.js";
import { Distribution } from "./distribution.jsx";

function Compare({takes}) {
    const distributionsByTake = useMemo(() => takes.map(distributions), [takes]);
    if (takes.length !== 2) return null;
    const [left, right] = distributionsByTake;
    const key = g => JSON.stringify([g.name, g.start, g.length]);
    const rightByKey = new Map(right.groups.map(g => [key(g), g]));
    const matched = new Set();
    return <section aria-label="Compare takes"><h3>Compare {takes[0].name} / {takes[1].name}</h3>
        {left.groups.map(a => {
            const b = rightByKey.get(key(a));
            if (!b) return <p key={key(a)}>Unmatched: {takes[0].name} / {a.name} (wires {a.start}–{a.start+a.length-1})</p>;
            matched.add(key(a));
            const differences = a.probabilities.flatMap((p, i) => !Number.isFinite(p) || !Number.isFinite(b.probabilities[i]) ?
                [`${i}: unavailable`] : Math.abs(p-b.probabilities[i]) > 1e-6 ? [`${i}: ${p.toPrecision(6)} → ${b.probabilities[i].toPrecision(6)}`] : []);
            return <div key={key(a)} className="tape-comparison"><h4>{a.name}</h4>
                <div className="tape-overlay">
                    <div style={{borderColor: COLOURS[takes[0].colour]}}><Distribution colour={COLOURS[takes[0].colour]} probabilities={a.probabilities} label={`${takes[0].name}: ${a.name}`} /></div>
                    <div style={{borderColor: COLOURS[takes[1].colour]}}><Distribution transparent colour={COLOURS[takes[1].colour]} probabilities={b.probabilities} label={`${takes[1].name}: ${b.name}`} /></div>
                </div>
                <p className="tape-differences">{differences.length ? differences.join("; ") : "No probability differences above 0.000001"}</p>
            </div>;
        })}
        {right.groups.filter(g => !matched.has(key(g))).map(g => <p key={key(g)}>Unmatched: {takes[1].name} / {g.name} (wires {g.start}–{g.start+g.length-1})</p>)}
    </section>;
}

export { Compare };
