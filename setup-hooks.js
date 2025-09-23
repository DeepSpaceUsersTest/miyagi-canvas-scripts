#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Miyagi git hooks...');

// Define hook contents
const preCommitHook = `#!/bin/sh

# Miyagi Canvas Repository Pre-commit Hook
# This hook runs before each commit to:
# 1. Compile JSX widgets to HTML
# 2. Generate canvas-state.json from widget files

echo "🔨 Running Miyagi pre-commit hook..."

# Run compile.js to convert JSX to HTML
node download-and-run.js compile.js
if [ $? -ne 0 ]; then
  echo "❌ JSX compilation failed"
  exit 1
fi

# Run generate-canvas.js to create canvas-state.json
node download-and-run.js generate-canvas.js  
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
# This hook runs after each merge/pull to:
# 1. Unpack canvas-state.json files into widget directories

echo "📦 Running Miyagi post-merge hook..."

# Run unpack-canvas-state.js to extract widget files from canvas-state.json
node .miyagi/unpack-canvas-state.js
if [ $? -ne 0 ]; then
  echo "❌ Canvas state unpacking failed"
  exit 1
fi

echo "✅ Post-merge hook completed successfully"
exit 0`;

try {
  // Ensure .git/hooks directory exists
  const hooksDir = path.join('.git', 'hooks');
  if (!fs.existsSync(hooksDir)) {
    console.log('❌ .git/hooks directory not found. Make sure you are in a git repository.');
    process.exit(1);
  }

  // Download scripts if they don't exist
  console.log('📥 Ensuring Miyagi scripts are available...');
  if (fs.existsSync('download-and-run.js')) {
    console.log('🔄 Running download-and-run to ensure scripts are ready...');
    const { execSync } = require('child_process');
    
    // Use download-and-run to ensure all scripts are available
    execSync('node download-and-run.js compile.js', { stdio: 'inherit' });
    console.log('✅ Scripts are ready');
  } else {
    console.log('⚠️  download-and-run.js not found. Scripts will be downloaded on first hook run.');
  }

  // Write pre-commit hook
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  fs.writeFileSync(preCommitPath, preCommitHook);
  fs.chmodSync(preCommitPath, '755'); // Make executable
  console.log('✅ Created pre-commit hook');

  // Write post-merge hook
  const postMergePath = path.join(hooksDir, 'post-merge');
  fs.writeFileSync(postMergePath, postMergeHook);
  fs.chmodSync(postMergePath, '755'); // Make executable
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
