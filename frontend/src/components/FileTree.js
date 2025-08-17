import React from 'react';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { Checkbox, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { FaFileCsv, FaFileAlt, FaFileCode, FaFile } from 'react-icons/fa';

// Helper function to get file icon
function getFileIcon(filename) {
  if (filename.endsWith('.csv')) return <FaFileCsv color="#2a9d8f" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.json')) return <FaFileCode color="#e76f51" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.parquet')) return <FaFileAlt color="#264653" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.txt')) return <FaFileAlt color="#6d6875" style={{ marginRight: 8 }} />;
  return <FaFile style={{ marginRight: 8 }} />;
}

// Helper: Build a tree from file paths
function buildFileTree(files) {
  if (!files || !Array.isArray(files)) {
    console.warn('buildFileTree: files parameter is not a valid array:', files);
    return {};
  }
  
  console.log('buildFileTree input:', files);
  
  const root = {};
  
  // Process each file/folder path to build the tree structure
  for (const item of files) {
    if (!item) continue;
    
    const path = item.webkitRelativePath || (typeof item === 'string' ? item : item.name);
    if (!path) continue;
    
    console.log('Processing path:', path);
    
    // Handle S3-style paths that end with '/' for folders
    const isFolder = path.endsWith('/');
    
    if (isFolder) {
      // This is a folder path like "click-bench/"
      const folderName = path.slice(0, -1); // Remove trailing slash
      console.log('Creating folder:', folderName);
      
      if (!root[folderName]) {
        root[folderName] = {}; // Create empty folder object
      }
    } else {
      // This is a file path - parse it to build folder structure
      const pathParts = path.split('/');
      console.log('File path parts:', pathParts);
      
      if (pathParts.length === 1) {
        // File at root level
        const fileName = pathParts[0];
        root[fileName] = { __file: path };
        console.log('Added root file:', fileName);
      } else {
        // File in a folder - build the folder structure
        let currentLevel = root;
        
        // Create folder structure for all parts except the last (which is the filename)
        for (let i = 0; i < pathParts.length - 1; i++) {
          const folderName = pathParts[i];
          if (!currentLevel[folderName]) {
            currentLevel[folderName] = {};
            console.log('Created folder level:', folderName);
          }
          currentLevel = currentLevel[folderName];
        }
        
        // Add the file at the current level
        const fileName = pathParts[pathParts.length - 1];
        currentLevel[fileName] = { __file: path };
        console.log('Added file in folder:', fileName, 'at path:', path);
      }
    }
  }
  
  console.log('buildFileTree result:', root);
  return root;
}

// Helper: Recursively collect all file paths under a node
function collectAllFiles(node, path = '') {
  let files = [];
  for (const [key, value] of Object.entries(node)) {
    const currentPath = path ? `${path}/${key}` : key;
    if (value.__file) {
      files.push(value.__file);
    } else {
      files = files.concat(collectAllFiles(value, currentPath));
    }
  }
  return files;
}

// Helper: Calculate folder checkbox state
function getFolderCheckboxState(node, selectedFiles, path = '') {
  const allFiles = collectAllFiles(node, path);
  const selectedCount = allFiles.filter(f => selectedFiles.includes(f)).length;
  if (selectedCount === 0) return { checked: false, indeterminate: false };
  if (selectedCount === allFiles.length) return { checked: true, indeterminate: false };
  return { checked: false, indeterminate: true };
}

