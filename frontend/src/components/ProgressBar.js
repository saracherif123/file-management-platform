import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

export default function ProgressBar({ 
  isImporting, 
  progress, 
  message, 
  height = 8, 
  borderRadius = 4 
}) {
  if (!isImporting) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ height, borderRadius }}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {message} ({Math.round(progress)}%)
      </Typography>
    </Box>
  );
}
