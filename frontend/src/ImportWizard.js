import React, { useState } from 'react';
import { Box, Paper, Stack, Typography, Select, MenuItem, FormControl, InputLabel, TextField, Button, Snackbar, Alert, List, ListItem, ListItemText, Checkbox, ListItemButton, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import { FaFolder, FaFileCsv, FaFileAlt, FaFileCode, FaFile, FaEye, FaEyeSlash } from 'react-icons/fa';
import FileManager from './FileManager';
import { SimpleTreeView, TreeItem } from '@mui/x-tree-view';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function parseS3Path(s3Path) {
  let path = s3Path.trim();
  if (path.startsWith('s3://')) path = path.slice(5);
  const firstSlash = path.indexOf('/');
  if (firstSlash === -1) return { bucket: path, prefix: '' };
  const bucket = path.slice(0, firstSlash);
  let prefix = path.slice(firstSlash + 1);
  if (prefix && !prefix.endsWith('/')) prefix += '/';
  return { bucket, prefix };
}

function getFileIcon(filename) {
  if (filename.endsWith('.csv')) return <FaFileCsv color="#2a9d8f" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.json')) return <FaFileCode color="#e76f51" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.parquet')) return <FaFileAlt color="#264653" style={{ marginRight: 8 }} />;
  if (filename.endsWith('.txt')) return <FaFileAlt color="#6d6875" style={{ marginRight: 8 }} />;
  return <FaFile style={{ marginRight: 8 }} />;
}

