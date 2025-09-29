#!/usr/bin/env node

/**
 * Unpack Canvas State Script - Room-Centric Architecture
 * 
 * Processes all canvas-state.json files in the repository recursively.
 * Each room (root or subcanvas) is processed identically and generates:
 * - Widget directories (widget-{shapeId}/) with properties.json, template.jsx, template.html, storage.json
 * - Canvas metadata files (canvas-metadata.json) 
 * - Global storage files (global-storage.json)
 * - Canvas-link info files (canvas-link-info.json) in target room directories
 * 
 * Usage: node unpack-canvas-state.js
 */

const fs = require('fs');
const path = require('path');

class CanvasStateUnpacker {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.processedWidgets = new Set();
    this.referencedRooms = new Set(); // Rooms referenced by canvas-links across all canvas-state.json files
    this.unreferencedRoomDirs = new Set(); // Room directories that are potentially unreferenced (populated during BFS)
  }

  /**
   * Main entry point
   */
  async run() {
    console.log('🚀 Starting canvas state unpacking with graph traversal...');
    
    try {
      const rootRoomName = await this.identifyRootRoom();

      await this.traverseCanvasGraph(rootRoomName);

      await this.cleanupOldWidgets();
      await this.cleanupUnreferencedRooms();

      console.log('✅ Canvas state unpacking completed successfully!');
    } catch (error) {
      console.error('❌ Canvas state unpacking failed:', error);
      process.exit(1);
    }
  }

   // Identify the root room directory. Ensures there is exactly one root room in the repository
  async identifyRootRoom() {
    const entries = fs.readdirSync(this.rootDir, { withFileTypes: true });
    const rootRoomDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('room-'))
      .map(entry => entry.name);

    if (rootRoomDirs.length === 0) {
      throw new Error('❌ No root room directory found! Expected exactly one room-* directory in repository root.');
    }

    if (rootRoomDirs.length > 1) {
      throw new Error(`❌ Multiple root room directories found: ${rootRoomDirs.join(', ')}. Expected exactly one room-* directory in repository root.`);
    }

    const rootRoomName = rootRoomDirs[0];
    return rootRoomName;
  }

  /**
   * Traverse the canvas graph using BFS starting from the root room
   * Only processes rooms that are reachable via canvasLinks
   */
  async traverseCanvasGraph(rootRoomName) {
    console.log(`🌐 Starting graph traversal from root: ${rootRoomName}`);
    
    const rootRoomPath = path.join(this.rootDir, rootRoomName);
    const queue = [rootRoomPath];
    
    while (queue.length > 0) {
      const currentRoomPath = queue.shift();
      const currentRoomName = path.basename(currentRoomPath);
      
      console.log(`📍 Processing room: ${currentRoomName} at ${currentRoomPath}`);
      
      // Find and process this room's canvas-state.json
      const canvasStateFile = this.findCanvasStateFileForRoom(currentRoomPath);
      if (!canvasStateFile) {
        console.warn(`⚠️ No canvas-state.json found for room: ${currentRoomName} at ${currentRoomPath}`);
        continue;
      }
      
      this.collectRoomDirectoriesInPath(currentRoomPath); // Collect all room directories in current directory as potentially unreferenced
      this.referencedRooms.add(currentRoomName);
      
      const processedDocs = await this.unpackRoom(canvasStateFile);

      for (const canvasLink of processedDocs.canvasLinks) {
        const targetRoomName = canvasLink.properties.targetCanvasId;
        if(!targetRoomName) continue;
        this.unreferencedRoomDirs.delete(path.join(currentRoomPath, targetRoomName));
        if (!this.referencedRooms.has(targetRoomName)) {
          const childRoomPath = path.join(currentRoomPath, targetRoomName);
          queue.push(childRoomPath);
        }
      }
    }
    
    console.log(`✅ Graph traversal completed. Processed ${this.referencedRooms.size} rooms.`);
  }

  // Collect all room-* directories in the given path as potentially unreferenced
  collectRoomDirectoriesInPath(roomPath) {
    try {
      const entries = fs.readdirSync(roomPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('room-')) {
          const fullPath = path.join(roomPath, entry.name);
          this.unreferencedRoomDirs.add(fullPath);
        }
      }
    } catch (error) {
      // Ignore errors (directory might not exist or be readable)
    }
  }

  findCanvasStateFileForRoom(roomPath) {
    const canvasStatePath = path.join(roomPath, 'canvas-state.json');
    console.log(`  🔍 Looking for: ${canvasStatePath}`);
    if (fs.existsSync(canvasStatePath)) {
      return canvasStatePath;
    }
    
    return null;
  }

  /**
   * Process a single room's canvas-state.json file
   * Every room (root or subcanvas) is processed identically
   */
  async unpackRoom(canvasStateFilePath) {
    const roomDir = path.dirname(canvasStateFilePath);
    const roomName = path.basename(roomDir);
    
    console.log(`📄 Unpacking room: ${roomName} (${path.relative(this.rootDir, canvasStateFilePath)})`);

    try {
      // Read and parse this room's canvas state
      const canvasStateContent = fs.readFileSync(canvasStateFilePath, 'utf8');
      const canvasState = JSON.parse(canvasStateContent);

      // Step 1: Process all documents and collect by type
      const processedDocs = {
        document: null,
        pages: [],
        canvasStorage: null,
        widgets: [],
        canvasLinks: []
      };

      // First pass: Extract canvas_storage to get widget storage data
      let roomWidgetStorage = {};
      for (const doc of canvasState.documents || []) {
        if (doc.state?.typeName === 'canvas_storage') {
          roomWidgetStorage = doc.state?.widgets || {};
          break;
        }
      }

      // Second pass: Process all documents with widget storage context
      for (const doc of canvasState.documents || []) {
        const result = await this.processDocument(doc, canvasState, roomWidgetStorage);
        if (result) {
          this.categorizeProcessedDocument(result, processedDocs);
        }
      }

      // Step 2: Generate metadata and storage files for THIS room
      // (Every room gets these files - no special root treatment)
      await this.generateCanvasMetadata(processedDocs.document, processedDocs.pages, canvasState, roomDir);
      await this.generateGlobalStorage(processedDocs.canvasStorage, roomDir);

      // Step 3: Generate widget directories in THIS room
      console.log(`  🧩 Found ${processedDocs.widgets.length} widgets in ${roomName}`);
      for (const widget of processedDocs.widgets) {
        await this.generateWidgetDirectory(widget, roomDir);
      }

      // Step 4: Store canvas-link info in target room directories
      if (processedDocs.canvasLinks.length > 0) {
        console.log(`  🔗 Found ${processedDocs.canvasLinks.length} canvas-links in ${roomName}`);
        for (const canvasLink of processedDocs.canvasLinks) {
          await this.storeCanvasLinkInfo(canvasLink, roomDir);
        }
      }

      console.log(`✅ Processed room: ${roomName}`);
      
      // Return processedDocs for graph traversal
      return processedDocs;

    } catch (error) {
      console.error(`❌ Error unpacking room ${roomName} from ${canvasStateFilePath}:`, error);
      throw error;
    }
  }

  /**
   * Main document processor - dispatches based on typeName
   */
  async processDocument(document, canvasState, roomWidgetStorage = {}) {
    const { state, lastChangedClock } = document;
    
    switch (state.typeName) {
      case 'document':
        return this.processDocumentRecord(state, lastChangedClock, canvasState);
      case 'page':
        return this.processPageRecord(state, lastChangedClock);
      case 'canvas_storage':
        return this.processCanvasStorageRecord(state, lastChangedClock);
      case 'shape':
        return this.processShapeRecord(state, lastChangedClock, roomWidgetStorage);
      default:
        // Ignore other document types (instance, camera, etc.)
        return null;
    }
  }

  /**
   * Process document record
   */
  processDocumentRecord(state, lastChangedClock, canvasState) {
    return {
      type: 'document',
      id: state.id,
      name: state.name || '',
      gridSize: state.gridSize || 10,
      meta: state.meta || {},
      lastChangedClock,
      // Include schema and clock info from the full canvas state
      schema: canvasState.schema,
      clock: canvasState.clock,
      documentClock: canvasState.documentClock,
      tombstones: canvasState.tombstones,
      tombstoneHistoryStartsAtClock: canvasState.tombstoneHistoryStartsAtClock
    };
  }

  /**
   * Process page record
   */
  processPageRecord(state, lastChangedClock) {
    return {
      type: 'page',
      id: state.id,
      name: state.name || 'Page 1',
      index: state.index || 'a1',
      meta: state.meta || {},
      lastChangedClock
    };
  }

  /**
   * Process canvas_storage record
   */
  processCanvasStorageRecord(state, lastChangedClock) {
    return {
      type: 'canvas_storage',
      id: state.id,
      widgetStorage: state.widgets || {},
      globalStorage: state.global || {},
      lastChangedClock
    };
  }

  /**
   * Process shape record - dispatches based on shape type
   */
  processShapeRecord(state, lastChangedClock, roomWidgetStorage = {}) {
    switch (state.type) {
      case 'miyagi-widget':
        return this.processMiyagiWidget(state, lastChangedClock, roomWidgetStorage);
      case 'canvas-link':
        return this.processCanvasLink(state, lastChangedClock);
      default:
        // Ignore other shape types (arrows, text, etc.)
        return null;
    }
  }

  /**
   * Process miyagi-widget shape
   */
  processMiyagiWidget(state, lastChangedClock, roomWidgetStorage = {}) {
    const shapeId = state.id;
    const widgetStorageData = roomWidgetStorage[shapeId] || {};
    
    return {
      type: 'miyagi-widget',
      shapeId,
      properties: {
        shapeId: shapeId,
        widgetId: state.props?.widgetId,
        templateHandle: state.props?.templateHandle,
        position: {
          x: state.x,
          y: state.y
        },
        size: {
          w: state.props?.w,
          h: state.props?.h
        },
        rotation: state.rotation,
        opacity: state.opacity,
        isLocked: state.isLocked,
        color: state.props?.color,
        zoomScale: state.props?.zoomScale,
        meta: state.meta,
        parentId: state.parentId,
        index: state.index,
        lastChangedClock
      },
      jsxContent: state.props?.jsxContent || '',
      htmlContent: state.props?.htmlContent || '',
      storage: widgetStorageData,
      lastChangedClock
    };
  }

  /**
   * Process canvas-link shape
   */
  processCanvasLink(state, lastChangedClock) {
    return {
      type: 'canvas-link',
      shapeId: state.id,
      properties: {
        shapeId: state.id,
        targetCanvasId: state.props?.targetCanvasId,
        label: state.props?.label || 'Subcanvas Link',
        linkType: state.props?.linkType || 'realfile',
        position: {
          x: state.x,
          y: state.y
        },
        size: {
          w: state.props?.w || 200,
          h: state.props?.h || 100
        },
        rotation: state.rotation,
        opacity: state.opacity,
        isLocked: state.isLocked,
        meta: state.meta,
        parentId: state.parentId,
        index: state.index,
        lastChangedClock
      },
      lastChangedClock
    };
  }

  /**
   * Categorize processed documents into collections
   */
  categorizeProcessedDocument(result, processedDocs) {
    switch (result.type) {
      case 'document':
        processedDocs.document = result;
        break;
      case 'page':
        processedDocs.pages.push(result);
        break;
      case 'canvas_storage':
        processedDocs.canvasStorage = result;
        break;
      case 'miyagi-widget':
        processedDocs.widgets.push(result);
        break;
      case 'canvas-link':
        processedDocs.canvasLinks.push(result);
        break;
    }
  }

  /**
   * Generate canvas-metadata.json
   */
  async generateCanvasMetadata(documentRecord, pageRecords, canvasState, canvasDir) {
    if (!documentRecord) {
      console.warn('⚠️ No document record found - using defaults for canvas metadata');
    }

    const metadata = {
      canvas: {
        roomId: documentRecord?.meta?.roomId || 'room-unknown',
        canvasMode: documentRecord?.meta?.canvasMode || 'freeform',
        canvasName: documentRecord?.meta?.canvasName || 'Canvas',
        gridSize: documentRecord?.gridSize || 10
      },
      pages: pageRecords.map(page => ({
        id: page.id,
        name: page.name,
        index: page.index,
        meta: page.meta,
        lastChangedClock: page.lastChangedClock
      })),
      schema: documentRecord?.schema || canvasState.schema,
      generatedAt: new Date().toISOString(),
      clock: documentRecord?.clock || canvasState.clock,
      documentClock: documentRecord?.documentClock || canvasState.documentClock,
      tombstones: documentRecord?.tombstones || canvasState.tombstones || {},
      tombstoneHistoryStartsAtClock: documentRecord?.tombstoneHistoryStartsAtClock || canvasState.tombstoneHistoryStartsAtClock || 1
    };

    const metadataPath = path.join(canvasDir, 'canvas-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`  📋 Generated: ${path.relative(this.rootDir, metadataPath)}`);
  }

  /**
   * Generate global-storage.json for this room
   */
  async generateGlobalStorage(canvasStorageRecord, canvasDir) {
    const globalStorage = canvasStorageRecord?.globalStorage || {};
    
    const globalStoragePath = path.join(canvasDir, 'global-storage.json');
    fs.writeFileSync(globalStoragePath, JSON.stringify(globalStorage, null, 2), 'utf8');
    console.log(`  🌐 Generated: ${path.relative(this.rootDir, globalStoragePath)}`);
  }

  /**
   * Generate a widget directory with all files
   */
  async generateWidgetDirectory(widget, canvasDir) {
    const shapeIdClean = widget.shapeId.replace('shape:', '');
    const widgetDir = path.join(canvasDir, `widget-${shapeIdClean}`);

    // Track this widget to prevent cleanup
    this.processedWidgets.add(path.relative(this.rootDir, widgetDir));

    // Create widget directory
    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir, { recursive: true });
    }

    // Generate properties.json
    fs.writeFileSync(
      path.join(widgetDir, 'properties.json'),
      JSON.stringify(widget.properties, null, 2),
      'utf8'
    );

    // Generate template.jsx
    fs.writeFileSync(path.join(widgetDir, 'template.jsx'), widget.jsxContent, 'utf8');

    // Generate template.html
    fs.writeFileSync(path.join(widgetDir, 'template.html'), widget.htmlContent, 'utf8');

    // Generate storage.json (widget-specific storage)
    fs.writeFileSync(
      path.join(widgetDir, 'storage.json'),
      JSON.stringify(widget.storage, null, 2),
      'utf8'
    );

    console.log(`    🧩 Generated: ${path.relative(this.rootDir, widgetDir)}/`);
  }

  /**
   * Store canvas-link information in the target room directory
   */
  async storeCanvasLinkInfo(canvasLink, parentCanvasDir) {
    const targetCanvasId = canvasLink.properties.targetCanvasId;
    if (!targetCanvasId) {
      console.warn(`⚠️ Canvas-link ${canvasLink.shapeId} has no targetCanvasId`);
      return;
    }

    // Target room should be a subdirectory of the current room
    const targetRoomDir = path.join(parentCanvasDir, targetCanvasId);
    
    if (!fs.existsSync(targetRoomDir)) {
      console.warn(`⚠️ Target room directory not found: ${targetCanvasId} at ${targetRoomDir}`);
      return;
    }

    // Create canvas-link-info.json in the target room directory
    const parentRoomName = path.basename(parentCanvasDir);
    const canvasLinkInfo = {
      parentCanvasId: parentRoomName,
      linkShapeId: canvasLink.shapeId,
      position: canvasLink.properties.position,
      size: canvasLink.properties.size,
      label: canvasLink.properties.label,
      linkType: canvasLink.properties.linkType,
      rotation: canvasLink.properties.rotation,
      opacity: canvasLink.properties.opacity,
      isLocked: canvasLink.properties.isLocked,
      meta: canvasLink.properties.meta,
      parentId: canvasLink.properties.parentId,
      index: canvasLink.properties.index,
      lastChangedClock: canvasLink.properties.lastChangedClock
    };

    const canvasLinkInfoPath = path.join(targetRoomDir, 'canvas-link-info.json');
    fs.writeFileSync(canvasLinkInfoPath, JSON.stringify(canvasLinkInfo, null, 2), 'utf8');
    
    console.log(`    🔗 Generated: ${path.relative(this.rootDir, canvasLinkInfoPath)}`);
  }

  /**
   * Clean up old widget directories that are no longer in the canvas state
   */
  async cleanupOldWidgets() {
    console.log('🧹 Cleaning up old widget directories...');
    
    let cleanedCount = 0;
    const allShapeDirs = this.findShapeDirectories(this.rootDir);
    
    for (const shapeDir of allShapeDirs) {
      const relativePath = path.relative(this.rootDir, shapeDir);
      if (!this.processedWidgets.has(relativePath)) {
        console.log(`  🗑️  Removing old widget: ${relativePath}`);
        fs.rmSync(shapeDir, { recursive: true, force: true });
        cleanedCount++;
      }
    }
    
    console.log(`🧹 Cleaned up ${cleanedCount} old widget directories`);
  }

  // Clean up room directories that are not referenced by any canvas-links in any canvas-state.json
  async cleanupUnreferencedRooms() {    
    let cleanedCount = 0;
    
    console.log(`   Found ${this.unreferencedRoomDirs.size} unreferenced room directories`);
    console.log(`   Found ${this.referencedRooms.size} referenced rooms: ${Array.from(this.referencedRooms).join(', ')}`);
    
    for (const roomDir of this.unreferencedRoomDirs) {
      const roomName = path.basename(roomDir);
      console.log(`  🗑️  Removing unreferenced room: ${roomName} at ${roomDir}`);
      try {
        fs.rmSync(roomDir, { recursive: true, force: true });
        cleanedCount++;
      } catch (error) {
        console.error(`❌ Failed to remove room directory ${roomDir}:`, error.message);
      }
    }
    
    console.log(`🏠 Cleaned up ${cleanedCount} unreferenced room directories`);
  }


  /**
   * Find all widget-* directories recursively
   */
  findShapeDirectories(dir) {
    const shapeDirs = [];
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.name.startsWith('widget-')) {
          shapeDirs.push(fullPath);
        } else if (!entry.name.startsWith('.')) {
          shapeDirs.push(...this.findShapeDirectories(fullPath));
        }
      }
    }
    
    return shapeDirs;
  }
}

// Auto-execute when run directly
if (require.main === module) {
  const unpacker = new CanvasStateUnpacker();
  unpacker.run().catch(error => {
    console.error('❌ Unpack failed:', error);
    process.exit(1);
  });
}

module.exports = CanvasStateUnpacker;