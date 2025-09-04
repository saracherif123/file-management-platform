import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Card,
  CardContent,
  CardActions,
  Stack,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  InputBase
} from '@mui/material';
import { ArrowBack, ArrowForward, CheckCircle, Upload as UploadIcon, Search as SearchIcon } from '@mui/icons-material';
import S3Input from './S3Input';
import LocalInput from './LocalInput';
import PostgresInput from './PostgresInput';
import FileTree, { buildFileTree } from './FileTree';
import ProgressBar from './ProgressBar';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const STEPS = {
  CONNECTION: 0,
  FILE_SELECTION: 1,
  IMPORT_PROGRESS: 2,
  SUCCESS: 3
};

export default function StepWizard() {
  const [activeStep, setActiveStep] = useState(STEPS.CONNECTION);
  const [dataSource, setDataSource] = useState('local'); // 'local' or 's3'
  
  // S3 connection state
  const [s3Config, setS3Config] = useState({
    accessKey: '',
    secretKey: '',
    region: 'eu-central-1',
    s3Path: ''
  });
  const [s3Files, setS3Files] = useState([]);
  const [s3Loading, setS3Loading] = useState(false);

  // PostgreSQL connection state
  const [postgresConfig, setPostgresConfig] = useState({
    host: 'localhost',
    port: 5433,
    database: 'testdb',
    username: 'postgres',
    password: 'test123',
    schema: ''
  });
  const [postgresFiles, setPostgresFiles] = useState([]);
  const [postgresLoading, setPostgresLoading] = useState(false);
  const [postgresError, setPostgresError] = useState('');
  
  // Local files state
  const [localFiles, setLocalFiles] = useState([]);
  const [localFileType, setLocalFileType] = useState('All');
  const [localSearch, setLocalSearch] = useState('');
  const [localDragOver, setLocalDragOver] = useState(false);
  
  // File selection state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileType, setFileType] = useState('All');
  const [search, setSearch] = useState('');
  
  // Import state
  const [importProgress, setImportProgress] = useState({ 
    jobId: null, 
    progress: 0, 
    isImporting: false, 
    message: '' 
  });
  const [importError, setImportError] = useState('');
  
  // Drag and drop message visibility state
  const [showDragMessage, setShowDragMessage] = useState(false);
  
  // Handle data source selection
  const handleDataSourceChange = (source) => {
    setDataSource(source);
    setS3Files([]);
    setLocalFiles([]);
    setSelectedFiles([]);
  };
  
  // Handle going back while preserving selected files
  const handleGoBack = () => {
    setActiveStep(STEPS.CONNECTION);
    // Note: We don't clear selectedFiles here, so they're preserved
  };
  
  // Handle S3 connection
  const handleS3Connect = async () => {
    setS3Loading(true);
    try {
      // Parse the S3 path to extract bucket and path
      const s3Path = s3Config.s3Path;
      if (!s3Path || !s3Path.startsWith('s3://')) {
        throw new Error('Invalid S3 path. Must start with s3://');
      }
      
      // Remove 's3://' prefix and split into bucket and path
      const pathWithoutPrefix = s3Path.substring(5); // Remove 's3://'
      const slashIndex = pathWithoutPrefix.indexOf('/');
      
      let bucket, path;
      if (slashIndex === -1) {
        // No path, just bucket
        bucket = pathWithoutPrefix;
        path = '';
      } else {
        bucket = pathWithoutPrefix.substring(0, slashIndex);
        path = pathWithoutPrefix.substring(slashIndex + 1);
      }
      
      // Create the request body in the format the backend expects
      const requestBody = {
        accessKey: s3Config.accessKey,
        secretKey: s3Config.secretKey,
        region: s3Config.region,
        bucket: bucket,
        path: path
      };
      
      // Get all files recursively to match local file behavior
      const response = await fetch('http://localhost:8080/rest/list-s3-all-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`S3 connection failed: ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Extract all files recursively (no separate folders needed)
      const files = result.files || [];
      
      // Process S3 files exactly like local files - create same object structure
      
      const s3FileList = files.map(file => ({
        name: file.split('/').pop(), // Just the filename
        webkitRelativePath: file,    // Full path (exactly like local files)
        type: 'file',
        size: 0
      }));
      
      // Set the S3 files as a flat array (like local files)
      setS3Files(s3FileList);
      
      setActiveStep(STEPS.FILE_SELECTION);
      

    } catch (error) {
      console.error('S3 connection error:', error);
      setImportError('Failed to connect to S3: ' + error.message);
    } finally {
      setS3Loading(false);
    }
  };

  // Helper function to auto-select all files
  const autoSelectAllFiles = (fileList) => {
    setTimeout(() => {
      setSelectedFiles(fileList.map(f => f.webkitRelativePath || f.name));
    }, 100);
  };

  // Handle PostgreSQL connection
  const handlePostgresConnect = async () => {
    setPostgresLoading(true);
    setPostgresError(''); // Clear any previous errors
    
    try {
      const response = await fetch('http://localhost:8080/rest/list-postgres', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postgresConfig),
      });

      if (!response.ok) {
        // Handle different HTTP status codes with specific error messages
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your username and password.');
        } else if (response.status === 403) {
          throw new Error('Access denied. Please check your database permissions.');
        } else if (response.status === 404) {
          throw new Error('Database not found. Please check your database name.');
        } else if (response.status === 500) {
          throw new Error('Database connection error. Please check your connection details.');
        } else {
          throw new Error(`Connection failed with status: ${response.status}`);
        }
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      // Check if we have any files/tables
      if (!data.files || data.files.length === 0) {
        throw new Error('No tables or views found in the database. Please check your credentials.');
      }

      // Convert PostgreSQL table/view names to file-like objects
      const fileList = data.files.map(tableName => ({
        name: tableName.split('.').pop(),
        webkitRelativePath: tableName,
        size: 0,
        type: 'application/sql'
      }));

      setPostgresFiles(fileList);
      setActiveStep(STEPS.FILE_SELECTION);
      

    } catch (error) {
      console.error('Failed to connect to PostgreSQL:', error);
      
      // Set user-friendly error message
      let errorMessage = error.message;
      
      // Handle specific database connection errors
      if (error.message.includes('Authentication failed')) {
        errorMessage = '❌ Wrong username or password. Please check your credentials.';
      } else if (error.message.includes('Access denied')) {
        errorMessage = '❌ Access denied. Please check your database permissions.';
      } else if (error.message.includes('Database not found')) {
        errorMessage = '❌ Database not found. Please check your database name.';
      } else if (error.message.includes('Connection refused') || error.message.includes('ECONNREFUSED')) {
        errorMessage = '❌ Cannot connect to database server. Please check if PostgreSQL is running and the host/port is correct.';
      } else if (error.message.includes('timeout')) {
        errorMessage = '❌ Connection timeout. Please check your network and database server.';
      }
      
      setPostgresError(errorMessage);
    } finally {
      setPostgresLoading(false);
    }
  };
  
  // Helper function to process file/directory entries from drag and drop
  const processEntry = async (entry, files, path = '') => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        // It's a file
        entry.file((file) => {
          // Create a new file object with the full path set as webkitRelativePath
          const fullPath = path ? `${path}/${file.name}` : file.name;
          
          // Create a new File object with webkitRelativePath
          const newFile = new File([file], file.name, { 
            type: file.type,
            lastModified: file.lastModified 
          });
          
          // Set the webkitRelativePath property
          Object.defineProperty(newFile, 'webkitRelativePath', {
            value: fullPath,
            writable: false
          });
          
          files.push(newFile);
          resolve();
        }, (error) => {
          console.error('Error reading file:', error);
          resolve();
        });
      } else if (entry.isDirectory) {
        // It's a directory
        const dirReader = entry.createReader();
        dirReader.readEntries(async (entries) => {
          const newPath = path ? `${path}/${entry.name}` : entry.name;
          
          // Process all entries in this directory
          for (const childEntry of entries) {
            await processEntry(childEntry, files, newPath);
          }
          resolve();
        }, (error) => {
          console.error('Error reading directory:', error);
          resolve();
        });
      }
    });
  };

  // Handle local file upload
  const handleLocalUpload = (files, append = false) => {
    
    // Check if we have files with webkitRelativePath (folder upload)
    const hasFolderStructure = files.some(file => file.webkitRelativePath && file.webkitRelativePath.includes('/'));
    
    // Validate that we have files
    if (!files || files.length === 0) {
      console.error('No files received in upload');
      setImportError('No files were uploaded. Please try again.');
      return;
    }
    
    if (append && localFiles.length > 0) {
      // Append new files to existing ones
      const combinedFiles = [...localFiles, ...files];
      setLocalFiles(combinedFiles);
      
      // Auto-select only the new files
      const newFilePaths = files.map(f => f.webkitRelativePath || f.name);
      setSelectedFiles(prev => {
        const newSelection = [...prev];
        newFilePaths.forEach(filePath => {
          if (!newSelection.includes(filePath)) {
            newSelection.push(filePath);
          }
        });
        return newSelection;
      });
    } else {
      // First upload - replace all files
      setLocalFiles(files);
      // Auto-advance to file selection step after upload
      setActiveStep(STEPS.FILE_SELECTION);
      
      // Auto-select all local files when opening file selection
      autoSelectAllFiles(files);
    }
  };
  
  // Handle file selection
  const handleFileToggle = useCallback((filename) => {
    setSelectedFiles(prev => 
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  }, []);
  
  // Handle file/folder deletion
  const handleDelete = (itemPath, itemType) => {
    
    if (dataSource === 'postgres') {
      // Handle PostgreSQL object deletion
      if (itemType === 'file') {
        // Remove table/view from postgresFiles and selectedFiles
        setPostgresFiles(prev => prev.filter(file => {
          const filePath = file.webkitRelativePath || file.name;
          return filePath !== itemPath;
        }));
        
        setSelectedFiles(prev => prev.filter(filePath => filePath !== itemPath));
      } else if (itemType === 'folder') {
        // Remove all objects in the schema from postgresFiles and selectedFiles
        const schemaName = itemPath;
        
        setPostgresFiles(prev => prev.filter(file => {
          const filePath = file.webkitRelativePath || file.name;
          return !filePath.startsWith(schemaName + '.') && filePath !== schemaName;
        }));
        
        setSelectedFiles(prev => prev.filter(filePath => 
          !filePath.startsWith(schemaName + '.') && filePath !== schemaName
        ));
      }
    } else if (dataSource === 's3') {
      // Handle S3 file deletion
      if (itemType === 'file') {
        // Remove file from s3Files and selectedFiles
        setS3Files(prev => prev.filter(file => {
          const filePath = file.webkitRelativePath || file.name;
          return filePath !== itemPath;
        }));
        
        setSelectedFiles(prev => prev.filter(filePath => filePath !== itemPath));
      } else if (itemType === 'folder') {
        // Remove all files in the folder from s3Files and selectedFiles
        const folderPath = itemPath;
        
        setS3Files(prev => prev.filter(file => {
          const filePath = file.webkitRelativePath || file.name;
          return !filePath.startsWith(folderPath + '/') && filePath !== folderPath;
        }));
        
        setSelectedFiles(prev => prev.filter(filePath => 
          !filePath.startsWith(folderPath + '/') && filePath !== folderPath
        ));
      }
    } else {
      // Handle local file deletion (existing logic)
      if (itemType === 'file') {
        // Remove file from localFiles and selectedFiles
        setLocalFiles(prev => prev.filter(file => {
          const filePath = file.webkitRelativePath || file.name;
          return filePath !== itemPath;
        }));
        
        setSelectedFiles(prev => prev.filter(filePath => filePath !== itemPath));
      } else if (itemType === 'folder') {
        // Remove all files in the folder from localFiles and selectedFiles
        const folderPath = itemPath;
        
        setLocalFiles(prev => prev.filter(file => {
          const filePath = file.webkitRelativePath || file.name;
          return !filePath.startsWith(folderPath + '/') && filePath !== folderPath;
        }));
        
        setSelectedFiles(prev => prev.filter(filePath => 
          !filePath.startsWith(folderPath + '/') && filePath !== folderPath
        ));
      }
    }
  };
  
  // Handle folder selection
  const handleFolderToggle = (node, path = '') => {
    
    // Get all files recursively under this folder
    const getAllFilesInFolder = (folderNode, folderPath = '') => {
      let files = [];
      
      for (const [key, value] of Object.entries(folderNode)) {
        if (key.startsWith('__')) continue; // Skip metadata properties
        
        if (value && value.__file) {
          // This is a file - extract the file path
          const filePath = value.__file;
          files.push(filePath);
        } else if (value && typeof value === 'object' && !value.__file) {
          // This is a subfolder, recursively get its files
          const subPath = folderPath ? `${folderPath}/${key}` : key;
          files = files.concat(getAllFilesInFolder(value, subPath));
        }
      }
      return files;
    };

    const folderFiles = getAllFilesInFolder(node, path);
    
    // Check if all files in the folder are currently selected
    const allSelected = folderFiles.every(file => selectedFiles.includes(file));
    
    if (allSelected) {
      // If all are selected, deselect all files in the folder
      setSelectedFiles(prev => prev.filter(file => !folderFiles.includes(file)));
    } else {
      // If not all are selected, select all files in the folder
      setSelectedFiles(prev => {
        const newSelection = [...prev];
        folderFiles.forEach(file => {
          if (!newSelection.includes(file)) {
            newSelection.push(file);
          }
        });
        return newSelection;
      });
    }
    
    // Note: The folder will stay expanded because we're using expandedItems state in FileTree
  };


  
  // Handle import
  const handleImport = async () => {
    if (selectedFiles.length === 0) return;
    
    const jobId = crypto.randomUUID();
    setImportProgress({ jobId, progress: 0, isImporting: true, message: 'Starting import...' });
    setActiveStep(STEPS.IMPORT_PROGRESS);
    
    try {
      let endpoint;
      let body;
      
      if (dataSource === 's3') {
        endpoint = 'rest/load-s3-progress';
        body = { 
          files: selectedFiles, 
          jobId, 
          accessKey: s3Config.accessKey,
          secretKey: s3Config.secretKey,
          bucket: s3Config.s3Path,
          region: s3Config.region,
          path: ''
        };
      } else if (dataSource === 'postgres') {
        endpoint = 'rest/load-postgres-progress';
        body = {
          ...postgresConfig,
          tables: selectedFiles,
          jobId
        };
      } else {
        endpoint = 'rest/load-local-progress';
        body = { files: selectedFiles, jobId };
      }
      
      const res = await fetch(`http://localhost:8080/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
                setActiveStep(STEPS.SUCCESS);
              } else {
                setImportError(progressData.message || 'Import failed with errors.');
              }
              return;
            }
          }
        } catch (err) {
          console.error('Progress polling error:', err);
        }
        
        setTimeout(pollProgress, 1000);
      };
      
      pollProgress();
      
    } catch (err) {
      console.error('Import error:', err);
      setImportError('Import failed: ' + err.message);
      setImportProgress({ jobId: null, progress: 0, isImporting: false, message: '' });
    }
  };
  
  // Handle restart
  const handleRestart = () => {
    setActiveStep(STEPS.CONNECTION);
    setDataSource('local');
    setS3Config({ accessKey: '', secretKey: '', region: 'eu-central-1', s3Path: '' });
    setS3Files([]);
    setPostgresConfig({ host: 'localhost', port: 5433, database: 'testdb', username: 'postgres', password: 'test123', schema: '' });
    setPostgresFiles([]);
    setPostgresError(''); // Clear PostgreSQL error
    setLocalFiles([]);
    setSelectedFiles([]);
    setImportProgress({ jobId: null, progress: 0, isImporting: false, message: '' });
    setImportError('');
  };
  
  // Get current files based on data source - treat all the same way
  const getCurrentFiles = () => {
    const files = (() => {
      switch (dataSource) {
        case 'local':
          return localFiles || [];
        case 's3':
          return s3Files || [];
        case 'postgres':
          return postgresFiles || [];
        default:
          return [];
      }
    })();
    

    
    return files;
  };
  
  // Filter files based on type and search - identical for both data sources
  const getFilteredFiles = () => {
    const files = getCurrentFiles();
    
    if (!Array.isArray(files) || files.length === 0) {
      return [];
    }
    

    
    // Apply filtering to files - same logic for both local and S3
    const filtered = files.filter(f => {
      const filePath = f.webkitRelativePath || f.name;
      const fileName = f.name || '';
      const fileExtension = fileName.split('.').pop().toLowerCase();
      
      // Check if file type matches (All or specific extension)
      const matchesType = fileType === 'All' || fileExtension === fileType.toLowerCase();
      
      // Enhanced search: check file path, name, and extension
      const searchLower = search.toLowerCase();
      const matchesSearch = search === '' || 
        filePath.toLowerCase().includes(searchLower) ||
        fileName.toLowerCase().includes(searchLower) ||
        (searchLower.startsWith('.') && fileExtension.includes(searchLower.substring(1))) ||
        (searchLower.includes('.') && fileExtension.includes(searchLower.split('.').pop()));
      
      return matchesType && matchesSearch;
    });
    

    
    return filtered;
  };
  
  const filteredFiles = getFilteredFiles();
  
  // Build tree data - both local and S3 now use the same strategy
  const treeData = React.useMemo(() => {
    // Both local and S3 now use the same strategy: build tree from filteredFiles
    if (!filteredFiles || filteredFiles.length === 0) {
      return {};
    }
    
    // Use the proper buildFileTree function to create hierarchical structure
    const tree = buildFileTree(filteredFiles);
    
    // Attach handlers to each file node
    function attachHandlers(node) {
      for (const key in node) {
        if (node[key].__file) {
          node[key].selected = selectedFiles.includes(node[key].__file);
          node[key].onToggle = () => handleFileToggle(node[key].__file);
        } else if (typeof node[key] === 'object') {
          attachHandlers(node[key]);
        }
      }
    }
    attachHandlers(tree);
    
    return tree;
  }, [filteredFiles, selectedFiles, handleFileToggle, dataSource]);
  
  const renderStepContent = () => {
    switch (activeStep) {
      case STEPS.CONNECTION:
        return (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                Choose Data Source
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant={dataSource === 'local' ? 'contained' : 'outlined'}
                  onClick={() => handleDataSourceChange('local')}
                  sx={{ flex: 1 }}
                  size="large"
                  startIcon={<UploadFileIcon />}
                >
                  Local Files
                </Button>
                
                <Button
                  variant={dataSource === 's3' ? 'contained' : 'outlined'}
                  onClick={() => handleDataSourceChange('s3')}
                  sx={{ flex: 1 }}
                  size="large"
                  startIcon={
                    <img 
                      src="/s3.png" 
                      alt="S3 Logo" 
                      width="20" 
                      height="20"
                    />
                  }
                >
                  Amazon S3
                </Button>

                <Button
                  variant={dataSource === 'postgres' ? 'contained' : 'outlined'}
                  onClick={() => handleDataSourceChange('postgres')}
                  sx={{ flex: 1 }}
                  size="large"
                  startIcon={
                    <img 
                      src="/postgresql.svg" 
                      alt="PostgreSQL Logo" 
                      width="20" 
                      height="20"
                    />
                  }
                >
                  PostgreSQL
                </Button>
              </Box>
              
              {dataSource === 'local' && (
                <Box mt={3}>
                  <LocalInput
                    fileType={localFileType}
                    onFileTypeChange={e => setLocalFileType(e.target.value)}
                    search={localSearch}
                    onSearchChange={e => setLocalSearch(e.target.value)}
                    onUpload={handleLocalUpload}
                    onUploadMultiple={handleLocalUpload}
                    uploading={false}
                    isDragOver={localDragOver}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setLocalDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setLocalDragOver(false);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setLocalDragOver(false);
                      
                      // Handle dropped items (can be files or directories)
                      const items = Array.from(e.dataTransfer.items);
                      
                      const files = [];
                      
                      // Process each dropped item
                      for (const item of items) {
                        if (item.kind === 'file') {
                          const entry = item.webkitGetAsEntry();
                          if (entry) {
                            await processEntry(entry, files);
                          }
                        }
                      }
                      
                      if (files.length > 0) {
                        // First upload - don't append
                        handleLocalUpload(files, false);
                      }
                    }}
                  />
                </Box>
              )}
              
              {dataSource === 's3' && (
                <Box mt={3}>
                  <S3Input
                    config={s3Config}
                    onConfigChange={setS3Config}
                    onConnect={handleS3Connect}
                    loading={s3Loading}
                  />
                </Box>
              )}

              {dataSource === 'postgres' && (
                <Box mt={3}>
                  <PostgresInput
                    config={postgresConfig}
                    onConfigChange={setPostgresConfig}
                    onConnect={handlePostgresConnect}
                    loading={postgresLoading}
                    error={postgresError}
                  />
                </Box>
              )}
              
              {importError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {importError}
                </Alert>
              )}
            </CardContent>
          </Card>
        );
        
      case STEPS.FILE_SELECTION:
        return (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                Select Files to Import
              </Typography>
              
              {/* Show PostgreSQL error if any */}
              {dataSource === 'postgres' && postgresError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {postgresError}
                </Alert>
              )}
              

              
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControl size="small" sx={{ minWidth: 100 }}>
                    <InputLabel id="file-type-label">Type</InputLabel>
                    <Select
                      labelId="file-type-label"
                      value={fileType}
                      label="Type"
                      onChange={e => setFileType(e.target.value)}
                    >
                      <MenuItem value="All">All Files</MenuItem>
                      <MenuItem value="csv">CSV</MenuItem>
                      <MenuItem value="json">JSON</MenuItem>
                      <MenuItem value="parquet">Parquet</MenuItem>
                      <MenuItem value="pdf">PDF</MenuItem>
                      <MenuItem value="txt">Text</MenuItem>
                      <MenuItem value="sql">SQL</MenuItem>
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
                  
                  <Button
                    variant="outlined"
                    component="label"
                    size="small"
                    startIcon={<UploadIcon />}
                  >
                    Choose More Files
                    <input
                      type="file"
                      hidden
                      multiple
                      webkitdirectory="true"
                      onChange={e => handleLocalUpload(Array.from(e.target.files), true)}
                    />
                  </Button>
                  
                  {selectedFiles.length > 0 && (
                    <Button 
                      size="small" 
                      variant="outlined" 
                      color="error"
                      onClick={() => setSelectedFiles([])}
                    >
                      Clear Selection
                    </Button>
                  )}
                </Stack>
              </Box>
              

              
              {Object.keys(treeData).length === 0 ? (
                <Box sx={{ 
                  height: 400, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'text.secondary',
                  border: '1px dashed #ccc',
                  borderRadius: 1
                }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" textAlign="center">
                      {dataSource === 's3' 
                        ? 'No S3 files found. Please check your connection and path.'
                        : dataSource === 'postgres'
                        ? 'No PostgreSQL tables found. Please check your connection and schema selection.'
                        : 'No local files uploaded. Please upload files to continue.'
                      }
                    </Typography>
                    {dataSource === 'local' && (
                      <Box sx={{ textAlign: 'center', fontSize: '12px', color: 'text.secondary' }}>
                        <div>Debug Info:</div>
                        <div>localFiles: {localFiles.length}</div>
                        <div>filteredFiles: {filteredFiles.length}</div>
                        <div>treeData keys: {Object.keys(treeData).length}</div>
                        <div>Sample files: {localFiles.slice(0, 3).map(f => f.name).join(', ')}</div>
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{ 
                    position: 'relative',
                    border: dataSource === 'local' ? '2px solid transparent' : 'none',
                    borderRadius: 2,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      border: dataSource === 'local' ? '2px solid rgba(25, 118, 210, 0.3)' : '2px solid transparent'
                    }
                  }}
                  onDragOver={(e) => {
                    if (dataSource === 'local') {
                      e.preventDefault();
                      e.currentTarget.style.border = '2px dashed #1976d2';
                      e.currentTarget.style.background = 'rgba(25, 118, 210, 0.05)';
                      // Show drag message only when something is being dragged
                      setShowDragMessage(true);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (dataSource === 'local') {
                      e.preventDefault();
                      e.currentTarget.style.border = '';
                      e.currentTarget.style.background = '';
                      // Hide drag message when drag leaves
                      setShowDragMessage(false);
                    }
                  }}
                  onDragEnter={(e) => {
                    if (dataSource === 'local') {
                      e.preventDefault();
                      // Show drag message when drag enters
                      setShowDragMessage(true);
                    }
                  }}
                  onDrop={async (e) => {
                    if (dataSource === 'local') {
                      e.preventDefault();
                      e.currentTarget.style.border = '';
                      e.currentTarget.style.background = '';
                      
                      // Hide drag message when files are dropped
                      setShowDragMessage(false);
                      
                      // Simple approach: just use the items for folder structure
                      const items = Array.from(e.dataTransfer.items);
                      
                      const files = [];
                      
                      // Process each dropped item to maintain folder structure
                      for (const item of items) {
                        if (item.kind === 'file') {
                          const entry = item.webkitGetAsEntry();
                          if (entry) {
                            await processEntry(entry, files);
                          }
                        }
                      }
                      
                      if (files.length > 0) {
                        // Append new files to existing ones
                        handleLocalUpload(files, true);
                      }
                    }
                  }}
                >
                  {/* Subtle hint that drag and drop is available */}
                  {dataSource === 'local' && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: 'rgba(25, 118, 210, 0.9)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: 1,
                        fontSize: '12px',
                        fontWeight: 500,
                        zIndex: 5,
                        opacity: 0,
                        transition: 'opacity 0.2s ease-in-out',
                        pointerEvents: 'none',
                        '&:hover': {
                          opacity: 1
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = 1;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = 0;
                      }}
                    >
                      💡 Drag files here
                    </Box>
                  )}
                  
                  {/* Friendly message about drag and drop capability - appears ONLY during drag */}
                  {dataSource === 'local' && showDragMessage && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '8px 16px',
                        borderRadius: 3,
                        fontSize: '13px',
                        fontWeight: 500,
                        zIndex: 5,
                        opacity: showDragMessage ? 1 : 0,
                        transition: 'opacity 0.2s ease-in-out',
                        pointerEvents: 'none',
                        maxWidth: '250px',
                        textAlign: 'center',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Drop files here to add more
                    </Box>
                  )}
                  
                  
                  <FileTree
                    files={filteredFiles}
                    selectedFiles={selectedFiles}
                    onFileToggle={handleFileToggle}
                    onFolderToggle={handleFolderToggle}
                    onDelete={handleDelete}
                    height={400}
                    maxWidth="100%"
                    isTreeData={false}
                    dataSource={dataSource}
                    postgresConfig={dataSource === 'postgres' ? postgresConfig : null}
                  />
                </Box>
              )}
              

              
              {selectedFiles.length > 0 && (
                <Typography variant="body2" color="text.secondary" mt={1}>
                  <span style={{ color: '#1976d2', fontWeight: 'bold' }}>
                    Ready to import
                  </span>
                </Typography>
              )}
            </CardContent>
            
            <CardActions>
              <Button onClick={handleGoBack}>
                <ArrowBack /> Back
              </Button>
              <Button
                variant="contained"
                onClick={handleImport}
                disabled={selectedFiles.length === 0 || (dataSource === 'postgres' && postgresFiles.length === 0)}
                sx={{ ml: 'auto' }}
              >
                Import Selected Files <ArrowForward />
              </Button>
            </CardActions>
          </Card>
        );
        
      case STEPS.IMPORT_PROGRESS:
        return (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                Importing Files
              </Typography>
              
              <ProgressBar
                isImporting={importProgress.isImporting}
                progress={importProgress.progress}
                message={importProgress.message}
              />
              
              {importError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {importError}
                </Alert>
              )}
            </CardContent>
          </Card>
        );
        
      case STEPS.SUCCESS:
        return (
          <Card>
            <CardContent sx={{ textAlign: 'center', p: 3 }}>
              <CheckCircle color="success" sx={{ fontSize: 64, mb: 3 }} />
              <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                Import Completed Successfully!
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedFiles.length} files have been imported successfully.
              </Typography>
            </CardContent>
            
            <CardActions sx={{ justifyContent: 'center', mt: 4, mb: 4 }}>
              <Button variant="contained" onClick={handleRestart}>
                Import More Files
              </Button>
            </CardActions>
          </Card>
        );
        
      default:
        return null;
    }
  };
  
  const getStepLabel = (step) => {
    switch (step) {
      case STEPS.CONNECTION: return 'Data Source';
      case STEPS.FILE_SELECTION: return 'File Selection';
      case STEPS.IMPORT_PROGRESS: return 'Import Progress';
      case STEPS.SUCCESS: return 'Complete';
      default: return '';
    }
  };
  
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 6, p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom align="center" sx={{ mb: 4 }}>
          Data Import Wizard
        </Typography>
        
        <Stepper activeStep={activeStep} sx={{ mb: 6 }}>
          {Object.values(STEPS).map((step) => (
            <Step key={step}>
              <StepLabel>{getStepLabel(step)}</StepLabel>
            </Step>
          ))}
        </Stepper>
        
        {renderStepContent()}
      </Paper>
    </Box>
  );
}
