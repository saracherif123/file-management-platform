import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const TablePreviewDialog = ({ open, onClose, tableData, loading, error }) => {
  if (!tableData) return null;

  const { schema, sample } = tableData;
  const columns = schema?.columns || [];
  const rows = sample?.rows || [];

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        style: { maxHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Table Preview: {schema?.table}
          </Typography>
          <Button onClick={onClose} startIcon={<CloseIcon />}>
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Typography>Loading table preview...</Typography>
        )}

        {error && (
          <Typography color="error">Error: {error}</Typography>
        )}

        {!loading && !error && (
          <Box>
            {/* Schema Section */}
            <Typography variant="h6" gutterBottom>
              Schema ({columns.length} columns)
            </Typography>
            <TableContainer component={Paper} sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Column</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Nullable</strong></TableCell>
                    <TableCell><strong>Default</strong></TableCell>
                    <TableCell><strong>Max Length</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {columns.map((column, index) => (
                    <TableRow key={index}>
                      <TableCell>{column.name}</TableCell>
                      <TableCell>
                        <Chip 
                          label={column.type} 
                          size="small" 
                          variant="outlined"
                          color="primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={column.nullable === 'YES' ? 'NULL' : 'NOT NULL'} 
                          size="small" 
                          variant="outlined"
                          color={column.nullable === 'YES' ? 'default' : 'error'}
                        />
                      </TableCell>
                      <TableCell>{column.default || '-'}</TableCell>
                      <TableCell>{column.maxLength || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2 }} />

            {/* Sample Data Section */}
            <Typography variant="h6" gutterBottom>
              Sample Data ({rows.length} rows)
            </Typography>
            {rows.length > 0 ? (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {sample.columns?.map((col, index) => (
                        <TableCell key={index}><strong>{col}</strong></TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {sample.columns?.map((col, colIndex) => (
                          <TableCell key={colIndex}>
                            {row[col] !== null ? String(row[col]) : 'NULL'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="textSecondary">No data available</Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TablePreviewDialog;
