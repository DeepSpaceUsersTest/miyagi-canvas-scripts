#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate a random shape ID similar to tldraw's format
 * @returns {string} Shape ID like "shape:Y59wm6acnQvwpBlp"
 */
function generateShapeId() {
  // Generate 16 character random string similar to tldraw format
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `shape:${result}`;
}

/**
 * Read page ID from canvas metadata
 * @param {string} roomPath - The absolute path to the room directory
 * @returns {string} The page ID from canvas metadata, or 'page:page' as fallback
 */
function getPageIdFromMetadata(roomPath) {
  try {
    const metadataPath = path.join(roomPath, 'canvas-metadata.json');
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      if (metadata.pages && metadata.pages.length > 0) {
        return metadata.pages[0].id;
      }
    }
  } catch (error) {
    console.warn('Warning: Could not read canvas metadata, using default page ID');
  }
  return 'page:page'; // fallback
}

/**
 * Generate widget directory and files
 * @param {string} roomPath - The absolute path to the room directory
 * @param {string} templateHandle - Template handle (required)
 */
function generateWidget(roomPath, templateHandle) {
  if (!roomPath || !templateHandle) {
    console.error('Error: Both roomPath and templateHandle are required');
    console.log('Usage: node generate-widget.js <roomPath> <templateHandle>');
    console.log('Arguments:');
    console.log('  roomPath       - The absolute path to the room directory');
    console.log('  templateHandle - The template handle (e.g., my-widget)');
    console.log('Example: node generate-widget.js /path/to/room-12345 my-template');
    process.exit(1);
  }

  // Validate that the room path exists
  if (!fs.existsSync(roomPath)) {
    console.error(`Error: Room directory does not exist: ${roomPath}`);
    process.exit(1);
  }

  // Extract room ID from the path
  const roomId = path.basename(roomPath);

  // Get the page ID from canvas metadata
  const pageId = getPageIdFromMetadata(roomPath);
  
  const shapeId = generateShapeId();
  const widgetId = `${templateHandle}_${Date.now()}`;
  const dirName = `widget-${shapeId.replace('shape:', '')}`;
  
  // Create widget directory in the specified room directory
  const dirPath = path.join(roomPath, dirName);

  console.log(`Creating widget directory: ${dirName}`);
  console.log(`Room Path: ${roomPath}`);
  console.log(`Room ID: ${roomId}`);
  console.log(`Page ID: ${pageId}`);
  console.log(`Shape ID: ${shapeId}`);
  console.log(`Template Handle: ${templateHandle}`);

  // Create directory
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  } else {
    console.warn(`Directory ${dirName} already exists, files will be overwritten`);
  }

  // Create template.jsx (empty file)
  const templateJsx = ``;

  // Create storage.json with widget config
  const widgetConfig = {
    roomId: roomId,
    pageId: pageId, 
    shapeId: shapeId,
    templateHandle: templateHandle
  };
  
  const storageJson = {
    "__widget_config": JSON.stringify(widgetConfig)
  };

  // Create properties.json
  const propertiesJson = {
    shapeId: shapeId,
    widgetId: widgetId,
    templateHandle: templateHandle,
    position: {
        x: 917.8322391382553,
        y: -2544.7039783869136
    },
    size: {
      w: 300,
      h: 200
    },
    rotation: 0,
    opacity: 1,
    isLocked: false,
    color: "black",
    zoomScale: 1,
    meta: {
      initializationState: "ready"
    },
    parentId: pageId,
    index: "a1",
    lastChangedClock: 1676
  };

  // Write files
  try {
    fs.writeFileSync(path.join(dirPath, 'template.jsx'), templateJsx);
    fs.writeFileSync(path.join(dirPath, 'storage.json'), JSON.stringify(storageJson, null, 2));
    fs.writeFileSync(path.join(dirPath, 'properties.json'), JSON.stringify(propertiesJson, null, 2));

    console.log('\n✅ Widget files created successfully:');
    console.log(`📁 Directory: ${dirPath}`);
    console.log(`📄 template.jsx - React component template`);
    console.log(`📄 storage.json - Widget storage configuration`);
    console.log(`📄 properties.json - Widget properties and metadata`);
    console.log(`\n🎯 Next steps:`);
    console.log(`1. Edit template.jsx to implement your widget logic`);
    console.log(`2. Use the files for testing or deployment`);
    console.log(`3. Shape ID: ${shapeId}`);

  } catch (error) {
    console.error('Error creating files:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const roomPath = args[0];
const templateHandle = args[1];

// Run the generator
generateWidget(roomPath, templateHandle);
