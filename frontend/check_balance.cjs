const fs = require('fs');
const path = require('path');

function check(fp) {
  const code = fs.readFileSync(fp, 'utf8');
  const o = (code.match(/<Box[\s>]/g) || []).length;
  const c = (code.match(/<\/Box>/g) || []).length;
  if (o !== c) console.log(path.relative('.', fp) + ' opens=' + o + ' closes=' + c);
}

function walk(dir) {
  fs.readdirSync(dir, {withFileTypes:true}).forEach(function(f) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) walk(full);
    else if (f.name.endsWith('.jsx')) check(full);
  });
}

walk('src/pages');
console.log('DONE');
