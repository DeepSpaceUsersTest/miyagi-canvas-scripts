#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Count occurrences of 'room-' in a path to determine if it's a root room
 * @param {string} roomPath - The absolute path to the room directory
 * @returns {number} Number of 'room-' occurrences in the path
 */
function countRoomOccurrences(roomPath) {
  const pathParts = roomPath.split(path.sep);
  let count = 0;
  
  for (const part of pathParts) {
    if (part.startsWith('room-')) {
      count++;
    }
  }
  return count;
}

/**
 * Delete a room directory and all its contents
 * @param {string} roomPath - The absolute path to the room directory
 */
function deleteRoom(roomPath) {
  if (!roomPath) {
    console.error('Error: Room path is required');
    console.log('Usage: node delete-room.js <roomPath>');
    console.log('Arguments:');
    console.log('  roomPath - The absolute path to the room directory to delete');
    console.log('Example: node delete-room.js /path/to/room-12345');
    console.log('\nSafety: Root rooms cannot be deleted (must have at least 2 "room-" directories in path)');
    process.exit(1);
  }

  // Validate that the room path exists
  if (!fs.existsSync(roomPath)) {
    console.error(`Error: Room directory does not exist: ${roomPath}`);
    process.exit(1);
  }

  // Validate that this is actually a room directory
  const dirName = path.basename(roomPath);
  if (!dirName.startsWith('room-')) {
    console.error(`Error: Directory does not appear to be a room directory (should start with 'room-'): ${dirName}`);
    process.exit(1);
  }

  // Safety check: Prevent deletion of root room
  const roomCount = countRoomOccurrences(roomPath);
  if (roomCount < 2) {
    console.error(`Error: Cannot delete root room. Path must contain at least 2 'room-' directories.`);
    console.error(`Current path contains ${roomCount} 'room-' director${roomCount === 1 ? 'y' : 'ies'}: ${roomPath}`);
    console.error('This safety check prevents accidental deletion of the main room.');
    process.exit(1);
  }

  console.log(`Deleting room directory: ${dirName}`);
  console.log(`Room Path: ${roomPath}`);
  console.log(`Room Count in Path: ${roomCount} (safe to delete)`);

  try {
    // Recursively delete the room directory
    fs.rmSync(roomPath, { recursive: true, force: true });

    console.log('\n✅ Room deleted successfully!');
    console.log(`🗑️  Removed: ${roomPath}`);
    console.log(`\n🎯 Room ${dirName} has been permanently deleted`);

  } catch (error) {
    console.error('❌ Error deleting room:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const roomPath = args[0];

// Run the deletion
deleteRoom(roomPath);