export default function FileTree({ 
  files, 
  selectedFiles, 
  onFileToggle, 
  onFolderToggle, 
  renderFileActions = null,
  height = 400,
  maxWidth = 600,
  isTreeData = false, // New prop to indicate if files is already tree data
  onFolderExpand = null // New prop for lazy loading folder contents
}) {
  
  // Build tree data with handlers attached
  const treeData = React.useMemo(() => {
    let tree;
    
    // Add defensive checks
    if (!files) {
      return {};
    }
    
    if (isTreeData) {
      // If files is already tree data, use it directly
      tree = files;
    } else {
      // Otherwise, build tree from file array
      if (!Array.isArray(files)) {
        return {};
      }
      tree = buildFileTree(files);
    }
    
    // Always attach handlers if we have a valid tree
    if (tree && typeof tree === 'object') {
      function attachHandlers(node) {
        if (!node || typeof node !== 'object') return;
        
        for (const key in node) {
          if (node[key] && typeof node[key] === 'object') {
            if (node[key].__file) {
              // File node - attach selection state and toggle handler
              node[key].selected = selectedFiles.includes(node[key].__file);
              node[key].onToggle = onFileToggle;
            } else {
              // Folder node - recursively attach handlers
              attachHandlers(node[key]);
            }
          }
        }
      }
      attachHandlers(tree);
    }
    
    return tree;
  }, [files, selectedFiles, onFileToggle, isTreeData]);
  
  // Early return if no files or invalid data
  if (!treeData || (typeof treeData === 'object' && Object.keys(treeData).length === 0)) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        No files to display
      </Box>
    );
  }

  // Helper: Recursively render the tree
  function renderTree(node, path = '') {
    console.log('FileTree: renderTree called with:', { node, path, keys: Object.keys(node) });
    
    if (!node || typeof node !== 'object') {
      console.log('FileTree: renderTree early return - invalid node');
      return null;
    }
    
    const elements = Object.entries(node).map(([key, value], idx) => {
      const id = path ? `${path}/${key}` : key;
      console.log('FileTree: Processing node:', { key, value, id, hasFile: value && value.__file });
      
      if (value && value.__file) {
        // File node
        console.log('FileTree: Creating file node for:', key);
        return (
          <TreeItem key={id} itemId={id} label={
            <span>
              <Checkbox
                checked={value.selected || false}
                onChange={(e) => {
                  e.stopPropagation();
                  value.onToggle && value.onToggle(value.__file);
                }}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              {getFileIcon(key)}{key}
              {renderFileActions && renderFileActions(value.__file)}
            </span>
          } />
        );
      } else if (value && typeof value === 'object') {
        // Folder node
        console.log('FileTree: Creating folder node for:', key);
        const { checked, indeterminate } = getFolderCheckboxState(value, selectedFiles, id);
        
        // Check if folder has content (is expandable)
        const hasContent = Object.keys(value).length > 0;
        
        return (
          <TreeItem key={id} itemId={id} label={
            <span>
              <Checkbox
                checked={checked}
                indeterminate={indeterminate}
                onChange={(e) => {
                  e.stopPropagation();
                  onFolderToggle(value, id);
                }}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              <span 
                style={{ 
                  marginLeft: '4px', 
                  cursor: hasContent ? 'pointer' : 'default',
                  color: hasContent ? '#1976d2' : '#666'
                }}
              >
                📁 {key}
              </span>
            </span>
          }>
            {hasContent ? renderTree(value, id) : null}
          </TreeItem>
        );
      }
      return null;
    });
    
    console.log('FileTree: renderTree returning elements:', elements);
    return elements;
  }

  const treeElements = renderTree(treeData);
  console.log('FileTree: renderTree result:', treeElements);
  console.log('FileTree: treeElements length:', treeElements ? treeElements.length : 'null');
  
  // Debug: Check if treeElements are valid React components
  if (treeElements && Array.isArray(treeElements)) {
    treeElements.forEach((element, index) => {
      console.log(`Tree element ${index}:`, element);
      console.log(`Tree element ${index} type:`, typeof element);
      console.log(`Tree element ${index} is React element:`, React.isValidElement(element));
    });
  }
  
  return (
    <SimpleTreeView
      aria-label="file tree"
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      sx={{ height, flexGrow: 1, maxWidth, overflowY: 'auto' }}
    >
      {treeElements}
    </SimpleTreeView>
  );
}

// Export helper functions for use in other components
export { buildFileTree, collectAllFiles, getFolderCheckboxState, getFileIcon };
