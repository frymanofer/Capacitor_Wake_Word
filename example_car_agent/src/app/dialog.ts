// A small modal dialog (Alert.alert in the shared modules, confirmations in the app).
export function showDialog(title: string, message: string, buttons: string[]): Promise<number> {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';
        const box = document.createElement('div');
        box.className = 'dialog';
        const h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
        if (message) { const p = document.createElement('p'); p.textContent = message; box.appendChild(p); }
        const row = document.createElement('div'); row.className = 'dialog-buttons';
        buttons.forEach((label, i) => {
            const b = document.createElement('button');
            b.textContent = label;
            b.className = i === buttons.length - 1 ? 'primary' : 'secondary';
            b.onclick = () => { overlay.remove(); resolve(i); };
            row.appendChild(b);
        });
        box.appendChild(row);
        overlay.appendChild(box);
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(-1); } };
        document.body.appendChild(overlay);
    });
}
