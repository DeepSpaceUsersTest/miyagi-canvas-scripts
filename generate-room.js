#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

function generateTldrawId(prefix, length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}:${result}`;
}

function generateCanvasName() {
  const prefixes = ['Canvas', 'Workspace', 'Board', 'Space', 'Room', 'Area', 'Zone'];
  const suffixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Prime', 'Nova', 'Core', 'Hub', 'Lab', 'Studio'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${prefix}-${suffix}`;
}

function generateRandomPosition() {
  return {
    x: Math.random() * 1000 + 100, // Between 100 and 1100
    y: Math.random() * 800 + 100   // Between 100 and 900
  };
}

/**
 * Read parent canvas metadata to get parent page ID and room ID
 * @param {string} parentRoomPath - The absolute path to the parent room directory
 * @returns {object} Object containing parentPageId and parentRoomId
 */
function getParentInfo(parentRoomPath) {
  try {
    const metadataPath = path.join(parentRoomPath, 'canvas-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      return {
        parentPageId: metadata.pages && metadata.pages.length > 0 ? metadata.pages[0].id : 'page:page',
        parentRoomId: metadata.canvas.roomId
      };
    }
  } catch (error) {
    console.error('Error reading parent canvas metadata:', error);
    process.exit(1);
  }
  
  console.error('Could not find parent canvas metadata');
  process.exit(1);
}

/**
 * Force add canvas-state.json file to git (ignoring .gitignore rules)
 * @param {string} canvasStateFilePath - The absolute path to the canvas-state.json file
 */
function forceAddCanvasStateToGit(canvasStateFilePath) {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', { 
      cwd: path.dirname(canvasStateFilePath),
      encoding: 'utf8' 
    }).trim();
    
    const relativePath = path.relative(gitRoot, canvasStateFilePath);
    
    console.log(`📝 Force-adding canvas-state.json to git: ${relativePath}`);
    
    execSync(`git add -f "${relativePath}"`, { 
      cwd: gitRoot,
      stdio: 'inherit' 
    });
    
    console.log(`✅ Successfully added ${relativePath} to git`);
    
  } catch (error) {
    console.warn(`⚠️ Warning: Could not add canvas-state.json to git: ${error.message}`);
    console.warn(`   You may need to manually run: git add -f "${canvasStateFilePath}"`);
  }
}

/**
 * Generate child room directory and files
 * @param {string} parentRoomPath - The absolute path to the parent room directory
 */
