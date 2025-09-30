#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

/**
 * Generate a random room ID similar to the existing format
 * @returns {string} Room ID like "room-1a7b548b-0c59-4a58-9753-e824eb99a2c9"
 */
function generateRoomId() {
  return `room-${crypto.randomUUID()}`;
}

/**
 * Generate a random shape ID similar to tldraw's format
 * @returns {string} Shape ID like "shape:Y59wm6acnQvwpBlp"
 */
function generateShapeId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `shape:${result}`;
}

/**
 * Generate a random page ID similar to tldraw's format
 * @returns {string} Page ID like "page:BjLIELOAtCOisIXsUlL_n"
 */
function generatePageId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let result = '';
  for (let i = 0; i < 17; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `page:${result}`;
}

/**
 * Generate a random canvas name
 * @returns {string} Canvas name like "Canvas-Alpha", "Workspace-Beta", etc.
 */
function generateCanvasName() {
  const prefixes = ['Canvas', 'Workspace', 'Board', 'Space', 'Room', 'Area', 'Zone'];
  const suffixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Prime', 'Nova', 'Core', 'Hub', 'Lab', 'Studio'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
  
  return `${prefix}-${suffix}`;
}

/**
 * Generate random position coordinates within reasonable bounds
 * @returns {object} Position object with x and y coordinates
 */
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
    // Get the git root directory
    const gitRoot = execSync('git rev-parse --show-toplevel', { 
      cwd: path.dirname(canvasStateFilePath),
      encoding: 'utf8' 
    }).trim();
    
    // Get relative path from git root
    const relativePath = path.relative(gitRoot, canvasStateFilePath);
    
    console.log(`📝 Force-adding canvas-state.json to git: ${relativePath}`);
    
    // Force add the file (ignoring .gitignore)
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
 * Update parent canvas-state.json to add canvas-link for the new child room
 * @param {string} parentRoomPath - The absolute path to the parent room directory
 * @param {string} linkShapeId - The link shape ID
 * @param {string} childRoomId - The child room ID
 * @param {string} canvasName - The canvas name
 * @param {string} parentPageId - The parent page ID
 */
function updateParentCanvasState(parentRoomPath, linkShapeId, childRoomId, canvasName, parentPageId) {
  try {
    const canvasStatePath = path.join(parentRoomPath, 'canvas-state.json');
    if (!fs.existsSync(canvasStatePath)) {
      console.error('Parent canvas-state.json not found');
      process.exit(1);
    }

    const canvasState = JSON.parse(fs.readFileSync(canvasStatePath, 'utf8'));
    
    // Generate random position for the canvas link
    const position = generateRandomPosition();
    
    // Create the canvas-link shape
    const canvasLinkShape = {
      state: {
        id: linkShapeId,
        typeName: "shape",
        type: "canvas-link",
        parentId: parentPageId,
        index: "a1",
        x: position.x,
        y: position.y,
        rotation: 0,
        isLocked: false,
        opacity: 1,
        meta: {},
        props: {
          w: 200,
          h: 100,
          targetCanvasId: childRoomId,
          label: canvasName,
          linkType: "realfile"
        }
      },
      lastChangedClock: canvasState.clock + 1
    };

    // Add the canvas-link to the documents array
    canvasState.documents.push(canvasLinkShape);
    
    // Update the clock
    canvasState.clock += 1;
    canvasState.documentClock += 1;

    // Write back the updated canvas state
    fs.writeFileSync(canvasStatePath, JSON.stringify(canvasState, null, 2));
    
    console.log(`✅ Updated parent canvas-state.json with canvas-link`);
    
  } catch (error) {
    console.error('Error updating parent canvas state:', error);
    process.exit(1);
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

  // Validate that the parent room path exists
  if (!fs.existsSync(parentRoomPath)) {
    console.error(`Error: Parent room directory does not exist: ${parentRoomPath}`);
    process.exit(1);
  }

  // Get parent info
  const { parentPageId, parentRoomId } = getParentInfo(parentRoomPath);

  // Generate random IDs and names
  const childRoomId = generateRoomId();
  const canvasName = generateCanvasName();
  const pageId = generatePageId();
  const linkShapeId = generateShapeId();
  const position = generateRandomPosition();

  console.log(`Creating child room: ${childRoomId}`);
  console.log(`Parent Room Path: ${parentRoomPath}`);
  console.log(`Parent Room ID: ${parentRoomId}`);
  console.log(`Parent Page ID: ${parentPageId}`);
  console.log(`Canvas Name: ${canvasName}`);
  console.log(`Page ID: ${pageId}`);
  console.log(`Link Shape ID: ${linkShapeId}`);

  // Create child room directory
  const childRoomPath = path.join(parentRoomPath, childRoomId);
  if (!fs.existsSync(childRoomPath)) {
    fs.mkdirSync(childRoomPath, { recursive: true });
  } else {
    console.warn(`Directory ${childRoomId} already exists, files will be overwritten`);
  }

  // 1. Create global-storage.json (empty dict)
  const globalStorage = {};
  fs.writeFileSync(path.join(childRoomPath, 'global-storage.json'), JSON.stringify(globalStorage, null, 2));

  // 2. Create canvas-state.json
  const canvasState = {
    clock: 2,
    documentClock: 2,
    tombstones: {},
    tombstoneHistoryStartsAtClock: 1,
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
    documents: [
      {
        state: {
          gridSize: 10,
          name: "",
          meta: {
            roomId: childRoomId,
            canvasMode: "freeform",
            canvasName: canvasName
          },
          id: "document:document",
          typeName: "document"
        },
        lastChangedClock: 2
      },
      {
        state: {
          meta: {},
          id: pageId,
          name: "Page 1",
          index: "a1",
          typeName: "page"
        },
        lastChangedClock: 0
      },
      {
        state: {
          widgets: {},
          global: {},
          id: "canvas_storage:main",
          typeName: "canvas_storage"
        },
        lastChangedClock: 1
      }
    ]
  };
  fs.writeFileSync(path.join(childRoomPath, 'canvas-state.json'), JSON.stringify(canvasState, null, 2));

  // 3. Create canvas-link-info.json
  const canvasLinkInfo = {
    parentCanvasId: parentRoomId,
    linkShapeId: linkShapeId,
    position: {
      x: position.x,
      y: position.y
    },
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
  console.log(`📄 global-storage.json - Empty storage object`);
  console.log(`📄 canvas-state.json - Canvas state with room and page info`);
  console.log(`📄 canvas-link-info.json - Link information for parent canvas`);
  console.log(`📄 canvas-metadata.json - Canvas metadata and configuration`);

  // 5. Update parent canvas-state.json
  updateParentCanvasState(parentRoomPath, linkShapeId, childRoomId, canvasName, parentPageId);

  // 6. Force-add the child room's canvas-state.json to git
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
