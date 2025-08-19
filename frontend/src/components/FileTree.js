import React from 'react';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import { Checkbox, Box } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { FaFileCsv, FaFileAlt, FaFileCode, FaFile, FaFolder } from 'react-icons/fa';

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
  
  console.log('buildFileTree: Processing', files.length, 'files');
  console.log('buildFileTree: Sample files:', files.slice(0, 3).map(f => ({
    name: f?.name,
    webkitRelativePath: f?.webkitRelativePath,
    type: typeof f,
    isString: typeof f === 'string'
  })));
  
  const root = {};
  for (const file of files) {
    if (!file) continue; // Skip null/undefined files
    
    const path = file.webkitRelativePath || (typeof file === 'string' ? file : file.name);
    if (!path) continue; // Skip files without valid paths
    
    console.log('buildFileTree: Processing path:', path);
    const parts = path.split('/');
    console.log('buildFileTree: Path parts:', parts);
    
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`buildFileTree: Creating/accessing part ${i}: "${part}"`);
      
      if (!current[part]) {
        if (i === parts.length - 1) {
          // Last part - this is the file
          current[part] = { __file: path };
          console.log(`buildFileTree: Created file node for "${part}"`);
        } else {
          // Intermediate part - this is a folder
          current[part] = {};
          console.log(`buildFileTree: Created folder node for "${part}"`);
        }
      }
      current = current[part];
    }
  }
  
  console.log('buildFileTree: Final tree structure:', root);
  console.log('buildFileTree: Root keys:', Object.keys(root));
  
  return root;
}

// Helper: Recursively collect all file paths under a node
function collectAllFiles(node, path = '') {
  let files = [];
  for (const [key, value] of Object.entries(node)) {
    const currentPath = path ? `${path}/${key}` : key;
    if (value.__file) {
      // Skip folder placeholders
      if (key !== '.folder_placeholder') {
        files.push(value.__file);
      }
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
  isTreeData = false // New prop to indicate if files is already tree data
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
    
    // Only attach handlers if we have a valid tree
    if (tree && typeof tree === 'object') {
      function attachHandlers(node) {
        if (!node || typeof node !== 'object') return;
        
        for (const key in node) {
          if (node[key] && typeof node[key] === 'object') {
            if (node[key].__file) {
              node[key].selected = selectedFiles.includes(node[key].__file);
              node[key].onToggle = onFileToggle;
            } else {
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
  console.log('FileTree: treeData check:', { 
    treeData, 
    type: typeof treeData, 
    keys: Object.keys(treeData || {}),
    length: Object.keys(treeData || {}).length 
  });
  
  if (!treeData || (typeof treeData === 'object' && Object.keys(treeData).length === 0)) {
    console.log('FileTree: Early return triggered');
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        No files to display
      </Box>
    );
  }
  
  console.log('FileTree: Proceeding to render tree');

  // Helper: Recursively render the tree
  function renderTree(node, path = '') {
    console.log('renderTree called with:', { node, path, nodeKeys: Object.keys(node || {}) });
    
    if (!node || typeof node !== 'object') {
      console.log('renderTree: Invalid node, returning null');
      return null;
    }
    
    const elements = Object.entries(node).map(([key, value], idx) => {
      console.log('Processing tree item:', { key, value, hasFile: value && value.__file, isObject: typeof value === 'object' });
      const id = path ? `${path}/${key}` : key;
      
      if (value && value.__file) {
        // Skip folder placeholders - don't render them
        if (key === '.folder_placeholder') {
          console.log('Skipping folder placeholder:', key);
          return null;
        }
        
        // File node
        console.log('Rendering file:', key);
        return (
          <TreeItem key={id} itemId={id} label={
            <span>
              <Checkbox
                checked={value.selected || false}
                onChange={() => value.onToggle && value.onToggle(value.__file)}
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
        console.log('Rendering folder:', key, 'with children:', Object.keys(value));
        const childElements = renderTree(value, id);
        const hasVisibleChildren = childElements && childElements.some(child => child !== null);
        
        console.log('Folder has visible children:', hasVisibleChildren);
        
        const { checked, indeterminate } = getFolderCheckboxState(value, selectedFiles, id);
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
              <FaFolder color="#f4a261" style={{ marginRight: 8 }} />
              {key} ({Object.keys(value).length} items)
            </span>
          }>
            {childElements}
          </TreeItem>
        );
      }
      return null;
    }).filter(element => element !== null);
    
    console.log('renderTree returning elements:', elements);
    return elements;
  }

  const treeElements = renderTree(treeData);
  
  return (
    <SimpleTreeView
      aria-label="file tree"
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpandIcon={<ChevronRightIcon />}
      sx={{ height, flexGrow: 1, maxWidth, overflowY: 'auto', mb: 2 }}
    >
      {treeElements}
    </SimpleTreeView>
  );
}

// Export helper functions for use in other components
export { buildFileTree, collectAllFiles, getFolderCheckboxState, getFileIcon };