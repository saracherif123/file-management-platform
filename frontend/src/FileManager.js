import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  Stack,
  Snackbar,
  Alert,
  LinearProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import FileTree, { buildFileTree, collectAllFiles } from './components/FileTree';
import LocalInput from './components/LocalInput';
import ProgressBar from './components/ProgressBar';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function FileManager() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [search, setSearch] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileType, setFileType] = useState('All');
  const [importProgress, setImportProgress] = useState({ jobId: null, progress: 0, isImporting: false, message: '' });
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
      .then(files => {
        setFiles(files);
      })
      .catch(err => {
        console.error('Failed to fetch files:', err);
        setSnackbar({ open: true, message: 'Failed to fetch file list.', severity: 'error' });
      })
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
    console.log('Uploading file:', file.name, 'size:', file.size);
    try {
      const res = await apiUploadFile(file);
      if (!res.ok) throw new Error('Upload failed');
      console.log('Upload successful, response:', res);
      setSnackbar({ open: true, message: 'File uploaded successfully!', severity: 'success' });
      console.log('Refreshing file list...');
      await fetchFiles(); // Ensure the file list is refreshed after upload
    } catch (err) {
      console.error('Upload failed:', err);
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





  // File type filter
  const filteredFiles = React.useMemo(() => {
    const filtered = (files || []).filter(f => {
      const matchesType = fileType === 'All' || f.endsWith('.' + fileType);
      const matchesSearch = f.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
    return filtered;
  }, [files, fileType, search]);

  // Build tree data for SimpleTreeView
  const treeData = React.useMemo(() => {
    // Attach selection and handlers to each file node
    if (!filteredFiles || filteredFiles.length === 0) {
      return {};
    }
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
  }, [filteredFiles, selectedFiles, handleToggle, handleDelete, handleDownload]);



  // Import with progress tracking
  const handleImportWithProgress = async () => {
    if (selectedFiles.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one file to import.', severity: 'warning' });
      return;
    }
    
    const jobId = crypto.randomUUID();
    setImportProgress({ jobId, progress: 0, isImporting: true, message: 'Starting import...' });
    
    try {
      // Start import
      const res = await fetch('http://localhost:8080/rest/load-local-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: selectedFiles,
          jobId: jobId
        }),
      });
      
      if (!res.ok) throw new Error('Import failed');
      
      const data = await res.json();
      const actualJobId = data.jobId || jobId;
      
      // Poll for progress
      const pollProgress = async () => {
        try {
          const progressRes = await fetch(`http://localhost:8080/rest/import-progress/${actualJobId}`);
          if (progressRes.ok) {
            const progressData = await progressRes.json();
            const progressPercent = progressData.total > 0 ? (progressData.processed / progressData.total) * 100 : 0;
            setImportProgress(prev => ({ 
              ...prev, 
              progress: progressPercent, 
              message: progressData.message || `Processing... ${progressData.processed}/${progressData.total}`
            }));
            
            if (progressData.status === 'done' || progressData.status === 'error') {
              setImportProgress({ jobId: null, progress: 0, isImporting: false, message: '' });
              if (progressData.status === 'done') {
                setSnackbar({ open: true, message: progressData.message || 'Import completed!', severity: 'success' });
                setSelectedFiles([]);
              } else {
                setSnackbar({ open: true, message: progressData.message || 'Import failed with errors.', severity: 'error' });
              }
              return;
            }
          }
        } catch (err) {
          console.error('Progress polling error:', err);
        }
        
        // Continue polling
        setTimeout(pollProgress, 1000);
      };
      
      pollProgress();
      
    } catch (err) {
      console.error('Import error:', err);
      setImportProgress({ jobId: null, progress: 0, isImporting: false, message: '' });
      setSnackbar({ open: true, message: 'Import failed: ' + err.message, severity: 'error' });
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <LocalInput
          fileType={fileType}
          onFileTypeChange={e => setFileType(e.target.value)}
          search={search}
          onSearchChange={e => setSearch(e.target.value)}
          onUpload={handleUpload}
          onUploadMultiple={handleUploadMultiple}
          uploading={uploading}
          isDragOver={isDragOver}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
        {loading ? <LinearProgress /> : null}
        <Typography variant="h6" mt={2}>Files</Typography>
        

        
        {/* Progress bar for import */}
        <ProgressBar
          isImporting={importProgress.isImporting}
          progress={importProgress.progress}
          message={importProgress.message}
        />
        {/* Tree View for files */}
        <FileTree
          files={treeData}
          selectedFiles={selectedFiles}
          onFileToggle={handleToggle}
          onFolderToggle={handleToggleFolder}
          isTreeData={true}
          renderFileActions={(filename) => (
            <>
              <IconButton edge="end" aria-label="download" size="small" onClick={e => { e.stopPropagation(); handleDownload(filename); }}>
                <DownloadIcon fontSize="small" />
              </IconButton>
              <IconButton edge="end" aria-label="delete" size="small" onClick={e => { e.stopPropagation(); handleDelete(filename); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
          height={400}
          maxWidth={600}
        />
        <Stack direction="row" spacing={2} mt={2} justifyContent="flex-end">
          <Button 
            variant="contained" 
            onClick={handleImportWithProgress} 
            disabled={selectedFiles.length === 0 || importProgress.isImporting}
          >
            {importProgress.isImporting ? 'Importing...' : 'Import'}
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