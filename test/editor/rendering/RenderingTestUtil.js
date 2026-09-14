/** Read displayed text through Pixi's public scene API, independent of component nesting. */
function labelsIn(view) {
    const labels = [];
    const visit = node => {
        if (typeof node.text === 'string') labels.push(node);
        for (const child of node.children || []) visit(child);
    };
    visit(view);
    return labels;
}

export {labelsIn};
