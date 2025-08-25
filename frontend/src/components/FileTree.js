import React from 'react';
import { Checkbox, Box, IconButton, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { FaFileCsv, FaFileAlt, FaFileCode, FaFile, FaFolder, FaFilePdf, FaTrash } from 'react-icons/fa';

// Helper function to get file icon
function getFileIcon(filename) {
  if (filename.endsWith('.csv')) return <FaFileCsv color="#2a9d8f" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.json')) return <FaFileCode color="#e76f51" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.parquet')) return <FaFileAlt color="#264653" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.pdf')) return <FaFilePdf color="#e74c3c" style={{ marginRight: 8 }} />;
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
  onDelete = null, // New prop for delete functionality
  renderFileActions = null,
  height = 400,
  maxWidth = 600,
  isTreeData = false // New prop to indicate if files is already tree data
}) {
  console.log('FileTree: Component re-rendering with props:', { 
    filesLength: files?.length, 
    selectedFilesLength: selectedFiles?.length,
    height,
    maxWidth,
    isTreeData
  });
  // State to track which folders are expanded
  const [expandedItems, setExpandedItems] = React.useState(() => {
    // Try to restore expansion state from localStorage
    try {
      const saved = localStorage.getItem('fileTreeExpanded');
      console.log('FileTree: Restoring expansion state from localStorage:', saved);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  

  
  console.log('FileTree: Current expandedItems state:', expandedItems);
  
  // Log when expandedItems changes
  React.useEffect(() => {
    console.log('FileTree: expandedItems state changed to:', expandedItems);
  }, [expandedItems]);
  
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
  
  // Auto-expand folders that contain selected files
  React.useEffect(() => {
    if (selectedFiles && selectedFiles.length > 0 && treeData) {
      const foldersToExpand = new Set();
      
      const findFoldersForFiles = (node, path = '') => {
        for (const [key, value] of Object.entries(node)) {
          if (key.startsWith('__')) continue;
          
          if (value && value.__file) {
            // This is a file, check if it's selected
            if (selectedFiles.includes(value.__file)) {
              // Add all parent folders to expansion list
              const pathParts = path.split('/').filter(Boolean);
              let currentPath = '';
              pathParts.forEach(part => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                foldersToExpand.add(currentPath);
              });
            }
          } else if (value && typeof value === 'object' && !value.__file) {
            // This is a folder, recursively check
            const newPath = path ? `${path}/${key}` : key;
            findFoldersForFiles(value, newPath);
          }
        }
      };
      
      findFoldersForFiles(treeData);
      
      // Only expand folders that aren't already manually expanded
      setExpandedItems(prev => {
        const newExpanded = new Set(prev);
        foldersToExpand.forEach(folder => {
          if (!prev.includes(folder)) {
            newExpanded.add(folder);
          }
        });
        const result = Array.from(newExpanded);
        console.log('FileTree: Auto-expanding folders, new state:', result);
        return result;
      });
    }
  }, [selectedFiles, treeData]);
  
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
  function renderTree(node, path = '', depth = 0) {
    console.log('renderTree called with:', { node, path, depth, nodeKeys: Object.keys(node || {}) });
    
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
          <Box key={id} sx={{ pl: (depth + 1) * 3, py: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={value.selected || false}
                  onChange={() => value.onToggle && value.onToggle(value.__file)}
                  size="small"
                  sx={{ p: 0, mr: 1 }}
                />
                {getFileIcon(key)}
                <span>{key}</span>
                {renderFileActions && renderFileActions(value.__file)}
              </Box>
              
              {onDelete && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete file "${key}"?`)) {
                      onDelete(value.__file, 'file');
                    }
                  }}
                  sx={{ p: 0.5, ml: 1 }}
                  title="Delete file"
                >
                  <FaTrash size={14} />
                </IconButton>
              )}
            </Box>
          </Box>
        );
      } else if (value && typeof value === 'object') {
        // Folder node
        console.log('Rendering folder:', key, 'with children:', Object.keys(value));
        const childElements = renderTree(value, id, depth + 1);
        const hasVisibleChildren = childElements && childElements.some(child => child !== null);
        const isExpanded = expandedItems.includes(id);
        
        console.log('Folder has visible children:', hasVisibleChildren);
        
        const { checked, indeterminate } = getFolderCheckboxState(value, selectedFiles, id);
        return (
          <Box key={id} sx={{ pl: depth * 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  onClick={() => {
                    console.log('FileTree: Toggling folder expansion for:', id, 'Current expanded:', expandedItems);
                    setExpandedItems(prev => {
                      const newExpanded = prev.includes(id) 
                        ? prev.filter(item => item !== id)
                        : [...prev, id];
                      
                      console.log('FileTree: New expanded state:', newExpanded);
                      
                      // Save to localStorage
                      try {
                        localStorage.setItem('fileTreeExpanded', JSON.stringify(newExpanded));
                        console.log('FileTree: Saved to localStorage:', newExpanded);
                      } catch (e) {
                        console.warn('Could not save expansion state:', e);
                      }
                      
                      return newExpanded;
                    });
                  }}
                  sx={{ p: 0.5, mr: 0.5 }}
                >
                  {isExpanded ? <ExpandMoreIcon /> : <ChevronRightIcon />}
                </IconButton>
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
                <span style={{ cursor: 'pointer', flex: 1 }}>
                  {key}
                </span>
              </Box>
              
              {onDelete && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete folder "${key}" and all its contents?`)) {
                      onDelete(id, 'folder');
                    }
                  }}
                  sx={{ p: 0.5, ml: 1 }}
                  title="Delete folder and all contents"
                >
                  <FaTrash size={14} />
                </IconButton>
              )}
            </Box>
            <Collapse in={isExpanded}>
              {childElements}
            </Collapse>
          </Box>
        );
      }
      return null;
    }).filter(element => element !== null);
    
    console.log('renderTree returning elements:', elements);
    return elements;
  }

  const treeElements = renderTree(treeData, '', 0);
  
  // Calculate total files and selected files
  const totalFiles = files ? files.length : 0;
  const selectedCount = selectedFiles ? selectedFiles.length : 0;
  
  return (
    <Box sx={{ height, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{ 
          flexGrow: 1, 
          maxWidth, 
          overflowY: 'auto', 
          mb: 1,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 1
        }}
      >
        {treeElements}
      </Box>
      
      {/* Footer with file statistics */}
      <Box sx={{ 
        borderTop: 1, 
        borderColor: 'divider', 
        p: 1.5, 
        backgroundColor: 'background.paper',
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.875rem',
        color: 'text.secondary'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            backgroundColor: 'primary.main' 
          }} />
          <span>Local Files: {totalFiles} available</span>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          color: selectedCount > 0 ? 'primary.main' : 'text.secondary',
          fontWeight: selectedCount > 0 ? 'medium' : 'normal'
        }}>
          <span>Selected: {selectedCount} files</span>
        </Box>
      </Box>
      

    </Box>
  );
}

// Export helper functions for use in other components
export { buildFileTree, collectAllFiles, getFolderCheckboxState, getFileIcon };