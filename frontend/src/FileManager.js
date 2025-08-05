import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Snackbar,
  Alert,
  InputBase,
  CircularProgress,
  Checkbox,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';
import { FaFileCsv, FaFileAlt, FaFileCode, FaFile } from 'react-icons/fa';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const FILE_TYPES = ['All', 'csv', 'json', 'txt', 'parquet'];

const DragDropArea = styled(Box)(({ theme, isdragover }) => ({
  border: '2px dashed',
  borderColor: isdragover ? theme.palette.primary.main : theme.palette.divider,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  textAlign: 'center',
  background: isdragover ? theme.palette.action.hover : 'inherit',
  cursor: 'pointer',
  marginBottom: theme.spacing(2),
}));

function getFileIcon(filename) {
  if (filename.endsWith('.csv')) return <FaFileCsv color="#2a9d8f" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.json')) return <FaFileCode color="#e76f51" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.parquet')) return <FaFileAlt color="#264653" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.txt')) return <FaFileAlt color="#6d6875" style={{ marginRight: 8 }} />;
  return <FaFile style={{ marginRight: 8 }} />;
}

export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [search, setSearch] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileType, setFileType] = useState('All');
  const fileInputRef = useRef();

  // --- API WRAPPERS using api.js ---
  function apiListFiles() {
    return fetch('http://localhost:8080/rest/list')
      .then(res => {
        if (!res.ok) throw new Error('Load failed');
        return res.json();
      });
  }

  function apiUploadFile(file) {
    const formData = new FormData();
    formData.append('file', file, file.webkitRelativePath || file.name);
    return fetch('http://localhost:8080/rest/upload', {
      method: 'POST',
      body: formData,
    });
  }

  function apiDeleteFile(filename) {
    return fetch(`http://localhost:8080/rest/delete/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  }

  function apiDownloadFile(filename) {
    return fetch(`http://localhost:8080/rest/download/${encodeURIComponent(filename)}`);
  }
  // --- END API WRAPPERS ---

  // useCallback for stable references
  const fetchFiles = useCallback(() => {
    setLoading(true);
    apiListFiles()
      .then(setFiles)
      .catch(() => setSnackbar({ open: true, message: 'Failed to fetch file list.', severity: 'error' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDelete = useCallback(async (filename) => {
    try {
      const res = await apiDeleteFile(filename);
      if (!res.ok) throw new Error('Delete failed');
      setSnackbar({ open: true, message: 'File removed from staging area.', severity: 'success' });
      fetchFiles();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  }, [fetchFiles]);

  const handleDownload = useCallback((filename) => {
    apiDownloadFile(filename)
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => setSnackbar({ open: true, message: 'Download failed.', severity: 'error' }));
  }, []);

  // --- Upload logic supporting folders ---
  const handleUpload = async (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setSnackbar({ open: true, message: 'File is too large (max 10MB).', severity: 'warning' });
      return;
    }
    setUploading(true);
    try {
      const res = await apiUploadFile(file);
      if (!res.ok) throw new Error('Upload failed');
      setSnackbar({ open: true, message: 'File uploaded successfully!', severity: 'success' });
      await fetchFiles(); // Ensure the file list is refreshed after upload
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle multiple files (for folder upload)
  const handleUploadMultiple = async (fileList) => {
    for (const file of fileList) {
      await handleUpload(file);
    }
  };

  // Drag and drop handlers (support folders)
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadMultiple(Array.from(e.dataTransfer.files));
    }
  };
  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // File selection
  const handleToggle = (filename) => {
    setSelectedFiles((prev) =>
      prev.includes(filename)
        ? prev.filter((f) => f !== filename)
        : [...prev, filename]
    );
  };

  // Folder selection handler
  const handleToggleFolder = (node, path = '') => {
    const allFiles = collectAllFiles(node, path);
    const allSelected = allFiles.every(f => selectedFiles.includes(f));
    setSelectedFiles(prev => {
      if (allSelected) {
        // Deselect all
        return prev.filter(f => !allFiles.includes(f));
      } else {
        // Select all (add any not already selected)
        return Array.from(new Set([...prev, ...allFiles]));
      }
    });
  };

  // Helper: Build a tree from file paths (prefer webkitRelativePath if available)
  function buildFileTree(files) {
    const root = {};
    for (const file of files) {
      // If file is a File object with webkitRelativePath, use it; else, use string
      const path = file.webkitRelativePath || (typeof file === 'string' ? file : file.name);
      const parts = path.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = i === parts.length - 1 ? { __file: path } : {};
        }
        current = current[part];
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

  // Helper: Recursively render the tree
  function renderTree(node, path = '') {
    return Object.entries(node).map(([key, value], idx) => {
      const id = path ? `${path}/${key}` : key;
      if (value.__file) {
        // File node
        return (
          <TreeItem key={id} itemId={id} label={
            <span>
              <Checkbox
                checked={value.selected}
                onChange={() => value.onToggle(value.__file)}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              {getFileIcon(key)}{key}
              <IconButton edge="end" aria-label="download" size="small" onClick={e => { e.stopPropagation(); value.onDownload(value.__file); }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
              <IconButton edge="end" aria-label="delete" size="small" onClick={e => { e.stopPropagation(); value.onDelete(value.__file); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          } />
        );
      } else {
        // Folder node
        const { checked, indeterminate } = getFolderCheckboxState(value, selectedFiles, id);
        return (
          <TreeItem key={id} itemId={id} label={
            <span>
              <Checkbox
                checked={checked}
                indeterminate={indeterminate}
                onChange={() => handleToggleFolder(value, id)}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              {key}
            </span>
          }>
            {renderTree(value, id)}
          </TreeItem>
        );
      }
    });
  }

  // File type filter
  const filteredFiles = files.filter(f => {
    const matchesType = fileType === 'All' || f.endsWith('.' + fileType);
    const matchesSearch = f.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Build tree data for SimpleTreeView
  const treeData = React.useMemo(() => {
    // Attach selection and handlers to each file node
    const tree = buildFileTree(filteredFiles);
    function attachHandlers(node) {
      for (const key in node) {
        if (node[key].__file) {
          node[key].selected = selectedFiles.includes(node[key].__file);
          node[key].onToggle = handleToggle;
          node[key].onDownload = handleDownload;
          node[key].onDelete = handleDelete;
        } else {
          attachHandlers(node[key]);
        }
      }
    }
    attachHandlers(tree);
    return tree;
  }, [filteredFiles, selectedFiles, handleDelete, handleDownload]);

  // Load button action (example: alert selected files)
  const handleLoad = () => {
    setSnackbar({ open: true, message: `Loaded: ${selectedFiles.join(', ')}`, severity: 'info' });
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="file-type-label">Type</InputLabel>
            <Select
              labelId="file-type-label"
              value={fileType}
              label="Type"
              onChange={e => setFileType(e.target.value)}
            >
              {FILE_TYPES.map(type => (
                <MenuItem key={type} value={type}>{type.toUpperCase()}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ flex: 1 }}>
            <InputBase
              placeholder="Search files..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              startAdornment={<SearchIcon sx={{ mr: 1 }} />}
              sx={{ width: '100%', border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5 }}
            />
          </Box>
          <Button variant="contained" component="label" disabled={uploading}>
            Upload
            <input
              type="file"
              hidden
              multiple
              webkitdirectory="true"
              onChange={e => handleUploadMultiple(Array.from(e.target.files))}
              ref={fileInputRef}
            />
          </Button>
          {uploading && <CircularProgress size={24} />}
        </Stack>
        <DragDropArea
          isdragover={isDragOver ? 1 : 0}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          Drag and drop a file here
        </DragDropArea>
        {loading ? <LinearProgress /> : null}
        <Typography variant="h6" mt={2}>Files</Typography>
        {/* Tree View for files */}
        <SimpleTreeView
          aria-label="file tree"
          defaultCollapseIcon={<ExpandMoreIcon />}
          defaultExpandIcon={<ChevronRightIcon />}
          sx={{ height: 400, flexGrow: 1, maxWidth: 600, overflowY: 'auto', mb: 2 }}
        >
          {renderTree(treeData)}
        </SimpleTreeView>
        <Stack direction="row" spacing={2} mt={2} justifyContent="flex-end">
          <Button variant="contained" onClick={handleLoad} disabled={selectedFiles.length === 0}>
            Load
          </Button>
        </Stack>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Paper>
    </Box>
  );
} 