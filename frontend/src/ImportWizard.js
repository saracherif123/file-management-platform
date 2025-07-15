import React, { useState } from 'react';
import { Box, Paper, Stack, Typography, Select, MenuItem, FormControl, InputLabel, TextField, Button, Snackbar, Alert } from '@mui/material';

const SOURCES = ['Local', 'S3'];

export default function ImportWizard() {
  const [source, setSource] = useState('Local');
  const [s3Options, setS3Options] = useState({ accessKey: '', secretKey: '', bucket: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  const handleSourceChange = (e) => {
    setSource(e.target.value);
  };

  const handleS3Change = (e) => {
    setS3Options({ ...s3Options, [e.target.name]: e.target.value });
  };

  // Placeholder for file explorer and load button
  const handleLoad = () => {
    setSnackbar({ open: true, message: 'Load triggered (placeholder)', severity: 'info' });
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
              {SOURCES.map(src => (
                <MenuItem key={src} value={src}>{src}</MenuItem>
              ))}
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
                label="Bucket/Path"
                name="bucket"
                value={s3Options.bucket}
                onChange={handleS3Change}
                size="small"
              />
            </Stack>
          )}
        </Stack>
        {/* Placeholder for FileExplorer */}
        <Box sx={{ my: 3, p: 2, border: '1px dashed #ccc', borderRadius: 2, minHeight: 200, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">File Explorer will go here</Typography>
        </Box>
        <Stack direction="row" justifyContent="flex-end">
          <Button variant="contained" onClick={handleLoad}>Load</Button>
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