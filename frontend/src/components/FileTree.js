import React from 'react';
import { Checkbox, Box, IconButton, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { FaFileCsv, FaFileAlt, FaFileCode, FaFile, FaFolder, FaFilePdf, FaTrash, FaTable, FaEye, FaDatabase } from 'react-icons/fa';
import TablePreviewDialog from './TablePreviewDialog';

// Helper function to get file icon
function getFileIcon(filename, isPostgresTable = false) {
  // PostgreSQL tables
  if (isPostgresTable) {
    return <FaTable color="#336791" style={{ marginRight: 8 }} />;
  }
  
  // File extensions
  if (filename.endsWith('.csv')) return <FaFileCsv color="#2a9d8f" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.json')) return <FaFileCode color="#e76f51" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.parquet')) return <FaFileAlt color="#264653" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.pdf')) return <FaFilePdf color="#e74c3c" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.txt')) return <FaFileAlt color="#6d6875" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.sql')) return <FaFileCode color="#f4a261" style={{ marginRight: 8 }} />;
  
  return <FaFile style={{ marginRight: 8 }} />;
}

// Helper function to get folder icon (for PostgreSQL schemas)
function getFolderIcon(folderName, files) {
  // Check if this folder contains PostgreSQL objects (schema.table format)
  const hasPostgresObjects = files.some(file => {
    const path = file.webkitRelativePath || (typeof file === 'string' ? file : file.name);
    return path && path.includes('.') && !path.includes('/') && path.startsWith(folderName + '.');
  });
  
  if (hasPostgresObjects) {
    return <FaDatabase color="#336791" style={{ marginRight: 8 }} />;
  }
  
  return <FaFolder color="#f4a261" style={{ marginRight: 8 }} />;
}

