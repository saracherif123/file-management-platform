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
  Alert
} from '@mui/material';
import { ArrowBack, ArrowForward, CheckCircle } from '@mui/icons-material';
import S3Input from './S3Input';
import LocalInput from './LocalInput';
import PostgresInput from './PostgresInput';
import FileTree, { buildFileTree } from './FileTree';
import ProgressBar from './ProgressBar';

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
  
  // Handle data source selection
  const handleDataSourceChange = (source) => {
    setDataSource(source);
    setS3Files([]);
    setLocalFiles([]);
    setSelectedFiles([]);
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
      
      console.log('Parsed S3 path:', { bucket, path, original: s3Path });
      
      // Create the request body in the format the backend expects
      const requestBody = {
        accessKey: s3Config.accessKey,
        secretKey: s3Config.secretKey,
        region: s3Config.region,
        bucket: bucket,
        path: path
      };
      
      console.log('Sending S3 request:', requestBody);
      
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
      console.log('S3 response:', result);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Extract all files recursively (no separate folders needed)
      const files = result.files || [];
      
      console.log('S3 recursive files:', files);
      console.log('S3 files count:', files.length);
      console.log('S3 files sample paths:', files.slice(0, 5));
      
      // Process S3 files exactly like local files - create same object structure
      console.log('Creating S3 file objects to match local files');
      
      const s3FileList = files.map(file => ({
        name: file.split('/').pop(), // Just the filename
        webkitRelativePath: file,    // Full path (exactly like local files)
        type: 'file',
        size: 0
      }));
      
      console.log('S3 file list created:', s3FileList.length, 'files');
      console.log('Sample S3 paths:', s3FileList.slice(0, 5).map(f => f.webkitRelativePath));
      
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

  // Handle PostgreSQL connection
  const handlePostgresConnect = async () => {
    setPostgresLoading(true);
    try {
      const response = await fetch('http://localhost:8080/rest/list-postgres-all-objects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postgresConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
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
      alert('Failed to connect to PostgreSQL: ' + error.message);
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
  const handleLocalUpload = (files) => {
    console.log('Local upload received files:', files);
    console.log('Files length:', files.length);
    console.log('First few files:', files.slice(0, 3).map(f => ({ 
      name: f.name, 
      webkitRelativePath: f.webkitRelativePath,
      type: f.type,
      size: f.size
    })));
    
    // Check if we have files with webkitRelativePath (folder upload)
    const hasFolderStructure = files.some(file => file.webkitRelativePath && file.webkitRelativePath.includes('/'));
    console.log('Has folder structure:', hasFolderStructure);
    
    // Validate that we have files
    if (!files || files.length === 0) {
      console.error('No files received in upload');
      setImportError('No files were uploaded. Please try again.');
      return;
    }
    
    console.log('Setting localFiles and advancing to step 2');
    setLocalFiles(files);
    // Auto-advance to file selection step after upload
    setActiveStep(STEPS.FILE_SELECTION);
  };
  
  // Handle file selection
  const handleFileToggle = useCallback((filename) => {
    setSelectedFiles(prev => 
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  }, []);
  
  // Handle folder selection
  const handleFolderToggle = (node, path = '') => {
    console.log('handleFolderToggle called with:', { node, path });
    
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
    console.log('Files in folder:', folderFiles);
    
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
  };


  
  // Handle import
  const handleImport = async () => {
    if (selectedFiles.length === 0) return;
    
    const jobId = crypto.randomUUID();
    setImportProgress({ jobId, progress: 0, isImporting: true, message: 'Starting import...' });
    setActiveStep(STEPS.IMPORT_PROGRESS);
    
    try {
      const endpoint = dataSource === 's3' ? 'rest/load-s3-progress' : 'rest/load-local-progress';
      const body = dataSource === 's3' 
        ? { files: selectedFiles, jobId, s3Config }
        : { files: selectedFiles, jobId };
      
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
    setLocalFiles([]);
    setSelectedFiles([]);
    setImportProgress({ jobId: null, progress: 0, isImporting: false, message: '' });
    setImportError('');
  };
  
  // Get current files based on data source - treat all the same way
  const getCurrentFiles = () => {
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
      const matchesType = fileType === 'All' || filePath.toLowerCase().endsWith('.' + fileType.toLowerCase());
      const matchesSearch = search === '' || filePath.toLowerCase().includes(search.toLowerCase());
      return matchesType && matchesSearch;
    });
    
    return filtered;
  };
  
  const filteredFiles = getFilteredFiles();
  
  // Build tree data - both local and S3 now use the same strategy
  const treeData = React.useMemo(() => {
    console.log('Building tree data with dataSource:', dataSource);
    
    // Both local and S3 now use the same strategy: build tree from filteredFiles
    if (!filteredFiles || filteredFiles.length === 0) {
      console.log('No files to build tree from, returning empty tree');
      return {};
    }
    
    console.log('Building tree from filteredFiles:', filteredFiles);
    
    // Use the proper buildFileTree function to create hierarchical structure
    const tree = buildFileTree(filteredFiles);
    console.log('buildFileTree result:', tree);
    
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
    console.log('Tree after attaching handlers:', tree);
    
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
                >
                  Local Files
                </Button>
                
                <Button
                  variant={dataSource === 's3' ? 'contained' : 'outlined'}
                  onClick={() => handleDataSourceChange('s3')}
                  sx={{ flex: 1 }}
                  size="large"
                >
                  Amazon S3
                </Button>

                <Button
                  variant={dataSource === 'postgres' ? 'contained' : 'outlined'}
                  onClick={() => handleDataSourceChange('postgres')}
                  sx={{ flex: 1 }}
                  size="large"
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
                      console.log('Dropped items:', items.length);
                      
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
                        console.log('Processed dropped files:', files.length);
                        console.log('Sample files:', files.slice(0, 3).map(f => ({ 
                          name: f.name, 
                          webkitRelativePath: f.webkitRelativePath || f.fullPath || f.name
                        })));
                        handleLocalUpload(files);
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
              

              
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <select
                    value={fileType}
                    onChange={e => setFileType(e.target.value)}
                    style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="All">All Files</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="parquet">Parquet</option>
                    <option value="pdf">PDF</option>
                    <option value="txt">Text</option>
                  </select>
                  
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ 
                      padding: '8px', 
                      borderRadius: '4px', 
                      border: '1px solid #ccc',
                      flex: 1 
                    }}
                  />
                  
                  {selectedFiles.length > 0 && (
                    <Button 
                      size="small" 
                      variant="outlined" 
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
                  <Typography variant="body2" textAlign="center">
                    {dataSource === 's3' 
                      ? 'No S3 files found. Please check your connection and path.'
                      : 'No local files uploaded. Please upload files to continue.'
                    }
                  </Typography>
                </Box>
              ) : (
                <FileTree
                  files={filteredFiles}
                  selectedFiles={selectedFiles}
                  onFileToggle={handleFileToggle}
                  onFolderToggle={handleFolderToggle}
                  height={400}
                  maxWidth="100%"
                  isTreeData={false}
                />
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
              <Button onClick={() => setActiveStep(STEPS.CONNECTION)}>
                <ArrowBack /> Back
              </Button>
              <Button
                variant="contained"
                onClick={handleImport}
                disabled={selectedFiles.length === 0}
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
                {selectedFiles.length} files have been imported to DataLoom.
              </Typography>
            </CardContent>
            
            <CardActions sx={{ justifyContent: 'center' }}>
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
