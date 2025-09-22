#!/usr/bin/env node

/**
 * Standalone JSX Compilation Script
 * Fetched and executed remotely via GitHub Raw
 */

const fs = require('fs');
const path = require('path');

// Ensure Babel is available - install if needed
let babel;
try {
  babel = require('@babel/core');
} catch (e) {
  console.log('📦 Babel not found - installing @babel/core and @babel/preset-react...');
  
  // Install Babel dependencies
  const { execSync } = require('child_process');
  try {
    execSync('npm install @babel/core @babel/preset-react', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    // Try to require again after installation
    babel = require('@babel/core');
    console.log('✅ Babel installed successfully');
  } catch (installError) {
    console.error('❌ Failed to install Babel:', installError.message);
    console.error('Please run: npm install @babel/core @babel/preset-react');
    process.exit(1);
  }
}

// Babel configuration for JSX compilation
const babelConfig = {
  presets: [
    ['@babel/preset-react', {
      runtime: 'classic' // Use React.createElement instead of automatic JSX transform
    }]
  ],
  plugins: []
};

// JSX to HTML compilation with Babel (required)
async function compileJSXToHTML(jsxContent) {
  try {
    console.log('🔄 Compiling JSX content with Babel...');
    
    // Transform JSX to JavaScript using Babel
    const result = babel.transform(jsxContent, {
      ...babelConfig,
      filename: 'widget.jsx'
    });
    
    if (!result || !result.code) {
      throw new Error('Babel transformation failed');
    }
    
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
    
    // Create the HTML wrapper with compiled JavaScript
    const htmlContent = `<!DOCTYPE html>
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
    
    console.log('✅ JSX compilation successful');
    return htmlContent;
    
  } catch (error) {
    console.error('❌ JSX compilation failed:', error);
    console.error('📄 Failed JSX content:');
    console.error('--- JSX START ---');
    console.error(jsxContent);
    console.error('--- JSX END ---');
    throw new Error(`JSX compilation failed: ${error.message}`);
  }
}


async function compileJSXTemplate(jsxPath, outputPath) {
  try {
    console.log(`🔄 Compiling JSX: ${jsxPath}`);
    
    // Read the JSX file
    const jsxContent = fs.readFileSync(jsxPath, 'utf-8');
    
    // Compile to HTML
    const htmlContent = await compileJSXToHTML(jsxContent);
    
    // Write the compiled HTML
    fs.writeFileSync(outputPath, htmlContent);
    console.log(`✅ Compiled successfully: ${outputPath}`);
    
  } catch (error) {
    console.error(`❌ Compilation failed for ${jsxPath}:`, error);
  }
}

// Auto-execute if this script is run directly
if (require.main === module) {
  // Scan for all shape-*/template.jsx files
  const currentDir = process.cwd();
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  
  const shapeDirectories = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('shape-'))
    .map(entry => entry.name);
  
  console.log(`🔍 Found ${shapeDirectories.length} widget directories: ${shapeDirectories.join(', ')}`);
  
  // Compile each widget's JSX
  for (const shapeDir of shapeDirectories) {
    const jsxPath = path.join(currentDir, shapeDir, 'template.jsx');
    if (fs.existsSync(jsxPath)) {
      const outputPath = jsxPath.replace('.jsx', '.html');
      compileJSXTemplate(jsxPath, outputPath);
    }
  }
  
  console.log('🎉 JSX compilation complete!');
}
