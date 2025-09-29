#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Setting up Miyagi git hooks...');

// Define hook contents
const preCommitHook = `#!/bin/sh

# Miyagi Canvas Repository Pre-commit Hook
echo "🔨 Running Miyagi pre-commit hook..."

# Ensure scripts are set up
if [ ! -d ".miyagi" ]; then
  echo "📥 Setting up Miyagi scripts..."
  node download-and-run.js compile.js >/dev/null 2>&1 || echo "⚠️ Script setup may be incomplete"
fi

# Run compile.js to convert JSX to HTML
node .miyagi/compile.js
if [ $? -ne 0 ]; then
  echo "❌ JSX compilation failed"
  exit 1
fi

# Run generate-canvas.js to create canvas-state.json
node .miyagi/generate-canvas.js  
if [ $? -ne 0 ]; then
  echo "❌ Canvas state generation failed"
  exit 1
fi

# Add generated files to the commit
git add .

echo "✅ Pre-commit hook completed successfully"
exit 0`;

const postMergeHook = `#!/bin/sh

# Miyagi Canvas Repository Post-merge Hook
echo "📦 Running Miyagi post-merge hook..."

# Run unpack-canvas-state.js to extract widget files from canvas-state.json
node .miyagi/unpack-canvas-state.js
if [ $? -ne 0 ]; then
  echo "❌ Canvas state unpacking failed"
  exit 1
fi

echo "✅ Post-merge hook completed successfully"
exit 0`;

async function setupHooks() {
  try {
    // Ensure .git/hooks directory exists
    const hooksDir = path.join('.git', 'hooks');
    if (!fs.existsSync(hooksDir)) {
      console.log('❌ .git/hooks directory not found. Make sure you are in a git repository.');
      process.exit(1);
    }

    // Set up scripts and dependencies
    if (fs.existsSync('download-and-run.js')) {
      console.log('📥 Setting up Miyagi scripts...');
      
      // Remove existing .miyagi to force fresh setup
      if (fs.existsSync('.miyagi')) {
        fs.rmSync('.miyagi', { recursive: true, force: true });
      }
      
      // Run setup
      execSync('node download-and-run.js compile.js', { 
        stdio: 'inherit'
      });
      
      // Run unpack to initialize canvas structure
      console.log('📦 Initializing canvas structure...');
      execSync('node download-and-run.js unpack-canvas-state.js', { 
        stdio: 'inherit'
      });
      
      console.log('✅ Setup completed!');
    } else {
      console.log('⚠️ download-and-run.js not found. Scripts will be downloaded on first hook run.');
    }

    // Create git hooks
    const preCommitPath = path.join(hooksDir, 'pre-commit');
    fs.writeFileSync(preCommitPath, preCommitHook);
    fs.chmodSync(preCommitPath, '755');
    console.log('✅ Created pre-commit hook');

    const postMergePath = path.join(hooksDir, 'post-merge');
    fs.writeFileSync(postMergePath, postMergeHook);
    fs.chmodSync(postMergePath, '755');
    console.log('✅ Created post-merge hook');

    console.log('🎉 Git hooks setup completed successfully!');
    console.log('');
    console.log('Hooks installed:');
    console.log('  • pre-commit: Compiles JSX and generates canvas-state.json');
    console.log('  • post-merge: Unpacks canvas-state.json into widget directories');
    console.log('');
    console.log('Your repository is now ready for automated canvas synchronization!');

  } catch (error) {
    console.error('❌ Failed to setup git hooks:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupHooks();