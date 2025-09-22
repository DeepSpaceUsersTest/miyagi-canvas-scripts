#!/usr/bin/env node

/**
 * Repository Setup Script for Miyagi Canvas Sync
 * Run this once after creating a new canvas repository
 * 
 * Usage: node setup-repo.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Setting up Miyagi Canvas Sync repository...');
console.log('=' .repeat(50));

async function setupRepository() {
  try {
    // 1. Install required dependencies
    console.log('📦 Installing dependencies...');
    
    // Check if package.json exists, create minimal one if not
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log('📄 Creating package.json...');
      const packageJson = {
        "name": path.basename(process.cwd()),
        "version": "1.0.0",
        "description": "Miyagi Canvas Repository",
        "scripts": {
          "compile": "node -e \"require('child_process').execSync('curl -H \\\"Authorization: token \\$GITHUB_TOKEN\\\" https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/compile-jsx.js | node', {stdio: 'inherit'})\"",
          "generate-canvas": "node -e \"require('child_process').execSync('curl -H \\\"Authorization: token \\$GITHUB_TOKEN\\\" https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/generate-canvas.js | node', {stdio: 'inherit'})\""
        },
        "dependencies": {},
        "devDependencies": {}
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log('✅ Created package.json');
    }
    
    // Install Babel dependencies
    console.log('🔧 Installing Babel for JSX compilation...');
    execSync('npm install @babel/core @babel/preset-react', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Babel installed successfully');
    
    // 2. Create Git hooks
    console.log('🔗 Setting up Git hooks...');
    
    const hooksDir = path.join(process.cwd(), '.git', 'hooks');
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    
    // Ensure hooks directory exists
    if (!fs.existsSync(hooksDir)) {
      console.log('❌ .git/hooks directory not found. Make sure this is a Git repository.');
      process.exit(1);
    }
    
    // Create pre-commit hook
    const preCommitHook = `#!/bin/bash

# Miyagi Canvas Sync - Pre-commit Hook
# Fetches and executes remote scripts from GitHub Raw

echo "🔄 Running Miyagi Canvas Sync..."

# Get GitHub token from environment or Doppler
if [ -z "$GITHUB_TOKEN" ]; then
  # Try to get token from Miyagi project if available
  if [ -d "/Users/mariusbocanu/Desktop/Miyagi" ]; then
    cd /Users/mariusbocanu/Desktop/Miyagi
    GITHUB_TOKEN=$(doppler run --command="echo \\$GITHUB_TOKEN" 2>/dev/null | head -1)
    cd - > /dev/null
  fi
fi

if [ -z "$GITHUB_TOKEN" ]; then
  echo "❌ GitHub token not available - cannot fetch private scripts"
  echo "Set GITHUB_TOKEN environment variable or run from Miyagi project directory"
  exit 1
fi

# Compile JSX templates to HTML
echo "📝 Compiling JSX templates..."
curl -H "Authorization: token $GITHUB_TOKEN" -s https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/compile-jsx.js | node

if [ $? -ne 0 ]; then
  echo "❌ JSX compilation failed"
  exit 1
fi

# Generate canvas state JSON
echo "🎨 Generating canvas state..."
curl -H "Authorization: token $GITHUB_TOKEN" -s https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/generate-canvas.js | node

if [ $? -ne 0 ]; then
  echo "❌ Canvas state generation failed"
  exit 1
fi

# Add generated files to the commit
echo "📦 Adding generated files to commit..."
git add canvas-state.json shape-*/template.html 2>/dev/null || true

echo "✅ Miyagi Canvas Sync complete!"
`;
    
    fs.writeFileSync(preCommitPath, preCommitHook);
    
    // Make it executable
    try {
      fs.chmodSync(preCommitPath, 0o755);
      console.log('✅ Created executable pre-commit hook');
    } catch (error) {
      console.log('✅ Created pre-commit hook (you may need to run: chmod +x .git/hooks/pre-commit)');
    }
    
    // 3. Create a basic README if it doesn't exist
    const readmePath = path.join(process.cwd(), 'README.md');
    if (!fs.existsSync(readmePath)) {
      console.log('📄 Creating README.md...');
      const readme = `# Miyagi Canvas Repository

This repository contains widgets that sync with your Miyagi canvas.

## Structure

\`\`\`
your-repo/
├── shape-widget-name/
│   ├── properties.json    # Widget configuration
│   ├── template.jsx       # React component
│   └── template.html      # Compiled HTML (auto-generated)
├── canvas-state.json      # Complete canvas state (auto-generated)
└── .git/hooks/
    └── pre-commit         # Auto-compilation hook
\`\`\`

## How It Works

1. **Create/Edit Widgets**: Add or modify \`shape-*\` directories
2. **Commit Changes**: Git hooks automatically:
   - Compile JSX to HTML using Babel
   - Generate \`canvas-state.json\`
   - Include generated files in commit
3. **Push Changes**: Webhook syncs with canvas automatically

## Widget Structure

### properties.json
\`\`\`json
{
  "id": "my-widget",
  "name": "My Widget",
  "x": 100,
  "y": 100,
  "w": 300,
  "h": 200,
  "color": "blue"
}
\`\`\`

### template.jsx
\`\`\`jsx
import React, { useState } from 'react';

function MyWidget() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Click me!
      </button>
    </div>
  );
}

export default MyWidget;
\`\`\`

## Manual Commands

\`\`\`bash
# Compile JSX templates manually
npm run compile

# Generate canvas state manually  
npm run generate-canvas

# Install/update dependencies
npm install
\`\`\`

---

🚀 **Powered by Miyagi Canvas Sync**
`;
      fs.writeFileSync(readmePath, readme);
      console.log('✅ Created README.md');
    }
    
    // 4. Test the setup
    console.log('🧪 Testing setup...');
    
    // Check if we can find any widgets
    const entries = fs.readdirSync(process.cwd(), { withFileTypes: true });
    const shapeDirectories = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('shape-'))
      .map(entry => entry.name);
    
    if (shapeDirectories.length > 0) {
      console.log(`✅ Found ${shapeDirectories.length} widget directories: ${shapeDirectories.join(', ')}`);
      
      // Test compilation
      console.log('🔄 Testing JSX compilation...');
      try {
        execSync('npm run compile', { stdio: 'inherit' });
        console.log('✅ JSX compilation test successful');
      } catch (error) {
        console.log('⚠️ JSX compilation test failed - you may need to set GITHUB_TOKEN');
      }
    } else {
      console.log('ℹ️ No widgets found yet - create shape-* directories to get started');
    }
    
    console.log('\n🎉 Repository setup complete!');
    console.log('\n📋 Next steps:');
    console.log('1. Create widget directories (shape-my-widget/)');
    console.log('2. Add properties.json and template.jsx files');
    console.log('3. Commit changes - hooks will auto-compile and generate canvas state');
    console.log('4. Push to trigger canvas sync');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
setupRepository();
