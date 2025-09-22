#!/usr/bin/env node

/**
 * Standalone JSX Compilation Script
 * Fetched and executed remotely via GitHub Raw
 */

const fs = require('fs');
const path = require('path');

// Basic JSX to HTML compilation
async function compileJSXToHTML(jsxContent) {
  try {
    // For now, create a simple HTML wrapper
    // TODO: Add proper Babel compilation
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>React Widget</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <style>
    body { 
      margin: 0; 
      padding: 20px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    #react-root { 
      width: 100%; 
      height: 100vh; 
    }
  </style>
</head>
<body>
  <div id="react-root"></div>
  
  <script>
    // JSX content (needs proper compilation)
    // ${jsxContent}
    
    // For now, render a placeholder
    const root = ReactDOM.createRoot(document.getElementById('react-root'));
    root.render(React.createElement('div', {}, 
      React.createElement('h1', {}, 'Widget Placeholder'),
      React.createElement('p', {}, 'JSX compilation will be added here')
    ));
  </script>
</body>
</html>`;
    
    return htmlContent;
    
  } catch (error) {
    console.error('❌ JSX compilation failed:', error);
    throw error;
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