function generateChildRoom(parentRoomPath) {
  if (!parentRoomPath) {
    console.error('Error: parentRoomPath is required');
    console.log('Usage: node generate-room.js <parentRoomPath>');
    console.log('Arguments:');
    console.log('  parentRoomPath - The absolute path to the parent room directory');
    console.log('Example: node generate-room.js /Users/user/tmp/room-d586cf39-57f1-4f37-ade2-90926cd586ae/room-1a7b548b-0c59-4a58-9753-e824eb99a2c9');
    process.exit(1);
  }

  if (!fs.existsSync(parentRoomPath)) {
    console.error(`Error: Parent room directory does not exist: ${parentRoomPath}`);
    process.exit(1);
  }

  const { parentPageId, parentRoomId } = getParentInfo(parentRoomPath);

  const childRoomId = `room-${crypto.randomUUID()}`;
  const canvasName = generateCanvasName();
  const pageId = generateTldrawId('page', 17);
  const linkShapeId = generateTldrawId('shape', 16);

  console.log(`Creating child room: ${childRoomId}`);
  console.log(`Parent Room Path: ${parentRoomPath}`);
  console.log(`Parent Room ID: ${parentRoomId}`);
  console.log(`Parent Page ID: ${parentPageId}`);

  const childRoomPath = path.join(parentRoomPath, childRoomId);
  if (!fs.existsSync(childRoomPath)) {
    fs.mkdirSync(childRoomPath, { recursive: true });
  } else {
    console.warn(`Directory ${childRoomId} already exists, files will be overwritten`);
  }

  // 1. Create global-storage.json (empty dict)
  const globalStorage = {};
  fs.writeFileSync(path.join(childRoomPath, 'global-storage.json'), JSON.stringify(globalStorage, null, 2));

  // 2. Create empty canvas-state.json, we only need this file to exist so we can force-commit and bypass .gitignore
  fs.writeFileSync(path.join(childRoomPath, 'canvas-state.json'), JSON.stringify({}, null, 2));

  // 3. Create canvas-link-info.json
  const canvasLinkInfo = {
    parentCanvasId: parentRoomId,
    linkShapeId: linkShapeId,
    position: generateRandomPosition(),
    size: {
      w: 200,
      h: 100
    },
    label: canvasName,
    linkType: "realfile",
    rotation: 0,
    opacity: 1,
    isLocked: false,
    meta: {},
    parentId: parentPageId,
    index: "a1",
    lastChangedClock: 2129
  };
  fs.writeFileSync(path.join(childRoomPath, 'canvas-link-info.json'), JSON.stringify(canvasLinkInfo, null, 2));

  // 4. Create canvas-metadata.json
  const canvasMetadata = {
    canvas: {
      roomId: childRoomId,
      canvasMode: "freeform",
      canvasName: canvasName,
      gridSize: 10
    },
    pages: [
      {
        id: pageId,
        name: "Page 1",
        index: "a1",
        meta: {},
        lastChangedClock: 0
      }
    ],
    schema: {
      schemaVersion: 2,
      sequences: {
        "com.tldraw.store": 5,
        "com.tldraw.asset": 1,
        "com.tldraw.camera": 1,
        "com.tldraw.canvas_storage": 1,
        "com.tldraw.document": 2,
        "com.tldraw.instance": 25,
        "com.tldraw.instance_page_state": 5,
        "com.tldraw.page": 1,
        "com.tldraw.instance_presence": 6,
        "com.tldraw.pointer": 1,
        "com.tldraw.shape": 4,
        "com.tldraw.asset.bookmark": 2,
        "com.tldraw.asset.image": 5,
        "com.tldraw.asset.video": 5,
        "com.tldraw.shape.arrow": 7,
        "com.tldraw.shape.bookmark": 2,
        "com.tldraw.shape.draw": 3,
        "com.tldraw.shape.embed": 4,
        "com.tldraw.shape.frame": 1,
        "com.tldraw.shape.geo": 12,
        "com.tldraw.shape.group": 0,
        "com.tldraw.shape.highlight": 1,
        "com.tldraw.shape.image": 5,
        "com.tldraw.shape.line": 6,
        "com.tldraw.shape.note": 9,
        "com.tldraw.shape.text": 4,
        "com.tldraw.shape.video": 4,
        "com.tldraw.shape.miyagi-widget": 0,
        "com.tldraw.shape.univer": 0,
        "com.tldraw.shape.block": 0,
        "com.tldraw.shape.canvas-link": 0,
        "com.tldraw.shape.file": 0,
        "com.tldraw.binding.arrow": 1
      }
    },
    generatedAt: new Date().toISOString(),
    clock: 2,
    documentClock: 2,
    tombstones: {},
    tombstoneHistoryStartsAtClock: 1
  };
  fs.writeFileSync(path.join(childRoomPath, 'canvas-metadata.json'), JSON.stringify(canvasMetadata, null, 2));

  console.log('\n✅ Child room files created successfully:');
  console.log(`📁 Directory: ${childRoomPath}`);

  // 5. Force-add the child room's canvas-state.json to git
  const childCanvasStatePath = path.join(childRoomPath, 'canvas-state.json');
  forceAddCanvasStateToGit(childCanvasStatePath);

  console.log(`\n🎯 Child room created successfully!`);
  console.log(`Child Room ID: ${childRoomId}`);
  console.log(`Canvas Name: ${canvasName}`);
  console.log(`Page ID: ${pageId}`);
  console.log(`Link Shape ID: ${linkShapeId}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
const parentRoomPath = args[0];

// Run the generator
generateChildRoom(parentRoomPath);
