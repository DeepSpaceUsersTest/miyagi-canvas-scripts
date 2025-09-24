#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Unpack Canvas State Script
 * 
 * Processes all canvas-state.json files in the repository and generates:
 * - Widget directories (shape-{shapeId}/) with properties.json, template.jsx, template.html, storage.json
 * - Canvas metadata files (canvas-metadata.json)
 * - Global storage files (global-storage.json)
 * 
 * Usage: node unpack-canvas-state.js
 */

class CanvasStateUnpacker {
  constructor() {
    this.rootDir = process.cwd();
    this.processedWidgets = new Set(); // Track widgets to avoid cleanup
  }

  /**
   * Main entry point
   */
  async run() {
    console.log('🚀 Starting canvas state unpacking...');
    
    try {
      // Find all canvas-state.json files
      const canvasStateFiles = this.findCanvasStateFiles();
      console.log(`📁 Found ${canvasStateFiles.length} canvas state files`);

      // Process each canvas
      for (const filePath of canvasStateFiles) {
        await this.processCanvasState(filePath);
      }

      // Clean up old widget directories
      await this.cleanupOldWidgets();

      console.log('✅ Canvas state unpacking completed successfully!');
    } catch (error) {
      console.error('❌ Error during unpacking:', error.message);
      process.exit(1);
    }
  }

  /**
   * Find all canvas-state.json files in the repository
   */
  findCanvasStateFiles() {
    const files = [];
    
    // Check root canvas-state.json
    const rootCanvasState = path.join(this.rootDir, 'canvas-state.json');
    if (fs.existsSync(rootCanvasState)) {
      files.push(rootCanvasState);
    }

    // Check subdirectories for canvas-state.json files
    const entries = fs.readdirSync(this.rootDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('room-')) {
        const subCanvasState = path.join(this.rootDir, entry.name, 'canvas-state.json');
        if (fs.existsSync(subCanvasState)) {
          files.push(subCanvasState);
        }
      }
    }

