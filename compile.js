const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

// Get the absolute path to the babel preset (relative to this script)
const babelPresetPath = path.join(__dirname, 'node_modules', '@babel', 'preset-react');

// Recursively find all widget-* directories
function findShapeDirectories(dir = '.', found = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules, .git, and other common ignore patterns
        if (entry.name === 'node_modules' || entry.name === '.git' || 
            entry.name === 'dist' || entry.name === 'build' || 
            entry.name === '.next' || entry.name.startsWith('.')) {
          continue;
        }
        
        // If this is a widget- directory, add it
        if (entry.name.startsWith('widget-')) {
          found.push({ name: entry.name, path: fullPath });
        } else {
          // Recursively search subdirectories
          findShapeDirectories(fullPath, found);
        }
      }
    }
  } catch (error) {
    // Silently skip directories we can't read (permissions, etc.)
  }
  
  return found;
}

const widgets = findShapeDirectories();
console.log(`Found ${widgets.length} widgets across all directories`);

// Compile each widget
widgets.forEach(widget => {
  const jsxFile = path.join(widget.path, 'template.jsx');
  const htmlFile = path.join(widget.path, 'template.html');
  
  if (fs.existsSync(jsxFile)) {
    console.log(`Compiling ${widget.name} at ${widget.path}...`);
    
    const jsx = fs.readFileSync(jsxFile, 'utf8');
    
    const result = babel.transformSync(jsx, {
      presets: [[babelPresetPath, { runtime: 'classic' }]] // Use absolute path
    });
    
    // Remove import statements and convert export default to const WidgetComponent
    let compiledJS = result.code
      .replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '') // Remove imports
      .replace(/export\s+default\s+(\w+);?\s*$/, 'const WidgetComponent = $1;'); // Convert export to const
    
    // Add dynamic React hooks extraction and custom hooks at the top
    compiledJS = `
    // Extract all React hooks dynamically (present and future)
    const reactHooks = {};
    Object.keys(React).forEach(key => {
      if (key.startsWith('use') && typeof React[key] === 'function') {
        reactHooks[key] = React[key];
      }
    });
    
    // Destructure all available hooks for easy use
    const {
      useState, useEffect, useRef, useMemo, useCallback, useContext, 
      useReducer, useLayoutEffect, useImperativeHandle, useDebugValue,
      useDeferredValue, useId, useInsertionEffect, useSyncExternalStore,
      useTransition, ...otherHooks
    } = { ...reactHooks, ...React };
    
    // Custom hooks for Miyagi widgets
    // useStorage hook will be injected by MiyagiStorageService
    // useGlobalStorage hook will be injected by MiyagiStorageService
    
    ${compiledJS}
    `;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>React Widget</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <style>
    body { 
      margin: 0; 
      padding: 0; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #react-root { 
      width: 100%; 
      height: 100vh; 
      display: flex;
      flex-direction: column;
    }
  </style>
</head>
<body>
  <div id="react-root"></div>
  
  <script>
    // Compiled JSX code
    ${compiledJS}
    
    // Auto-render when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
      const root = ReactDOM.createRoot(document.getElementById('react-root'));
      root.render(React.createElement(WidgetComponent));
    });
  </script>
</body>
</html>`;
    
    fs.writeFileSync(htmlFile, html);
    console.log(`✅ ${widget.name} compiled`);
  }
});

console.log('Done!');