/**
 * Canvas State Generation Script - Room-Centric Architecture
 * 
 * True inverse of unpack-canvas-state.js
 * Processes each room directory independently and generates canvas-state.json files
 * in their proper locations (root + all room-ROOMID subdirectories)
 */

const fs = require('fs');
const path = require('path');

class CanvasStateGenerator {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
  }

  /**
   * Main entry point - generates canvas-state.json for all rooms
   */
  async run() {
    console.log('🎨 Starting canvas state generation...');
    
    try {
      // Find all room directories (root + room-*)
      const roomDirs = this.findRoomDirectories(this.rootDir);
      console.log(`📁 Found ${roomDirs.length} room directories to process`);

      // Generate canvas-state.json for each room independently
      let totalGenerated = 0;
      for (const roomDir of roomDirs) {
        const success = await this.generateRoomCanvasState(roomDir);
        if (success) totalGenerated++;
      }

      console.log(`✅ Canvas state generation completed successfully!`);
      console.log(`📊 Generated ${totalGenerated}/${roomDirs.length} canvas-state.json files`);
      return totalGenerated > 0;
      
    } catch (error) {
      console.error('❌ Canvas state generation failed:', error);
      return false;
    }
  }

  /**
   * Find all room directories recursively (same pattern as unpack-canvas-state.js)
   * Returns all directories that should contain canvas-state.json
   */
  findRoomDirectories(rootDir) {
    const roomDirs = [];
    
    const searchRecursively = (currentDir) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      // Check if this directory should have a canvas-state.json
      const hasCanvasMetadata = entries.some(entry => entry.isFile() && entry.name === 'canvas-metadata.json');
      if (hasCanvasMetadata) {
        roomDirs.push(currentDir);
      }
      
      // Recursively search room-* subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('room-')) {
          searchRecursively(path.join(currentDir, entry.name));
        }
      }
    };
    
    searchRecursively(rootDir);
    return roomDirs;
  }

  /**
   * Generate canvas-state.json for a single room
   */
  async generateRoomCanvasState(roomDir) {
    const roomName = roomDir === this.rootDir ? 'root' : path.basename(roomDir);
    console.log(`📄 Generating canvas state for room: ${roomName}`);

    try {
      // Step 1: Load room metadata and storage
      const canvasMetadata = await this.loadCanvasMetadata(roomDir);
      const globalStorage = await this.loadGlobalStorage(roomDir);
      
      if (!canvasMetadata) {
        console.log(`⚠️ No canvas metadata found in ${roomName} - skipping`);
        return false;
      }

      // Step 2: Load widgets from shape-* directories
      const { widgets, widgetStorage } = await this.loadRoomWidgets(roomDir);

      // Step 3: Load canvas-links from direct child room directories
      const canvasLinks = await this.loadCanvasLinksForParentRoom(roomDir);

      // Step 4: Generate tldraw RoomSnapshot
      const roomSnapshot = this.generateRoomSnapshot({
        canvasMetadata,
        globalStorage,
        widgetStorage,
        widgets,
        canvasLinks
      });

      // Step 5: Write canvas-state.json to this room directory
      const canvasStatePath = path.join(roomDir, 'canvas-state.json');
      fs.writeFileSync(canvasStatePath, JSON.stringify(roomSnapshot, null, 2), 'utf8');
      
      console.log(`✅ Generated canvas-state.json for ${roomName} with ${widgets.length} widgets and ${canvasLinks.length} canvas-links`);
      return true;

    } catch (error) {
      console.error(`❌ Error generating canvas state for room ${roomName}:`, error);
      return false;
    }
  }

  /**
   * Load canvas-metadata.json for a room
   */
  async loadCanvasMetadata(roomDir) {
    const metadataPath = path.join(roomDir, 'canvas-metadata.json');
    if (!fs.existsSync(metadataPath)) {
      return null;
    }
    
    try {
      return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      console.error(`❌ Error loading canvas-metadata.json from ${roomDir}:`, error);
      return null;
    }
  }

  /**
   * Load global-storage.json for a room
   */
  async loadGlobalStorage(roomDir) {
    const globalStoragePath = path.join(roomDir, 'global-storage.json');
    if (!fs.existsSync(globalStoragePath)) {
      return {};
    }
    
    try {
      return JSON.parse(fs.readFileSync(globalStoragePath, 'utf8'));
    } catch (error) {
      console.error(`❌ Error loading global-storage.json from ${roomDir}:`, error);
      return {};
    }
  }

  /**
   * Load all widgets from shape-* directories in a room
   */
  async loadRoomWidgets(roomDir) {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true });
    const shapeDirectories = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('shape-'))
      .map(entry => entry.name);

    console.log(`  🧩 Found ${shapeDirectories.length} widget directories in ${path.basename(roomDir)}`);

    const widgets = [];
    const widgetStorage = {};

    for (const shapeDir of shapeDirectories) {
      const widget = await this.loadWidget(roomDir, shapeDir);
      if (widget) {
        widgets.push(widget);
        
        // Add widget storage to the room's widget storage map
        const shapeId = widget.properties?.shapeId || widget.properties?.id || widget.shapeId;
        if (widget.storage && shapeId) {
          widgetStorage[shapeId] = widget.storage;
        }
      }
    }

    return { widgets, widgetStorage };
  }

  /**
   * Load a single widget from shape-* directory
   */
  async loadWidget(roomDir, shapeDir) {
    const widgetDir = path.join(roomDir, shapeDir);
    const shapeId = shapeDir.replace('shape-', 'shape:');
    
    try {
      // Load all widget files
      const propertiesPath = path.join(widgetDir, 'properties.json');
      const jsxPath = path.join(widgetDir, 'template.jsx');
      const htmlPath = path.join(widgetDir, 'template.html');
      const storagePath = path.join(widgetDir, 'storage.json');

      const properties = fs.existsSync(propertiesPath) 
        ? JSON.parse(fs.readFileSync(propertiesPath, 'utf8')) 
        : null;
      
      const jsxContent = fs.existsSync(jsxPath) 
        ? fs.readFileSync(jsxPath, 'utf8') 
        : '';
      
      const htmlContent = fs.existsSync(htmlPath) 
        ? fs.readFileSync(htmlPath, 'utf8') 
        : '';
      
      const storage = fs.existsSync(storagePath) 
        ? JSON.parse(fs.readFileSync(storagePath, 'utf8')) 
        : {};

      if (!properties || !jsxContent || !htmlContent) {
        console.log(`⚠️ Skipping incomplete widget: ${shapeDir}`);
        return null;
      }

      return {
        shapeId,
        properties,
        jsxContent,
        htmlContent,
        storage
      };

    } catch (error) {
      console.error(`❌ Error loading widget ${shapeDir}:`, error);
      return null;
    }
  }

  /**
   * Load canvas-links that should be included in this room's canvas-state
   * Only looks at direct child directories of the current room
   */
  async loadCanvasLinksForParentRoom(currentRoomDir) {
    const canvasLinks = [];
    const currentRoomName = currentRoomDir === this.rootDir ? path.basename(this.rootDir) : path.basename(currentRoomDir);
    
    // Get direct child room-* directories of the current room
    const entries = fs.readdirSync(currentRoomDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('room-')) {
        const childRoomDir = path.join(currentRoomDir, entry.name);
        const canvasLinkInfoPath = path.join(childRoomDir, 'canvas-link-info.json');
        
        if (!fs.existsSync(canvasLinkInfoPath)) {
          continue;
        }

        try {
          const canvasLinkInfo = JSON.parse(fs.readFileSync(canvasLinkInfoPath, 'utf8'));
          
          // Check if this canvas-link should appear in the current room
          if (canvasLinkInfo.parentCanvasId === currentRoomName) {
            canvasLinks.push({
              shapeId: canvasLinkInfo.linkShapeId || `shape:link-to-${entry.name}`,
              properties: {
                id: canvasLinkInfo.linkShapeId || `shape:link-to-${entry.name}`,
                typeName: 'shape',
                type: 'canvas-link',
                parentId: canvasLinkInfo.parentId || 'page:page',
                index: canvasLinkInfo.index || 'a1',
                x: canvasLinkInfo.position?.x || 0,
                y: canvasLinkInfo.position?.y || 0,
                rotation: canvasLinkInfo.rotation || 0,
                isLocked: canvasLinkInfo.isLocked || false,
                opacity: canvasLinkInfo.opacity || 1,
                meta: canvasLinkInfo.meta || {},
                props: {
                  w: canvasLinkInfo.size?.w || 200,
                  h: canvasLinkInfo.size?.h || 100,
                  targetCanvasId: entry.name, // The child room ID
                  label: canvasLinkInfo.label || `Link to ${entry.name}`,
                  linkType: canvasLinkInfo.linkType || 'realfile'
                }
              },
              lastChangedClock: canvasLinkInfo.lastChangedClock || 0
            });
          }
        } catch (error) {
          console.error(`❌ Error loading canvas-link-info from ${canvasLinkInfoPath}:`, error);
        }
      }
    }
    
    return canvasLinks;
  }

  /**
   * Generate tldraw RoomSnapshot from room data
   */
  generateRoomSnapshot(roomData) {
    const { canvasMetadata, globalStorage, widgetStorage, widgets, canvasLinks } = roomData;
    
    // Extract canvas info from metadata (preserve existing values)
    const roomId = canvasMetadata?.canvas?.roomId || 'room-generated';
    const canvasMode = canvasMetadata?.canvas?.canvasMode || 'freeform';
    const canvasName = canvasMetadata?.canvas?.canvasName || 'Generated Canvas';
    const gridSize = canvasMetadata?.canvas?.gridSize || 10;
    const pageId = canvasMetadata?.pages?.[0]?.id || 'page:page';
    const pageName = canvasMetadata?.pages?.[0]?.name || 'Page 1';
    
    const documents = [
      // Document record
      {
        state: {
          gridSize: gridSize,
          name: '',
          meta: {
            roomId: roomId,
            canvasMode: canvasMode,
            canvasName: canvasName
          },
          id: 'document:document',
          typeName: 'document'
        },
        lastChangedClock: canvasMetadata?.documentClock || 2
      },
      // Page record
      {
        state: {
          meta: {},
          id: pageId,
          name: pageName,
          index: 'a1',
          typeName: 'page'
        },
        lastChangedClock: canvasMetadata?.pages?.[0]?.lastChangedClock || 0
      },
      // Canvas storage record - CRITICAL for per-room storage
      {
        state: {
          widgets: widgetStorage, // Per-room widget storage
          global: globalStorage,  // Per-room global storage
          id: 'canvas_storage:main',
          typeName: 'canvas_storage'
        },
        lastChangedClock: canvasMetadata?.canvasStorage?.lastChangedClock || (widgets.length + canvasLinks.length + 2)
      }
    ];

    // Add widget shape records
    let shapeIndex = 1;
    for (const widget of widgets) {
      const props = widget.properties;
      
      const widgetDocument = {
        state: {
          id: props.shapeId || props.id || widget.shapeId,
          typeName: 'shape',
          type: 'miyagi-widget',
          parentId: props.parentId || pageId,
          index: props.index || `a${shapeIndex}`,
          x: props.position?.x || props.x || 0,
          y: props.position?.y || props.y || 0,
          rotation: props.rotation || 0,
          isLocked: props.isLocked || false,
          opacity: props.opacity || 1,
          meta: props.meta || { initializationState: 'ready' },
          props: {
            w: props.size?.w || props.w || 300,
            h: props.size?.h || props.h || 200,
            widgetId: props.widgetId || `${props.templateHandle || 'widget'}_${Date.now()}`,
            templateHandle: props.templateHandle || 'notepad-react-test',
            htmlContent: widget.htmlContent,
            jsxContent: widget.jsxContent,
            color: props.color || 'black',
            zoomScale: props.zoomScale || 1
          }
        },
        lastChangedClock: props.lastChangedClock || (shapeIndex + 2)
      };

      documents.push(widgetDocument);
      shapeIndex++;
    }

    // Add canvas-link shape records
    for (const canvasLink of canvasLinks) {
      const linkDocument = {
        state: canvasLink.properties,
        lastChangedClock: canvasLink.lastChangedClock || (shapeIndex + 2)
      };
      documents.push(linkDocument);
      shapeIndex++;
    }

    // Use existing metadata values or calculate defaults
    const totalClock = canvasMetadata?.clock || (documents.length + 1);

    return {
      clock: totalClock,
      documentClock: canvasMetadata?.documentClock || totalClock,
      tombstones: canvasMetadata?.tombstones || {},
      tombstoneHistoryStartsAtClock: canvasMetadata?.tombstoneHistoryStartsAtClock || 1,
      schema: canvasMetadata?.schema || {
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
      documents: documents
    };
  }
}

// Auto-execute
if (require.main === module) {
  try {
    const generator = new CanvasStateGenerator();
    generator.run().then(success => {
      if (success) {
        console.log('✅ Canvas state generation completed successfully');
        process.exit(0);
      } else {
        console.log('⚠️ Canvas state generation failed');
        process.exit(1);
      }
    }).catch(error => {
      console.error('❌ Error during canvas state generation:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to initialize canvas state generator:', error);
    process.exit(1);
  }
}

