import React, { useRef } from 'react';
import { 
  Stack, 
  Button, 
  CircularProgress,
  Box,
  InputBase,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { styled } from '@mui/material/styles';

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

const FILE_TYPES = ['All', 'csv', 'json', 'txt', 'parquet'];

export default function LocalInput({ 
  fileType,
  onFileTypeChange,
  search,
  onSearchChange,
  onUpload,
  onUploadMultiple,
  uploading = false,
  isDragOver = false,
  onDragOver,
  onDragLeave,
  onDrop
}) {
  const fileInputRef = useRef();

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={2} alignItems="center">
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel id="file-type-label">Type</InputLabel>
          <Select
            labelId="file-type-label"
            value={fileType}
            label="Type"
            onChange={onFileTypeChange}
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
            onChange={onSearchChange}
            startAdornment={<SearchIcon sx={{ mr: 1 }} />}
            sx={{ width: '100%', border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5 }}
          />
        </Box>
        <Button variant="contained" component="label" disabled={uploading}>
          Upload Files & Folders
          <input
            type="file"
            hidden
            multiple
            webkitdirectory="true"
            onChange={e => onUploadMultiple(Array.from(e.target.files))}
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
        sx={{
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        <Box textAlign="center">
          <Typography variant="body2" color="text.secondary">
            {isDragOver ? 'Drop files here' : 'Drag and drop files or folders here'}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            Supports multiple files and folder structures
          </Typography>
        </Box>
      </DragDropArea>
    </Stack>
  );
}
