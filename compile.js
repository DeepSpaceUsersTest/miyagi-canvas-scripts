const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

// Get the absolute path to the babel preset (relative to this script)
const babelPresetPath = path.join(__dirname, 'node_modules', '@babel', 'preset-react');

// Find widgets
const entries = fs.readdirSync('.', { withFileTypes: true });
const widgets = entries.filter(e => e.isDirectory() && e.name.startsWith('shape-'));

console.log(`Found ${widgets.length} widgets`);

// Compile each widget
widgets.forEach(widget => {
  const jsxFile = path.join(widget.name, 'template.jsx');
  const htmlFile = path.join(widget.name, 'template.html');
  
  if (fs.existsSync(jsxFile)) {
    console.log(`Compiling ${widget.name}...`);
    
    const jsx = fs.readFileSync(jsxFile, 'utf8');
    
    const result = babel.transformSync(jsx, {
      presets: [['@babel/preset-react', { runtime: 'classic' }]]
    });
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body>
  <div id="root"></div>
  <script>
    const { useState, useEffect } = React;
    ${result.code.replace(/export default/, 'const Widget =')}
    ReactDOM.render(React.createElement(Widget), document.getElementById('root'));
  </script>
</body>
</html>`;
    
    fs.writeFileSync(htmlFile, html);
    console.log(`✅ ${widget.name} compiled`);
  }
});

console.log('Done!');