#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Hook Tester Script
 * 
 * Tests git hooks locally without needing to create new repositories
 * Usage: node test-hooks.js [repository-path]
 */

class HookTester {
  constructor(repoPath) {
    this.repoPath = repoPath || process.cwd();
    this.hooksDir = path.join(this.repoPath, '.git', 'hooks');
    this.scriptsDir = __dirname; // miyagi-canvas-scripts directory
    
    console.log(`🧪 Testing hooks for repository: ${this.repoPath}`);
    console.log(`📁 Scripts directory: ${this.scriptsDir}`);
  }

  /**
   * Main test runner
   */
  async run() {
    try {
      console.log('\n🚀 Starting hook testing...\n');

      // Step 1: Test individual scripts
      await this.testIndividualScripts();

      // Step 2: Install hooks
      await this.installHooks();

      // Step 3: Test hook execution
      await this.testHooks();

      console.log('\n✅ All tests completed successfully!');
    } catch (error) {
      console.error('\n❌ Hook testing failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Test each script individually
   */
  async testIndividualScripts() {
    console.log('📋 Step 1: Testing individual scripts...\n');

    // Test unpack-canvas-state.js
    await this.testScript('unpack-canvas-state.js', 'Unpack Canvas State');

    // Test compile.js
    await this.testScript('compile.js', 'Compile JSX');

    // Test generate-canvas.js  
    await this.testScript('generate-canvas.js', 'Generate Canvas');

    console.log('✅ All individual scripts tested\n');
  }

  /**
   * Test a single script
   */
  async testScript(scriptName, description) {
    console.log(`  🧪 Testing ${description} (${scriptName})...`);
    
    const scriptPath = path.join(this.scriptsDir, scriptName);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }

    try {
      // Change to repository directory for script execution
      process.chdir(this.repoPath);
      
      // Run the script
      const output = execSync(`node "${scriptPath}"`, { 
        encoding: 'utf8',
        cwd: this.repoPath
      });
      
      console.log(`    ✅ ${description} completed successfully`);
      if (output.trim()) {
        console.log(`    📄 Output: ${output.trim().split('\n')[0]}...`);
      }
    } catch (error) {
      console.log(`    ❌ ${description} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Install hooks in the repository
   */
  async installHooks() {
    console.log('📋 Step 2: Installing git hooks...\n');

    // Ensure hooks directory exists
    if (!fs.existsSync(this.hooksDir)) {
      fs.mkdirSync(this.hooksDir, { recursive: true });
    }

    // Install post-merge hook (runs after git pull)
    await this.installHook('post-merge', this.createPostMergeHook());

    // Install pre-commit hook (runs before git commit)
    await this.installHook('pre-commit', this.createPreCommitHook());

    console.log('✅ All hooks installed\n');
  }

  /**
   * Install a single hook
   */
  async installHook(hookName, hookContent) {
    const hookPath = path.join(this.hooksDir, hookName);
    
    console.log(`  🪝 Installing ${hookName} hook...`);
    
    // Write hook file
    fs.writeFileSync(hookPath, hookContent);
    
    // Make executable
    fs.chmodSync(hookPath, '755');
    
    console.log(`    ✅ ${hookName} hook installed`);
  }

  /**
   * Create post-merge hook content
   */
  createPostMergeHook() {
    return `#!/bin/bash

# Post-merge hook - runs after git pull
echo "🪝 Running post-merge hook..."

# Check if canvas-state.json files were updated
if git diff-tree -r --name-only --no-commit-id HEAD@{1} HEAD | grep -q "canvas-state.json"; then
  echo "📄 Canvas state files updated, running unpack script..."
  
  # Download and run unpack script
  if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
  fi
  
  # Try to download the script if not present locally
  if [ ! -f "unpack-canvas-state.js" ]; then
    echo "📥 Downloading unpack-canvas-state.js..."
    curl -s -o unpack-canvas-state.js "https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/unpack-canvas-state.js"
  fi
  
  # Run the unpack script
  if [ -f "unpack-canvas-state.js" ]; then
    node unpack-canvas-state.js
    echo "✅ Canvas state unpacked successfully"
  else
    echo "❌ unpack-canvas-state.js not found"
    exit 1
  fi
else
  echo "📄 No canvas state changes detected"
fi

echo "✅ Post-merge hook completed"
`;
  }

  /**
   * Create pre-commit hook content
   */
  createPreCommitHook() {
    return `#!/bin/bash

# Pre-commit hook - runs before git commit
echo "🪝 Running pre-commit hook..."

# Check if we have JSX files to compile
if find . -name "template.jsx" -type f | grep -q .; then
  echo "🔧 Compiling JSX files..."
  
  # Download and run compile script if needed
  if [ ! -f "compile.js" ]; then
    echo "📥 Downloading compile.js..."
    curl -s -o compile.js "https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/compile.js"
  fi
  
  if [ -f "compile.js" ]; then
    node compile.js
    echo "✅ JSX compilation completed"
  else
    echo "❌ compile.js not found"
    exit 1
  fi
fi

# Run generate-canvas script
echo "🎨 Generating canvas files..."

if [ ! -f "generate-canvas.js" ]; then
  echo "📥 Downloading generate-canvas.js..."
  curl -s -o generate-canvas.js "https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main/generate-canvas.js"
fi

if [ -f "generate-canvas.js" ]; then
  node generate-canvas.js
  echo "✅ Canvas generation completed"
else
  echo "❌ generate-canvas.js not found"
  exit 1
fi

# Add any newly generated files to the commit
git add .

echo "✅ Pre-commit hook completed"
`;
  }

  /**
   * Test hook execution
   */
  async testHooks() {
    console.log('📋 Step 3: Testing hook execution...\n');

    // Test post-merge hook
    await this.testHookExecution('post-merge', 'Post-merge Hook');

    // Test pre-commit hook  
    await this.testHookExecution('pre-commit', 'Pre-commit Hook');

    console.log('✅ All hooks tested\n');
  }

  /**
   * Test a single hook execution
   */
  async testHookExecution(hookName, description) {
    console.log(`  🧪 Testing ${description}...`);
    
    const hookPath = path.join(this.hooksDir, hookName);
    if (!fs.existsSync(hookPath)) {
      throw new Error(`Hook not found: ${hookPath}`);
    }

    try {
      // Run the hook
      const output = execSync(`bash "${hookPath}"`, { 
        encoding: 'utf8',
        cwd: this.repoPath
      });
      
      console.log(`    ✅ ${description} executed successfully`);
      if (output.trim()) {
        const lines = output.trim().split('\n');
        console.log(`    📄 Output: ${lines[0]}...`);
        if (lines.length > 1) {
          console.log(`    📄 (${lines.length - 1} more lines)`);
        }
      }
    } catch (error) {
      console.log(`    ❌ ${description} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean up test artifacts
   */
  async cleanup() {
    console.log('🧹 Cleaning up test artifacts...');
    
    // Remove downloaded scripts (keep only the ones we want)
    const tempScripts = ['unpack-canvas-state.js', 'compile.js', 'generate-canvas.js'];
    for (const script of tempScripts) {
      const scriptPath = path.join(this.repoPath, script);
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
        console.log(`  🗑️  Removed ${script}`);
      }
    }
  }

  /**
   * Reset hooks (remove all installed hooks)
   */
  async resetHooks() {
    console.log('🔄 Resetting hooks...');
    
    const hooks = ['post-merge', 'pre-commit'];
    for (const hook of hooks) {
      const hookPath = path.join(this.hooksDir, hook);
      if (fs.existsSync(hookPath)) {
        fs.unlinkSync(hookPath);
        console.log(`  🗑️  Removed ${hook} hook`);
      }
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const repoPath = args[1];

  const tester = new HookTester(repoPath);

  switch (command) {
    case 'test':
      tester.run();
      break;
    case 'install':
      tester.installHooks();
      break;
    case 'reset':
      tester.resetHooks();
      break;
    case 'cleanup':
      tester.cleanup();
      break;
    default:
      console.log('Usage: node test-hooks.js [test|install|reset|cleanup] [repository-path]');
      console.log('');
      console.log('Commands:');
      console.log('  test    - Run full hook testing suite');
      console.log('  install - Install hooks only');  
      console.log('  reset   - Remove all hooks');
      console.log('  cleanup - Remove temporary files');
      process.exit(1);
  }
}

module.exports = HookTester;
