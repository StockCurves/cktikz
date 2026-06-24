const fs = require('fs');
const text = fs.readFileSync('src/data/symbols.svg', 'utf8');

const components = text.match(/<component[^>]*>/g) || [];
for (const c of components) {
    if (c.includes('pmos') || c.includes('american current source') || c.includes('tikz="I"')) {
        console.log(c);
    }
}
