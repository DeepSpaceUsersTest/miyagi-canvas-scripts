#!/usr/bin/env node

/**
 * Download and Run Script - Simple Version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SCRIPTS_DIR = '.miyagi';
const SCRIPTS_URL = 'https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main';

/**
 * Ensure Miyagi setup exists
 */
async function ensureSetup() {
  // Only run setup if .miyagi doesn't exist
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.log('🚀 Setting up Miyagi scripts...');
    
    try {
      // Create directory
      fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
      
      // Create package.json for dependencies
      const packageJson = {
        "name": "miyagi-repository-scripts",
        "version": "1.0.0",
        "description": "Miyagi canvas repository automation scripts",
        "private": true,
        "dependencies": {
          "@babel/core": "^7.28.4",
          "@babel/preset-react": "^7.27.1"
        }
      };
      
      fs.writeFileSync(
        path.join(SCRIPTS_DIR, 'package.json'), 
        JSON.stringify(packageJson, null, 2)
      );
      
      // Check if we're in container with pre-installed dependencies
      if (fs.existsSync('/app/node_modules/@babel/core')) {
        console.log('✅ Using pre-installed dependencies from container');
      } else {
        console.log('📦 Installing dependencies...');
        execSync('npm install', { 
          cwd: SCRIPTS_DIR, 
          stdio: 'inherit'
        });
        console.log('✅ Dependencies installed successfully');
      }
      
      // Download all required scripts
      const scripts = ['compile.js', 'generate-canvas.js', 'unpack-canvas-state.js', 'setup-hooks.js'];
      
      console.log('📥 Downloading scripts...');
      for (const script of scripts) {
        await downloadScript(script);
      }
      
      console.log('✅ Miyagi setup complete!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      if (fs.existsSync(SCRIPTS_DIR)) {
        fs.rmSync(SCRIPTS_DIR, { recursive: true, force: true });
      }
      throw error;
    }
  }
}

/**
 * Download a single script
 */
async function downloadScript(scriptName) {
  try {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    console.log(`  📄 Downloading ${scriptName}...`);
    
    const response = await fetch(`${SCRIPTS_URL}/${scriptName}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const content = await response.text();
    
    fs.writeFileSync(scriptPath, content);
    console.log(`  ✅ Downloaded ${scriptName}`);
    
  } catch (error) {
    console.error(`  ❌ Failed to download ${scriptName}:`, error.message);
    throw error;
  }
}

/**
 * Run script - dependencies should just work
 */
async function runScript(scriptName) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }
  
  console.log(`🔧 Running ${scriptName}...`);
  
  try {
    // Just run the script - dependencies should be found automatically
    delete require.cache[path.resolve(scriptPath)];
    require(path.resolve(scriptPath));
    
  } catch (error) {
    console.error(`❌ Script execution failed:`, error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const scriptName = process.argv[2];
    
    if (!scriptName) {
      console.error('❌ Usage: node download-and-run.js <script-name>');
      process.exit(1);
    }
    
    await ensureSetup();
    await runScript(scriptName);
    
    console.log(`✅ ${scriptName} completed successfully`);
    
  } catch (error) {
    console.error('❌ Download and run failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { ensureSetup, runScript };