    return files;
  }

  /**
   * Process a single canvas-state.json file
   */
  async processCanvasState(filePath) {
    console.log(`📄 Processing: ${path.relative(this.rootDir, filePath)}`);

    try {
      // Read and parse canvas state
      const canvasStateContent = fs.readFileSync(filePath, 'utf8');
      const canvasState = JSON.parse(canvasStateContent);

      // Determine canvas directory (root or subdirectory)
      const canvasDir = path.dirname(filePath);
      const isRootCanvas = canvasDir === this.rootDir;

      // Extract canvas metadata
      await this.generateCanvasMetadata(canvasState, canvasDir);

      // Extract global storage
      await this.generateGlobalStorage(canvasState, canvasDir);

      // Extract widgets
      await this.generateWidgets(canvasState, canvasDir);

      console.log(`✅ Processed ${isRootCanvas ? 'root canvas' : path.basename(canvasDir)}`);
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  }

  /**
   * Generate canvas-metadata.json
   */
  async generateCanvasMetadata(canvasState, canvasDir) {
    const metadata = {};

    // Extract document metadata
    const documentRecord = canvasState.documents?.find(doc => 
      doc.state?.typeName === 'document'
    );
    if (documentRecord) {
      metadata.canvas = {
        roomId: documentRecord.state.meta?.roomId,
        canvasMode: documentRecord.state.meta?.canvasMode,
        canvasName: documentRecord.state.meta?.canvasName,
        gridSize: documentRecord.state.gridSize,
        name: documentRecord.state.name
      };
    }

    // Extract page metadata
    const pageRecords = canvasState.documents?.filter(doc => 
      doc.state?.typeName === 'page'
    ) || [];
    metadata.pages = pageRecords.map(page => ({
      id: page.state.id,
      name: page.state.name,
      index: page.state.index,
      meta: page.state.meta
    }));

    // Extract schema information
    if (canvasState.schema) {
      metadata.schema = {
        version: canvasState.schema.schemaVersion,
        sequences: canvasState.schema.sequences
      };
    }

    // Add timestamps
    metadata.generatedAt = new Date().toISOString();
    metadata.clock = canvasState.clock;
    metadata.documentClock = canvasState.documentClock;

    // Write metadata file
    const metadataPath = path.join(canvasDir, 'canvas-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`  📋 Generated: ${path.relative(this.rootDir, metadataPath)}`);
  }

  /**
   * Generate global-storage.json
   */
  async generateGlobalStorage(canvasState, canvasDir) {
    // Find canvas_storage record
    const storageRecord = canvasState.documents?.find(doc => 
      doc.state?.typeName === 'canvas_storage'
    );

    if (!storageRecord) {
      console.log(`  ⚠️  No canvas storage found for ${path.basename(canvasDir)}`);
      return;
    }

    const globalStorage = {
      global: storageRecord.state.global || {},
      generatedAt: new Date().toISOString(),
      lastChangedClock: storageRecord.lastChangedClock
    };

    // Write global storage file
    const globalStoragePath = path.join(canvasDir, 'global-storage.json');
    fs.writeFileSync(globalStoragePath, JSON.stringify(globalStorage, null, 2), 'utf8');
    console.log(`  🌐 Generated: ${path.relative(this.rootDir, globalStoragePath)}`);
  }

  /**
   * Generate widget directories and files
   */
  async generateWidgets(canvasState, canvasDir) {
    // Find widget shapes
    const widgetShapes = canvasState.documents?.filter(doc => 
      doc.state?.typeName === 'shape' && doc.state?.type === 'miyagi-widget'
    ) || [];

    // Find canvas storage for widget data
    const storageRecord = canvasState.documents?.find(doc => 
      doc.state?.typeName === 'canvas_storage'
    );
    const widgetStorage = storageRecord?.state?.widgets || {};

    console.log(`  🧩 Found ${widgetShapes.length} widgets`);

    for (const widgetShape of widgetShapes) {
      await this.generateWidgetDirectory(widgetShape, widgetStorage, canvasDir);
    }
  }

  /**
   * Generate a single widget directory
   */
  async generateWidgetDirectory(widgetShape, widgetStorage, canvasDir) {
    const shapeId = widgetShape.state.id;
    const widgetDir = path.join(canvasDir, `shape-${shapeId.replace('shape:', '')}`);

    // Track this widget to prevent cleanup
    this.processedWidgets.add(path.relative(this.rootDir, widgetDir));

    // Create widget directory
    if (!fs.existsSync(widgetDir)) {
      fs.mkdirSync(widgetDir, { recursive: true });
    }

    // Generate properties.json
    const properties = {
      shapeId: shapeId,
      widgetId: widgetShape.state.props?.widgetId,
      templateHandle: widgetShape.state.props?.templateHandle,
      position: {
        x: widgetShape.state.x,
        y: widgetShape.state.y
      },
      size: {
        w: widgetShape.state.props?.w,
        h: widgetShape.state.props?.h
      },
      rotation: widgetShape.state.rotation,
      opacity: widgetShape.state.opacity,
      isLocked: widgetShape.state.isLocked,
      color: widgetShape.state.props?.color,
      zoomScale: widgetShape.state.props?.zoomScale,
      meta: widgetShape.state.meta,
      parentId: widgetShape.state.parentId,
      index: widgetShape.state.index,
      lastChangedClock: widgetShape.lastChangedClock
    };

    fs.writeFileSync(
      path.join(widgetDir, 'properties.json'),
      JSON.stringify(properties, null, 2),
      'utf8'
    );

    // Generate template.jsx
    const jsxContent = widgetShape.state.props?.jsxContent || '';

    fs.writeFileSync(path.join(widgetDir, 'template.jsx'), jsxContent, 'utf8');

    // Generate template.html
    const htmlContent = widgetShape.state.props?.htmlContent || '';
    
    fs.writeFileSync(path.join(widgetDir, 'template.html'), htmlContent, 'utf8');

    // Generate storage.json (widget-specific storage)
    const widgetStorageData = widgetStorage[shapeId] || {};
    
    const storageData = {
      ...widgetStorageData,
      generatedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(widgetDir, 'storage.json'),
      JSON.stringify(storageData, null, 2),
      'utf8'
    );

    console.log(`    🧩 Generated: ${path.relative(this.rootDir, widgetDir)}/`);
  }

  /**
   * Clean up old widget directories that no longer exist in canvas state
   */
  async cleanupOldWidgets() {
    console.log('🧹 Cleaning up old widget directories...');

    const allWidgetDirs = this.findAllWidgetDirectories();
    let cleanedCount = 0;

    for (const widgetDir of allWidgetDirs) {
      const relativePath = path.relative(this.rootDir, widgetDir);
      
      // If this widget wasn't processed, it's old and should be removed
      if (!this.processedWidgets.has(relativePath)) {
        console.log(`  🗑️  Removing old widget: ${relativePath}`);
        fs.rmSync(widgetDir, { recursive: true, force: true });
        cleanedCount++;
      }
    }

    console.log(`🧹 Cleaned up ${cleanedCount} old widget directories`);
  }

  /**
   * Find all existing widget directories
   */
  findAllWidgetDirectories() {
    const widgetDirs = [];

    const searchDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dir, entry.name);
          
          // Check if it's a widget directory
          if (entry.name.startsWith('shape-')) {
            widgetDirs.push(fullPath);
          }
          // Recurse into room- directories
          else if (entry.name.startsWith('room-')) {
            searchDir(fullPath);
          }
        }
      }
    };

    searchDir(this.rootDir);
    return widgetDirs;
  }
}

// Run the script
if (require.main === module) {
  const unpacker = new CanvasStateUnpacker();
  unpacker.run();
}

module.exports = CanvasStateUnpacker;
