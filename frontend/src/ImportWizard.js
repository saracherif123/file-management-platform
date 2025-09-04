import React, { useState } from 'react';
import { Box, Paper, Stack, Typography, FormControl, InputLabel, Select, MenuItem, Button, Snackbar, Alert, CircularProgress } from '@mui/material';
import FileManager from './FileManager';
import FileTree, { buildFileTree, collectAllFiles } from './components/FileTree';
import S3Input from './components/S3Input';
import ProgressBar from './components/ProgressBar';

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



export default function ImportWizard() {
  const [source, setSource] = useState('Local');
  const [s3Options, setS3Options] = useState({ accessKey: '', secretKey: '', s3path: '', region: 'eu-central-1' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const [selectedS3Files, setSelectedS3Files] = useState([]);
  const [s3Loading, setS3Loading] = useState(false);
  const [s3TreeData, setS3TreeData] = useState({});
  const [s3TreeLoading, setS3TreeLoading] = useState(false);
  const [s3ImportProgress, setS3ImportProgress] = useState({ jobId: null, progress: 0, isImporting: false, message: '' });

  const handleSourceChange = (e) => {
    setSource(e.target.value);
    setSelectedS3Files([]);
    setS3Options({ ...s3Options, s3path: '' });
  };
  const handleS3Change = (e) => setS3Options({ ...s3Options, [e.target.name]: e.target.value });





  // Folder selection handler for S3
  const handleToggleS3FolderTree = (node, path = '') => {
    const allFiles = collectAllFiles(node, path);
    const allSelected = allFiles.every(f => selectedS3Files.includes(f));
    setSelectedS3Files(prev => {
      if (allSelected) {
        // Deselect all
        return prev.filter(f => !allFiles.includes(f));
      } else {
        // Select all (add any not already selected)
        return Array.from(new Set([...prev, ...allFiles]));
      }
    });
  };



  // Fetch all S3 files recursively and build tree
  const fetchS3Tree = async () => {
    setS3Loading(true);
    setS3TreeLoading(true);
    setS3TreeData({});
    setSelectedS3Files([]);
    const { bucket, prefix } = parseS3Path(s3Options.s3path);
    if (!bucket) {
      setSnackbar({ open: true, message: 'Please enter a valid S3 path (e.g. s3://bucket/prefix/ or bucket/prefix/)', severity: 'warning' });
      setS3Loading(false);
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
      setS3Loading(false);
      setS3TreeLoading(false);
    }
  };

  // Replace handleConnectS3 to use tree fetch
  const handleConnectS3 = () => {
    fetchS3Tree();
  };



  const handleToggleS3File = (file) => {
    setSelectedS3Files((prev) =>
      prev.includes(file) ? prev.filter(f => f !== file) : [...prev, file]
    );
  };



  // S3 import with progress tracking
  const handleLoadWithProgress = async () => {
    if (selectedS3Files.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one S3 file to load.', severity: 'warning' });
      return;
    }
    
    const { bucket, prefix } = parseS3Path(s3Options.s3path);
    if (!bucket) {
      setSnackbar({ open: true, message: 'S3 bucket is missing. Please enter a valid S3 path (e.g. s3://bucket/).', severity: 'error' });
      return;
    }
    
    const jobId = crypto.randomUUID();
    setS3ImportProgress({ jobId, progress: 0, isImporting: true, message: 'Starting S3 import...' });

    
    try {
      const res = await fetch('http://localhost:8080/rest/load-s3-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: s3Options.accessKey,
          secretKey: s3Options.secretKey,
          bucket,
          path: prefix,
          region: s3Options.region,
          files: selectedS3Files,
          jobId: jobId,
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
            setS3ImportProgress(prev => ({ 
              ...prev, 
              progress: progressPercent, 
              message: progressData.message || `Processing... ${progressData.processed}/${progressData.total}`
            }));
            
            if (progressData.status === 'done' || progressData.status === 'error') {
              setS3ImportProgress({ jobId: null, progress: 0, isImporting: false, message: '' });
              if (progressData.status === 'done') {
                setSnackbar({ open: true, message: progressData.message || 'S3 import completed!', severity: 'success' });
                setSelectedS3Files([]);
              } else {
                setSnackbar({ open: true, message: progressData.message || 'S3 import failed with errors.', severity: 'error' });
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
      setS3ImportProgress({ jobId: null, progress: 0, isImporting: false, message: '' });
      setSnackbar({ open: true, message: 'Failed to load files: ' + err.message, severity: 'error' });
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
            <S3Input
              s3Options={s3Options}
              onS3Change={handleS3Change}
              onConnect={handleConnectS3}
              loading={s3Loading}
            />
          )}
        </Stack>
        {source === 'Local' && <FileManager />}
        {source === 'S3' && (
          <Box sx={{ my: 3 }}>
            <Typography variant="h6">Files</Typography>
            {/* Progress bar for S3 import */}
            <ProgressBar
              isImporting={s3ImportProgress.isImporting}
              progress={s3ImportProgress.progress}
              message={s3ImportProgress.message}
            />
            {s3TreeLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 2 }}>
                <CircularProgress size={24} />
                <Typography>Loading S3 file tree...</Typography>
              </Box>
            ) : Object.keys(s3TreeData).length > 0 ? (
              <FileTree
                files={s3TreeData}
                selectedFiles={selectedS3Files}
                onFileToggle={handleToggleS3File}
                onFolderToggle={handleToggleS3FolderTree}
                isTreeData={true}
                height={400}
                maxWidth={600}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'text.secondary' }}>
                No S3 files found. Please connect to S3 and select a path.
              </Box>
            )}
            {selectedS3Files.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleLoadWithProgress}
                  disabled={s3ImportProgress.isImporting}
                  startIcon={s3ImportProgress.isImporting ? <CircularProgress size={20} /> : null}
                >
                  {s3ImportProgress.isImporting ? 'Importing...' : `Load ${selectedS3Files.length} file${selectedS3Files.length > 1 ? 's' : ''}`}
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