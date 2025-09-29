#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Delete a widget directory and all its contents
 * @param {string} widgetPath - The absolute path to the widget directory
 */
function deleteWidget(widgetPath) {
  if (!widgetPath) {
    console.error('Error: Widget path is required');
    console.log('Usage: node delete-widget.js <widgetPath>');
    console.log('Arguments:');
    console.log('  widgetPath - The absolute path to the widget directory to delete');
    console.log('Example: node delete-widget.js /path/to/room-12345/widget-64jTHevUBL9azUJZ');
    process.exit(1);
  }

  // Validate that the widget path exists
  if (!fs.existsSync(widgetPath)) {
    console.error(`Error: Widget directory does not exist: ${widgetPath}`);
    process.exit(1);
  }

  // Validate that this is actually a widget directory
  const dirName = path.basename(widgetPath);
  if (!dirName.startsWith('widget-')) {
    console.error(`Error: Directory does not appear to be a widget directory (should start with 'widget-'): ${dirName}`);
    process.exit(1);
  }

  // Additional validation - check if it contains expected widget files
  const expectedFiles = ['properties.json', 'storage.json', 'template.jsx'];
  const hasWidgetFiles = expectedFiles.some(file => fs.existsSync(path.join(widgetPath, file)));
  
  if (!hasWidgetFiles) {
    console.warn(`Warning: Directory ${dirName} doesn't contain expected widget files, but proceeding with deletion...`);
  }

  // Get widget info before deletion for logging
  const roomPath = path.dirname(widgetPath);
  const roomId = path.basename(roomPath);
  
  console.log(`Deleting widget directory: ${dirName}`);
  console.log(`Room Path: ${roomPath}`);
  console.log(`Room ID: ${roomId}`);
  console.log(`Widget Path: ${widgetPath}`);

  try {
    // List files that will be deleted
    const files = fs.readdirSync(widgetPath);
    console.log('\n📁 Files to be deleted:');
    files.forEach(file => {
      const filePath = path.join(widgetPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isFile()) {
        console.log(`📄 ${file}`);
      } else if (stats.isDirectory()) {
        console.log(`📁 ${file}/`);
      }
    });

    // Recursively delete the widget directory
    fs.rmSync(widgetPath, { recursive: true, force: true });

    console.log('\n✅ Widget deleted successfully!');
    console.log(`🗑️  Removed: ${widgetPath}`);
    console.log(`\n🎯 Widget ${dirName} has been completely removed from ${roomId}`);

  } catch (error) {
    console.error('❌ Error deleting widget:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const widgetPath = args[0];

// Run the deletion
deleteWidget(widgetPath);
