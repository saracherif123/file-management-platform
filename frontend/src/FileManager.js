import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
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
import * as api from './api';
import { FaFileCsv, FaFileAlt, FaFileCode, FaFile } from 'react-icons/fa';

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

  const fetchFiles = () => {
    setLoading(true);
    apiListFiles()
      .then(setFiles)
      .catch(() => setSnackbar({ open: true, message: 'Failed to fetch file list.', severity: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFiles();
  }, []);

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
    formData.append('file', file);
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

  const handleDelete = async (filename) => {
    try {
      const res = await apiDeleteFile(filename);
      if (!res.ok) throw new Error('Delete failed');
      setSnackbar({ open: true, message: 'File removed from staging area.', severity: 'success' });
      fetchFiles();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleDownload = (filename) => {
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
  };

  // Drag and drop handlers
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Handle multiple files
      Array.from(e.dataTransfer.files).forEach(file => {
        handleUpload(file);
      });
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

  // File type filter
  const filteredFiles = files.filter(f => {
    const matchesType = fileType === 'All' || f.endsWith('.' + fileType);
    const matchesSearch = f.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

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
              onChange={e => handleUpload(e.target.files[0])}
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
        <List>
          {filteredFiles.length === 0 && <ListItem><ListItemText primary="No files found." /></ListItem>}
          {filteredFiles.map(filename => (
            <ListItem
              key={filename}
              secondaryAction={
                <>
                  <IconButton edge="end" aria-label="download" onClick={() => handleDownload(filename)}>
                    <DownloadIcon />
                  </IconButton>
                  <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(filename)}>
                    <DeleteIcon />
                  </IconButton>
                </>
              }
            >
              <Checkbox
                checked={selectedFiles.includes(filename)}
                onChange={() => handleToggle(filename)}
              />
              <ListItemText primary={<span>{getFileIcon(filename)}{filename}</span>} />
            </ListItem>
          ))}
        </List>
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