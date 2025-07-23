import React, { useState } from 'react';
import { Box, Paper, Stack, Typography, Select, MenuItem, FormControl, InputLabel, TextField, Button, Snackbar, Alert, List, ListItem, ListItemText, Checkbox, ListItemButton } from '@mui/material';
import { FaFolder, FaFileCsv, FaFileAlt, FaFileCode, FaFile } from 'react-icons/fa';
import FileManager from './FileManager';

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
  const [s3Options, setS3Options] = useState({ accessKey: '', secretKey: '', s3path: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [s3Files, setS3Files] = useState([]);
  const [s3Folders, setS3Folders] = useState([]);
  const [folderFileCounts, setFolderFileCounts] = useState({});
  const [recursiveFileCount, setRecursiveFileCount] = useState(null);
  const [selectedS3Files, setSelectedS3Files] = useState([]);
  const [s3Loading, setS3Loading] = useState(false);

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
    setSelectedS3Files([]);
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
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSnackbar({ open: true, message: data.error, severity: 'error' });
        setS3Files([]);
        setS3Folders([]);
        setFolderFileCounts({});
        setRecursiveFileCount(null);
      } else {
        setS3Files(data.files || []);
        setS3Folders(data.folders || []);
        setFolderFileCounts(data.folderFileCounts || {});
        setRecursiveFileCount(data.recursiveFileCount ?? null);
        setSnackbar({ open: true, message: `Connected. Found ${data.files.length} files and ${data.folders.length} folders.`, severity: 'success' });
      }
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
      setS3Files([]);
      setS3Folders([]);
      setFolderFileCounts({});
      setRecursiveFileCount(null);
    } finally {
      setS3Loading(false);
    }
  };

  const handleConnectS3 = () => {
    fetchS3Contents();
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

  const handleLoad = async () => {
    if (source === 'S3') {
      if (selectedS3Files.length === 0) {
        setSnackbar({ open: true, message: 'Please select at least one S3 file to load.', severity: 'warning' });
        return;
      }
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
            files: selectedS3Files,
          }),
        });
        if (!res.ok) throw new Error('Failed to load selected S3 files');
        setSnackbar({ open: true, message: 'Selected S3 files sent to backend for processing.', severity: 'success' });
      } catch (err) {
        setSnackbar({ open: true, message: err.message, severity: 'error' });
      }
    }
    // For Local, FileManager handles loading
  };

  // Helper to format counts for display
  function formatCount(count) {
    if (count === null || count === undefined) return '?';
    if (count > 1000) return '>1000';
    return count;
  }

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
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                label="Access Key"
                name="accessKey"
                value={s3Options.accessKey}
                onChange={handleS3Change}
                size="small"
              />
              <TextField
                label="Secret Key"
                name="secretKey"
                value={s3Options.secretKey}
                onChange={handleS3Change}
                size="small"
                type="password"
              />
              <TextField
                label="S3 Path (e.g. s3://bucket/prefix/)"
                name="s3path"
                value={s3Options.s3path}
                onChange={handleS3Change}
                size="small"
                sx={{ minWidth: 300 }}
              />
              <Button variant="outlined" onClick={handleConnectS3} disabled={s3Loading}>
                {s3Loading ? 'Connecting...' : 'Connect'}
              </Button>
            </Stack>
          )}
        </Stack>
        {source === 'Local' && <FileManager />}
        {source === 'S3' && (s3Files.length > 0 || s3Folders.length > 0) && (
          <Box sx={{ my: 3 }}>
            <Typography variant="h6">S3 Folders & Files</Typography>
            {/* Show counts for current path and selected files */}
            <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Files in this path: <b>{formatCount(recursiveFileCount !== null ? recursiveFileCount : s3Files.length)}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Folders in this path: <b>{formatCount(s3Folders.length)}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Imported (selected): <b>{formatCount(selectedS3Files.length)}</b>
              </Typography>
            </Box>
            {parseS3Path(s3Options.s3path).prefix && (
              <Button size="small" onClick={handleBack} sx={{ mb: 1 }}>
                Back
              </Button>
            )}
            <List>
              {s3Folders.map((folder, idx) => (
                <ListItemButton key={folder} onClick={() => handleNavigateFolder(folder)}>
                  <FaFolder color="#f4a261" style={{ marginRight: 8 }} />
                  <ListItemText
                    primary={
                      <span>
                        {folder}
                        <span style={{ color: '#888', fontSize: '0.9em', marginLeft: 8 }}>
                          (files: {formatCount(folderFileCounts[folder])})
                        </span>
                      </span>
                    }
                    primaryTypographyProps={{ fontWeight: 'bold' }}
                  />
                </ListItemButton>
              ))}
              {s3Files.map((file, idx) => (
                <ListItem key={file} disablePadding secondaryAction={
                  <Checkbox
                    edge="end"
                    checked={selectedS3Files.includes(file)}
                    onChange={() => handleToggleS3File(file)}
                  />
                }>
                  <ListItemText primary={<span>{getFileIcon(file)}{file}</span>} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
        <Stack direction="row" justifyContent="flex-end" mt={2}>
          <Button variant="contained" onClick={handleLoad} disabled={source === 'S3' && s3Files.length === 0}>Load</Button>
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