// Helper: Build a tree from file paths
function buildFileTree(files, dataSource = 'local') {
  if (!files || !Array.isArray(files)) {
    console.warn('buildFileTree: files parameter is not a valid array:', files);
    return {};
  }
  
  const root = {};
  
  if (dataSource === 'postgres') {
    // Special handling for PostgreSQL: group by schema
    for (const file of files) {
      if (!file) continue;
      
      const tableName = file.webkitRelativePath || (typeof file === 'string' ? file : file.name);
      if (!tableName) continue;
      
      // Check if this is a schema.table format
      if (tableName.includes('.') && !tableName.includes('/')) {
        const [schema, table] = tableName.split('.');
        
        // Create schema folder if it doesn't exist
        if (!root[schema]) {
          root[schema] = {};
        }
        
        // Add table as a file within the schema
        root[schema][table] = { __file: tableName };
      } else {
        // Fallback for non-schema.table format
        root[tableName] = { __file: tableName };
      }
    }
  } else {
    // Original logic for local files
    for (const file of files) {
      if (!file) continue; // Skip null/undefined files
      
      const path = file.webkitRelativePath || (typeof file === 'string' ? file : file.name);
      if (!path) continue; // Skip files without valid paths
      
      const parts = path.split('/');
      
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (!current[part]) {
          if (i === parts.length - 1) {
            // Last part - this is the file
            current[part] = { __file: path };
          } else {
            // Intermediate part - this is a folder
            current[part] = {};
          }
        }
        current = current[part];
      }
    }
  }
  
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
  isTreeData = false, // New prop to indicate if files is already tree data
  dataSource = 'local', // New prop to indicate data source type
  postgresConfig = null // New prop for PostgreSQL connection details
}) {
  // State to track which folders are expanded
  const [expandedItems, setExpandedItems] = React.useState(() => {
    // Try to restore expansion state from localStorage
    try {
      const saved = localStorage.getItem('fileTreeExpanded');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State for table preview dialog
  const [previewDialogOpen, setPreviewDialogOpen] = React.useState(false);
  const [previewData, setPreviewData] = React.useState(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState(null);

  // Function to handle table preview
  const handleTablePreview = async (tableName) => {
    if (dataSource !== 'postgres' || !postgresConfig) return;
    
    setPreviewDialogOpen(true);
    setPreviewLoading(true);
    setPreviewError(null);
    
    try {
      const response = await fetch('http://localhost:8080/rest/postgres-table-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...postgresConfig,
          table: tableName
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setPreviewData(data);
    } catch (error) {
      console.error('Error fetching table preview:', error);
      setPreviewError(error.message);
    } finally {
      setPreviewLoading(false);
    }
  };
  

  

  
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
      tree = buildFileTree(files, dataSource);
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
  
  // Auto-expand PostgreSQL schema folders by default
  React.useEffect(() => {
    if (dataSource === 'postgres' && treeData && Object.keys(treeData).length > 0) {
      // Get all top-level folders (schemas) and expand them by default
      const schemasToExpand = Object.keys(treeData).filter(key => 
        treeData[key] && typeof treeData[key] === 'object' && !treeData[key].__file
      );
      
      setExpandedItems(prev => {
        const newExpanded = new Set(prev);
        schemasToExpand.forEach(schema => {
          newExpanded.add(schema);
        });
        const result = Array.from(newExpanded);
        return result;
      });
    }
  }, [dataSource, treeData]);

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
        return result;
      });
    }
  }, [selectedFiles, treeData]);
  
  // Early return if no files or invalid data
  if (!treeData || (typeof treeData === 'object' && Object.keys(treeData).length === 0)) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
        No files to display
      </Box>
    );
  }

  // Helper: Recursively render the tree
  function renderTree(node, path = '', depth = 0) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    
    const elements = Object.entries(node).map(([key, value], idx) => {
      const id = path ? `${path}/${key}` : key;
      
      if (value && value.__file) {
        // Skip folder placeholders - don't render them
        if (key === '.folder_placeholder') {
          return null;
        }
        
        // File node
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
                {getFileIcon(key, dataSource === 'postgres' && value.__file && value.__file.includes('.'))}
                <span 
                  style={{ 
                    cursor: dataSource === 'postgres' && value.__file && value.__file.includes('.') ? 'pointer' : 'default',
                    textDecoration: dataSource === 'postgres' && value.__file && value.__file.includes('.') ? 'underline' : 'none',
                    fontSize: '0.9rem',
                    fontWeight: '500'
                  }}
                  onClick={() => {
                    if (dataSource === 'postgres' && value.__file && value.__file.includes('.') && !value.__file.includes('/')) {
                      handleTablePreview(value.__file);
                    }
                  }}
                >
                  {key}
                </span>
                {renderFileActions && renderFileActions(value.__file)}
              </Box>
              
              {onDelete && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${key}"?`)) {
                      onDelete(value.__file, 'file');
                    }
                  }}
                  sx={{ p: 0.5, ml: 1 }}
                  title="Delete file"
                >
                  <FaTrash size={14} color="#666666" />
                </IconButton>
              )}
            </Box>
          </Box>
        );
      } else if (value && typeof value === 'object') {
        // Folder node
        const childElements = renderTree(value, id, depth + 1);
        const hasVisibleChildren = childElements && childElements.some(child => child !== null);
        const isExpanded = expandedItems.includes(id);
        
        const { checked, indeterminate } = getFolderCheckboxState(value, selectedFiles, id);
        return (
          <Box key={id} sx={{ pl: depth * 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <IconButton
                  size="small"
                  onClick={() => {
                    setExpandedItems(prev => {
                      const newExpanded = prev.includes(id) 
                        ? prev.filter(item => item !== id)
                        : [...prev, id];
                      
                      // Save to localStorage
                      try {
                        localStorage.setItem('fileTreeExpanded', JSON.stringify(newExpanded));
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
                {getFolderIcon(key, files)}
                <span style={{ 
                  cursor: 'pointer', 
                  flex: 1,
                  fontSize: '1rem',
                  fontWeight: '600'
                }}>
                  {key}
                </span>
              </Box>
              
              {onDelete && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${key}" and all its contents?`)) {
                      onDelete(id, 'folder');
                    }
                  }}
                  sx={{ p: 0.5, ml: 1 }}
                  title="Delete folder and all contents"
                >
                  <FaTrash size={14} color="#666666" />
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
        fontSize: '0.9rem',
        color: 'text.secondary'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            backgroundColor: 'primary.main' 
          }} />
          <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
            {dataSource === 'postgres' ? 'Database Objects' : 
             dataSource === 's3' ? 'S3 Objects' : 
             'Local Files'}: {totalFiles} available
          </span>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          color: selectedCount > 0 ? 'primary.main' : 'text.secondary',
          fontWeight: selectedCount > 0 ? '600' : '500'
        }}>
          <span style={{ fontSize: '0.9rem' }}>Selected: {selectedCount} {dataSource === 'postgres' ? 'objects' : 'files'}</span>
        </Box>
      </Box>
      
      {/* Table Preview Dialog */}
      <TablePreviewDialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        tableData={previewData}
        loading={previewLoading}
        error={previewError}
      />

    </Box>
  );
}

// Export helper functions for use in other components
export { buildFileTree, collectAllFiles, getFolderCheckboxState, getFileIcon };