export default function ImportWizard() {
  const [source, setSource] = useState('Local');
  const [s3Options, setS3Options] = useState({ accessKey: '', secretKey: '', s3path: '', region: 'eu-central-1' });
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [s3Files, setS3Files] = useState([]);
  const [s3Folders, setS3Folders] = useState([]);
  const [folderFileCounts, setFolderFileCounts] = useState({});
  const [recursiveFileCount, setRecursiveFileCount] = useState(null);
  const [fileSizes, setFileSizes] = useState({});
  const [selectedS3Files, setSelectedS3Files] = useState([]);
  const [s3Loading, setS3Loading] = useState(false);
  const [folderLoading, setFolderLoading] = useState({}); // { [folder]: boolean }
  const [loadingToDataLoom, setLoadingToDataLoom] = useState(false);
  const [s3TreeData, setS3TreeData] = useState({});
  const [s3TreeLoading, setS3TreeLoading] = useState(false);

  const handleSourceChange = (e) => {
    setSource(e.target.value);
    setS3Files([]);
    setS3Folders([]);
    setSelectedS3Files([]);
    setS3Options({ ...s3Options, s3path: '' });
  };
  const handleS3Change = (e) => setS3Options({ ...s3Options, [e.target.name]: e.target.value });

  const fetchS3Contents = async (customPrefix) => {
    setS3Loading(true);
    setS3Files([]);
    setS3Folders([]);
    // Don't clear selectedS3Files here to maintain selection across navigation
    const { bucket, prefix } = parseS3Path(s3Options.s3path);
    if (!bucket) {
      setSnackbar({ open: true, message: 'Please enter a valid S3 path (e.g. s3://bucket/prefix/ or bucket/prefix/)', severity: 'warning' });
      setS3Loading(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:8080/rest/list-s3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: s3Options.accessKey,
          secretKey: s3Options.secretKey,
          bucket,
          path: customPrefix !== undefined ? customPrefix : prefix,
          region: s3Options.region,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSnackbar({ open: true, message: data.error, severity: 'error' });
        setS3Files([]);
        setS3Folders([]);
        setFolderFileCounts({});
        setRecursiveFileCount(null);
        setFileSizes({});
      } else {
        setS3Files(data.files || []);
        setS3Folders(data.folders || []);
        setFolderFileCounts(data.folderFileCounts || {});
        setRecursiveFileCount(data.recursiveFileCount ?? null);
        setFileSizes(data.fileSizes || {});
        setSnackbar({ open: true, message: `Connected. Found ${data.files.length} files and ${data.folders.length} folders.`, severity: 'success' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
      setS3Files([]);
      setS3Folders([]);
      setFolderFileCounts({});
      setRecursiveFileCount(null);
      setFileSizes({});
    } finally {
      setS3Loading(false);
    }
  };

  // Helper: Build a tree from file paths
  function buildFileTree(files) {
    const root = {};
    for (const file of files) {
      const parts = file.split('/');
      let current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = i === parts.length - 1 ? { __file: file } : {};
        }
        current = current[part];
      }
    }
    return root;
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
                checked={selectedS3Files.includes(value.__file)}
                onChange={() => handleToggleS3File(value.__file)}
                size="small"
                sx={{ p: 0, mr: 1 }}
              />
              {getFileIcon(key)}{key}
            </span>
          } />
        );
      } else {
        // Folder node
        return (
          <TreeItem key={id} itemId={id} label={key}>
            {renderTree(value, id)}
          </TreeItem>
        );
      }
    });
  }

  // Fetch all S3 files recursively and build tree
  const fetchS3Tree = async () => {
    setS3TreeLoading(true);
    setS3TreeData({});
    setSelectedS3Files([]);
    const { bucket, prefix } = parseS3Path(s3Options.s3path);
    if (!bucket) {
      setSnackbar({ open: true, message: 'Please enter a valid S3 path (e.g. s3://bucket/prefix/ or bucket/prefix/)', severity: 'warning' });
      setS3TreeLoading(false);
      return;
    }
    try {
      const res = await fetch('http://localhost:8080/rest/list-s3-all-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: s3Options.accessKey,
          secretKey: s3Options.secretKey,
          bucket,
          path: prefix,
          region: s3Options.region,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSnackbar({ open: true, message: data.error, severity: 'error' });
        setS3TreeData({});
      } else {
        setS3TreeData(buildFileTree(data.files || []));
        setSnackbar({ open: true, message: `Connected. Found ${data.files.length} files.`, severity: 'success' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
      setS3TreeData({});
    } finally {
      setS3TreeLoading(false);
    }
  };

  // Replace handleConnectS3 to use tree fetch
  const handleConnectS3 = () => {
    fetchS3Tree();
  };

  const handleNavigateFolder = (folder) => {
    const { bucket } = parseS3Path(s3Options.s3path);
    setS3Options((prev) => ({ ...prev, s3path: `s3://${bucket}/${folder}` }));
    fetchS3Contents(folder);
  };

  const handleBack = () => {
    const { bucket, prefix } = parseS3Path(s3Options.s3path);
    if (!prefix) return;
    const parts = prefix.endsWith('/') ? prefix.slice(0, -1).split('/') : prefix.split('/');
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
    setS3Options((prev) => ({ ...prev, s3path: `s3://${bucket}/${newPrefix}` }));
    fetchS3Contents(newPrefix);
  };

  const handleToggleS3File = (file) => {
    setSelectedS3Files((prev) =>
      prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]
    );
  };

  // Helper: fetch all files under a folder (recursively)
  const fetchAllFilesInFolder = async (folderPrefix) => {
    const { bucket } = parseS3Path(s3Options.s3path);
    const res = await fetch('http://localhost:8080/rest/list-s3-files-in-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessKey: s3Options.accessKey,
        secretKey: s3Options.secretKey,
        bucket,
        path: folderPrefix,
        region: s3Options.region,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.files || [];
  };

  // Folder selection logic
  const handleToggleS3Folder = async (folder) => {
    setFolderLoading((prev) => ({ ...prev, [folder]: true }));
    try {
      const filesInFolder = await fetchAllFilesInFolder(folder);
      const allSelected = filesInFolder.every(f => selectedS3Files.includes(f));
      if (allSelected) {
        // Unselect all files in this folder
        setSelectedS3Files(prev => prev.filter(f => !filesInFolder.includes(f)));
      } else {
        // Select all files in this folder (add any not already selected)
        setSelectedS3Files(prev => Array.from(new Set([...prev, ...filesInFolder])));
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    } finally {
      setFolderLoading((prev) => ({ ...prev, [folder]: false }));
    }
  };

  // Helper: folder checkbox state
  const getFolderCheckboxState = (folder) => {
    const count = folderFileCounts[folder];
    if (!count || count === 0) return { checked: false, indeterminate: false };
    const selectedInFolder = selectedS3Files.filter(f => f.startsWith(folder));
    if (selectedInFolder.length === 0) return { checked: false, indeterminate: false };
    if (folderFileCounts[folder] > 1000) {
      return { checked: true, indeterminate: false };
    }
    if (selectedInFolder.length === folderFileCounts[folder]) return { checked: true, indeterminate: false };
    return { checked: false, indeterminate: true };
  };

  // Helper to format counts for display
  function formatCount(count) {
    if (count === null || count === undefined) return '?';
    if (count > 1000) return '>1000';
    return count;
  }

  // Helper to format file size
  function formatFileSize(bytes) {
    if (bytes === null || bytes === undefined) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  const handleLoadToDataLoom = async () => {
    if (selectedS3Files.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one S3 file to load.', severity: 'warning' });
      return;
    }
    
    setLoadingToDataLoom(true);
    const { bucket, prefix } = parseS3Path(s3Options.s3path);
    
    try {
      const res = await fetch('http://localhost:8080/rest/load-s3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: s3Options.accessKey,
          secretKey: s3Options.secretKey,
          bucket,
          path: prefix,
          region: s3Options.region,
          files: selectedS3Files,
        }),
      });
      
      const data = await res.json();
      
      if (data.error) {
        setSnackbar({ open: true, message: data.error, severity: 'error' });
      } else {
        const successMsg = `Successfully loaded ${data.totalProcessed} files.`;
        const failedMsg = data.totalFailed > 0 ? ` ${data.totalFailed} files failed to load.` : '';
        setSnackbar({ 
          open: true, 
          message: successMsg + failedMsg, 
          severity: data.totalFailed > 0 ? 'warning' : 'success' 
        });
        
        // Clear selection after successful load
        setSelectedS3Files([]);
      }
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load files: ' + err.message, severity: 'error' });
    } finally {
      setLoadingToDataLoom(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Import Wizard</Typography>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="source-label">Source</InputLabel>
            <Select
              labelId="source-label"
              value={source}
              label="Source"
              onChange={handleSourceChange}
            >
              <MenuItem value="Local">Local</MenuItem>
              <MenuItem value="S3">S3</MenuItem>
            </Select>
          </FormControl>
          {source === 'S3' && (
            <Stack spacing={2} sx={{ flex: 1 }}>
              {/* First row: Access Key and Secret Key */}
              <Stack direction="row" spacing={2} alignItems="center">
                <TextField
                  label="Access Key"
                  name="accessKey"
                  value={s3Options.accessKey}
                  onChange={handleS3Change}
                  size="small"
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <TextField
                  label="Secret Key"
                  name="secretKey"
                  value={s3Options.secretKey}
                  onChange={handleS3Change}
                  size="small"
                  type={showSecretKey ? 'text' : 'password'}
                  sx={{ flex: 1, minWidth: 200 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowSecretKey(!showSecretKey)}
                          edge="end"
                        >
                          {showSecretKey ? <FaEyeSlash /> : <FaEye />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
              {/* Second row: Region and S3 Path */}
              <Stack direction="row" spacing={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <InputLabel id="region-label">Region</InputLabel>
                  <Select
                    labelId="region-label"
                    name="region"
                    value={s3Options.region}
                    label="Region"
                    onChange={handleS3Change}
                  >
                    <MenuItem value="us-east-1">US East (N. Virginia)</MenuItem>
                    <MenuItem value="us-west-2">US West (Oregon)</MenuItem>
                    <MenuItem value="eu-west-1">Europe (Ireland)</MenuItem>
                    <MenuItem value="eu-central-1">Europe (Frankfurt)</MenuItem>
                    <MenuItem value="ap-southeast-1">Asia Pacific (Singapore)</MenuItem>
                    <MenuItem value="ap-northeast-1">Asia Pacific (Tokyo)</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="S3 Path (e.g. s3://bucket/prefix/)"
                  name="s3path"
                  value={s3Options.s3path}
                  onChange={handleS3Change}
                  size="small"
                  sx={{ flex: 1, minWidth: 300 }}
                />
                <Button 
                  variant="outlined" 
                  onClick={handleConnectS3} 
                  disabled={s3Loading}
                  sx={{ minWidth: 100 }}
                >
                  {s3Loading ? 'Connecting...' : 'Connect'}
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
        {source === 'Local' && <FileManager />}
        {source === 'S3' && (
          <Box sx={{ my: 3 }}>
            <Typography variant="h6">Files</Typography>
            {s3TreeLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
                <CircularProgress size={24} />
                <Typography>Loading S3 file tree...</Typography>
              </Box>
            ) : (
              <SimpleTreeView
                aria-label="s3 file tree"
                defaultCollapseIcon={<ExpandMoreIcon />}
                defaultExpandIcon={<ChevronRightIcon />}
                sx={{ height: 400, flexGrow: 1, maxWidth: 600, overflowY: 'auto', mb: 2 }}
              >
                {renderTree(s3TreeData)}
              </SimpleTreeView>
            )}
            {selectedS3Files.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleLoadToDataLoom}
                  disabled={loadingToDataLoom}
                  startIcon={loadingToDataLoom ? <CircularProgress size={20} /> : null}
                >
                  {loadingToDataLoom ? 'Loading...' : `Load ${selectedS3Files.length} file${selectedS3Files.length > 1 ? 's' : ''}`}
                </Button>
              </Box>
            )}
          </Box>
        )}
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