#!/usr/bin/env node

/**
 * Download and Run Script - MVP Version
 * 
 * This script handles downloading dependencies and scripts for Miyagi canvas repositories.
 * It's designed to be copied into user repositories and run as part of git hooks.
 * 
 * Usage: node download-and-run.js <script-name>
 * Example: node download-and-run.js compile.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SCRIPTS_DIR = '.miyagi';
const SCRIPTS_URL = 'https://raw.githubusercontent.com/DeepSpaceUsersTest/miyagi-canvas-scripts/main';

/**
 * Ensure Miyagi setup exists (one-time setup per repository)
 */
async function ensureSetup() {
  // Only run setup if .miyagi doesn't exist
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.log('🚀 Setting up Miyagi scripts (one-time setup)...');
    
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
      
      console.log('📦 Setting up dependencies...');
      
      // Try container dependencies first, fallback to local install
      let dependenciesAvailable = false;
      try {
        // Try container path
        process.env.NODE_PATH = '/app/node_modules';
        require('module')._initPaths();
        require('@babel/core');
        console.log('✅ Using pre-installed dependencies from container');
        dependenciesAvailable = true;
      } catch (error) {
        console.log('⚠️ Container dependencies not found, installing locally...');
        // Reset NODE_PATH and install locally
        delete process.env.NODE_PATH;
        require('module')._initPaths();
        
        console.log('📦 Installing dependencies via npm...');
        execSync('npm install --no-optional --prefer-offline', { 
          cwd: SCRIPTS_DIR, 
          stdio: 'inherit',
          timeout: 60000 // 60 second timeout
        });
      }
      
      // Download all required scripts
      const scripts = [
        'compile.js', 
        'generate-canvas.js', 
        'unpack-canvas-state.js',
        'setup-hooks.js'
      ];
      
      console.log('📥 Downloading scripts in parallel...');
      // Download all scripts simultaneously for speed
      const downloadPromises = scripts.map(script => downloadScript(script));
      await Promise.all(downloadPromises);
      
      console.log('✅ Miyagi setup complete!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error.message);
      
      // Clean up on failure
      if (fs.existsSync(SCRIPTS_DIR)) {
        fs.rmSync(SCRIPTS_DIR, { recursive: true, force: true });
      }
      
      throw error;
    }
  }
}

/**
 * Download a single script from the remote repository
 */
async function downloadScript(scriptName) {
  try {
    const scriptPath = path.join(SCRIPTS_DIR, scriptName);
    
    console.log(`  📄 Downloading ${scriptName}...`);
    
    // Use raw GitHub URLs (works with public repos)
    let content;
    if (typeof fetch !== 'undefined') {
      const response = await fetch(`${SCRIPTS_URL}/${scriptName}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      content = await response.text();
    } else {
      // Fallback for older Node versions
      const https = require('https');
      const url = require('url');
      
      content = await new Promise((resolve, reject) => {
        const parsedUrl = url.parse(`${SCRIPTS_URL}/${scriptName}`);
        const request = https.get(parsedUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }
          
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => resolve(data));
        });
        
        request.on('error', reject);
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Request timeout'));
        });
      });
    }
    
    fs.writeFileSync(scriptPath, content);
    console.log(`  ✅ Downloaded ${scriptName}`);
    
  } catch (error) {
    console.error(`  ❌ Failed to download ${scriptName}:`, error.message);
    throw error;
  }
}

/**
 * Run the requested script with proper environment setup
 */
async function runScript(scriptName) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Script not found: ${scriptPath}`);
  }
  
  console.log(`🔧 Running ${scriptName}...`);
  
  // Set NODE_PATH to find dependencies
  const originalNodePath = process.env.NODE_PATH;
  let needsNodePath = false;
  
  // Try container path first, fallback to local
  try {
    process.env.NODE_PATH = '/app/node_modules' + (originalNodePath ? `:${originalNodePath}` : '');
    require('module')._initPaths();
    require('@babel/core');
    needsNodePath = true;
  } catch (error) {
    // Fallback to local .miyagi/node_modules
    const miyagiNodeModules = path.resolve(SCRIPTS_DIR, 'node_modules');
    process.env.NODE_PATH = miyagiNodeModules + (originalNodePath ? `:${originalNodePath}` : '');
    require('module')._initPaths();
    needsNodePath = true;
  }
  
  try {
    // Change to script directory for execution
    const originalCwd = process.cwd();
    
    // Run the script
    delete require.cache[path.resolve(scriptPath)]; // Clear cache
    require(path.resolve(scriptPath));
    
  } catch (error) {
    console.error(`❌ Script execution failed:`, error.message);
    throw error;
  } finally {
    // Restore original NODE_PATH only if we modified it
    if (needsNodePath) {
      if (originalNodePath) {
        process.env.NODE_PATH = originalNodePath;
      } else {
        delete process.env.NODE_PATH;
      }
      require('module')._initPaths();
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Parse command line arguments
    const scriptName = process.argv[2];
    
    if (!scriptName) {
      console.error('❌ Usage: node download-and-run.js <script-name>');
      console.error('   Example: node download-and-run.js compile.js');
      process.exit(1);
    }
    
    // Ensure setup exists
    await ensureSetup();
    
    // Run the requested script
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
