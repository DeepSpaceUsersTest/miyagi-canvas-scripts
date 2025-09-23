/**
 * Canvas State Generation Script
 * Generates canvas-state.json from all widgets
 */

const fs = require('fs');
const path = require('path');

function generateCanvasState() {
  console.log('🎨 Generating canvas state...');
  
  const currentDir = process.cwd();
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  
  // Find all widget directories
  const shapeDirectories = entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('shape-'))
    .map(entry => entry.name);
  
  console.log(`📁 Found ${shapeDirectories.length} widget directories: ${shapeDirectories.join(', ')}`);
  
  if (shapeDirectories.length === 0) {
    console.log('⚠️ No widget directories found - exiting');
    return null;
  }
  
  const widgets = {};
  
  // Load each widget
  for (const shapeId of shapeDirectories) {
    console.log(`🔄 Processing widget: ${shapeId}`);
    const widgetDir = path.join(currentDir, shapeId);
    const widget = { properties: null, jsxTemplate: null, htmlTemplate: null };
    
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
      
      if (widget.properties && widget.jsxTemplate && widget.htmlTemplate) {
        widgets[shapeId] = widget;
        console.log(`✅ Loaded widget: ${shapeId}`);
      } else {
        console.log(`⚠️ Skipping incomplete widget: ${shapeId}`);
      }
      
    } catch (error) {
      console.error(`❌ Error loading widget ${shapeId}:`, error);
    }
  }
  
  // Generate tldraw RoomSnapshot
  const roomSnapshot = generateRoomSnapshot(widgets);
  
  // Write canvas-state.json
  const outputPath = path.join(currentDir, 'canvas-state.json');
  fs.writeFileSync(outputPath, JSON.stringify(roomSnapshot, null, 2));
  
  console.log(`✅ Generated canvas-state.json with ${Object.keys(widgets).length} widgets`);
  return true;
}

function generateRoomSnapshot(widgets) {
  const documents = [
    {
      state: {
        gridSize: 10,
        name: '',
        meta: {},
        id: 'document:document',
        typeName: 'document'
      },
      lastChangedClock: 0
    },
    {
      state: {
        meta: {},
        id: 'page:page',
        name: 'Page 1',
        index: 'a1',
        typeName: 'page'
      },
      lastChangedClock: 0
    }
  ];

  let widgetIndex = 1;
  for (const [shapeId, widget] of Object.entries(widgets)) {
    const widgetDocument = {
      state: {
        id: `shape:${shapeId}`,
        typeName: 'shape',
        type: 'miyagi-widget',
        parentId: 'page:page',
        index: `a${widgetIndex}`,
        x: widget.properties.x || (widgetIndex * 50),
        y: widget.properties.y || (widgetIndex * 50),
        rotation: 0,
        isLocked: false,
        opacity: 1,
        props: {
          w: widget.properties.w || 200,
          h: widget.properties.h || 150,
          widgetId: `github-${shapeId}`,
          templateHandle: widget.properties.templateHandle || 'notepad-react-test',
          htmlContent: widget.htmlTemplate,
          jsxContent: widget.jsxTemplate,
          color: widget.properties.color || 'black',
          zoomScale: 1,
          isFullscreen: false,
        },
        meta: {
          githubSync: true,
          shapeId: shapeId,
          lastUpdated: new Date().toISOString()
        }
      },
      lastChangedClock: widgetIndex
    };

    documents.push(widgetDocument);
    widgetIndex++;
  }

  return {
    clock: documents.length,
    documentClock: documents.length,
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
