#!/usr/bin/env node

/**
 * Standalone JSX Compilation Script
 * Fetched and executed remotely via GitHub Raw
 */

const fs = require('fs');
const path = require('path');

// Require Babel (should be installed by setup script)
let babel;
try {
  babel = require('@babel/core');
} catch (e) {
  console.error('❌ Babel not found. Please run the setup script first:');
  console.error('   curl -s https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/setup-repo.js | node');
  console.error('   Or manually install: npm install @babel/core @babel/preset-react');
  process.exit(1);
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
    console.log(`📖 Reading JSX file...`);
    const jsxContent = fs.readFileSync(jsxPath, 'utf-8');
    console.log(`📄 JSX content length: ${jsxContent.length} characters`);
    console.log(`📄 First 100 chars: ${jsxContent.substring(0, 100)}...`);
    
    // Compile to HTML
    console.log(`🔧 Starting Babel compilation...`);
    const htmlContent = await compileJSXToHTML(jsxContent);
    console.log(`📄 Compiled HTML length: ${htmlContent.length} characters`);
    
    // Write the compiled HTML
    console.log(`💾 Writing compiled HTML to: ${outputPath}`);
    fs.writeFileSync(outputPath, htmlContent);
    console.log(`✅ Successfully compiled: ${jsxPath} → ${outputPath}`);
    
  } catch (error) {
    console.error(`💥 COMPILATION FAILED for ${jsxPath}:`);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw error; // Re-throw so main script can catch it
  }
}

// Auto-execute if this script is run directly
if (require.main === module) {
  console.log('🚀 STARTING JSX COMPILATION SCRIPT');
  console.log('📂 Working directory:', process.cwd());
  
  try {
    // Scan for all shape-*/template.jsx files
    const currentDir = process.cwd();
    console.log('📁 Scanning directory:', currentDir);
    
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    console.log('📋 All entries:', entries.map(e => `${e.name} (${e.isDirectory() ? 'dir' : 'file'})`).join(', '));
    
    const shapeDirectories = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('shape-'))
      .map(entry => entry.name);
    
    console.log(`🔍 Found ${shapeDirectories.length} widget directories: ${shapeDirectories.join(', ')}`);
    
    if (shapeDirectories.length === 0) {
      console.log('⚠️ NO WIDGET DIRECTORIES FOUND! Looking for directories that start with "shape-"');
      console.log('📁 Available directories:', entries.filter(e => e.isDirectory()).map(e => e.name).join(', '));
      process.exit(0);
    }
    
    let compiledCount = 0;
    
    // Compile each widget's JSX
    for (const shapeDir of shapeDirectories) {
      const jsxPath = path.join(currentDir, shapeDir, 'template.jsx');
      console.log(`🔄 Checking for JSX file: ${jsxPath}`);
      
      if (fs.existsSync(jsxPath)) {
        console.log(`✅ JSX file exists, compiling...`);
        const outputPath = jsxPath.replace('.jsx', '.html');
        await compileJSXTemplate(jsxPath, outputPath);
        compiledCount++;
      } else {
        console.log(`❌ JSX file NOT FOUND: ${jsxPath}`);
        console.log(`📁 Contents of ${shapeDir}:`, fs.readdirSync(path.join(currentDir, shapeDir)));
      }
    }
    
    console.log(`🎉 JSX compilation complete! Compiled ${compiledCount} files.`);
    
    if (compiledCount === 0) {
      console.log('⚠️ WARNING: No files were compiled!');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 FATAL ERROR in main execution:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}
