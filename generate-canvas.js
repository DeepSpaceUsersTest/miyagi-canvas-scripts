/**
 * Canvas State Generation Script
 * Generates canvas-state.json from all widgets and sub-canvases
 */

const fs = require('fs');
const path = require('path');

function generateCanvasState() {
  console.log('🎨 Generating canvas state...');
  
  const currentDir = process.cwd();
  
  // Process root canvas and all sub-canvases
  const canvasData = processCanvas(currentDir, true);
  
  if (!canvasData) {
    console.log('⚠️ No canvas data found - exiting');
    return null;
  }
  
  // Generate tldraw RoomSnapshot
  const roomSnapshot = generateRoomSnapshot(canvasData);
  
  // Write canvas-state.json
  const outputPath = path.join(currentDir, 'canvas-state.json');
  fs.writeFileSync(outputPath, JSON.stringify(roomSnapshot, null, 2));
  
  console.log(`✅ Generated canvas-state.json with ${canvasData.widgets.length} widgets`);
  return true;
}

function processCanvas(canvasDir, isRoot = false) {
  const entries = fs.readdirSync(canvasDir, { withFileTypes: true });
  
  // Find widget directories
  const shapeDirectories = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('shape-'))
    .map(entry => entry.name);
  
  console.log(`📁 Found ${shapeDirectories.length} widget directories in ${isRoot ? 'root' : path.basename(canvasDir)}: ${shapeDirectories.join(', ')}`);
  
  // Load canvas metadata
  let canvasMetadata = null;
  const metadataPath = path.join(canvasDir, 'canvas-metadata.json');
  if (fs.existsSync(metadataPath)) {
    try {
      canvasMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    } catch (error) {
      console.error(`❌ Error loading canvas metadata from ${metadataPath}:`, error);
    }
  }
  
  // Load global storage
  let globalStorage = {};
  const globalStoragePath = path.join(canvasDir, 'global-storage.json');
  if (fs.existsSync(globalStoragePath)) {
    try {
      const storageData = JSON.parse(fs.readFileSync(globalStoragePath, 'utf8'));
      globalStorage = storageData.global || {};
    } catch (error) {
      console.error(`❌ Error loading global storage from ${globalStoragePath}:`, error);
    }
  }
  
  const widgets = [];
  const widgetStorage = {};
  
  // Load each widget
  for (const shapeId of shapeDirectories) {
    console.log(`🔄 Processing widget: ${shapeId}`);
    const widgetDir = path.join(canvasDir, shapeId);
    const widget = { 
      shapeId,
      properties: null, 
      jsxTemplate: null, 
      htmlTemplate: null,
      storage: {}
    };
    
    try {
      // Load properties.json
      const propertiesPath = path.join(widgetDir, 'properties.json');
      if (fs.existsSync(propertiesPath)) {
        widget.properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
      }
      
      // Load template.jsx
      const jsxPath = path.join(widgetDir, 'template.jsx');
      if (fs.existsSync(jsxPath)) {
        widget.jsxTemplate = fs.readFileSync(jsxPath, 'utf8');
      }
      
      // Load template.html
      const htmlPath = path.join(widgetDir, 'template.html');
      if (fs.existsSync(htmlPath)) {
        widget.htmlTemplate = fs.readFileSync(htmlPath, 'utf8');
      }
      
      // Load storage.json
      const storagePath = path.join(widgetDir, 'storage.json');
      if (fs.existsSync(storagePath)) {
        try {
          const storageData = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
          widget.storage = storageData;
        } catch (error) {
          console.error(`❌ Error loading storage for ${shapeId}:`, error);
        }
      }
      
      if (widget.properties && widget.jsxTemplate && widget.htmlTemplate) {
        widgets.push(widget);
        
        // Extract widget config for canvas_storage after all data is loaded
        if (widget.storage.__widget_config) {
          // Use the actual shape ID from properties, not the directory name
          const actualShapeId = widget.properties.id || `shape:${shapeId}`;
          widgetStorage[actualShapeId] = {
            __widget_config: widget.storage.__widget_config
          };
        }
        
        console.log(`✅ Loaded widget: ${shapeId}`);
      } else {
        console.log(`⚠️ Skipping incomplete widget: ${shapeId}`);
      }
      
    } catch (error) {
      console.error(`❌ Error loading widget ${shapeId}:`, error);
    }
  }
  
  return {
    canvasMetadata,
    globalStorage,
    widgetStorage,
    widgets,
    isRoot
  };
}

function generateRoomSnapshot(canvasData) {
  const { canvasMetadata, globalStorage, widgetStorage, widgets } = canvasData;
  
  // Extract canvas info from metadata
  const roomId = canvasMetadata?.canvas?.roomId || 'room-generated';
  const canvasMode = canvasMetadata?.canvas?.canvasMode || 'freeform';
  const canvasName = canvasMetadata?.canvas?.canvasName || 'Generated Canvas';
  const gridSize = canvasMetadata?.canvas?.gridSize || 10;
  const pageId = canvasMetadata?.page?.id || 'page:page';
  const pageName = canvasMetadata?.page?.name || 'Page 1';
  
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
      lastChangedClock: 2
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
      lastChangedClock: 0
    },
    // Canvas storage record - CRITICAL for widget storage
    {
      state: {
        widgets: widgetStorage,
        global: globalStorage,
        id: 'canvas_storage:main',
        typeName: 'canvas_storage'
      },
      lastChangedClock: widgets.length + 2
    }
  ];

  // Add widget shape records
  let widgetIndex = 1;
  for (const widget of widgets) {
    const shapeId = widget.shapeId;
    const props = widget.properties;
    
    const widgetDocument = {
      state: {
        id: props.id || `shape:${shapeId}`,
        typeName: 'shape',
        type: 'miyagi-widget',
        parentId: props.parentId || pageId,
        index: props.index || `a${widgetIndex}`,
        x: props.x || (widgetIndex * 50),
        y: props.y || (widgetIndex * 50),
        rotation: props.rotation || 0,
        isLocked: props.isLocked || false,
        opacity: props.opacity || 1,
        meta: props.meta || {
          initializationState: 'ready'
        },
        props: {
          w: props.w || 300,
          h: props.h || 200,
          widgetId: props.widgetId || `${props.templateHandle || 'widget'}_${Date.now()}`,
          templateHandle: props.templateHandle || 'notepad-react-test',
          htmlContent: widget.htmlTemplate,
          jsxContent: widget.jsxTemplate,
          color: props.color || 'black',
          zoomScale: props.zoomScale || 1
        }
      },
      lastChangedClock: widgetIndex + 2
    };

    documents.push(widgetDocument);
    widgetIndex++;
  }

  // Calculate proper clock values
  const totalClock = documents.length + 1;

  return {
    clock: totalClock,
    documentClock: totalClock,
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
    documents: documents
  };
}

// Auto-execute
try {
  const result = generateCanvasState();
  if (result) {
    console.log('✅ Canvas state generated successfully');
  } else {
    console.log('⚠️ No canvas state generated');
  }
} catch (error) {
  console.error('❌ Error generating canvas state:', error);
  process.exit(1);
}
