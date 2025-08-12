import React, { useState } from 'react';
import { 
  Stack, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Button, 
  IconButton, 
  InputAdornment 
} from '@mui/material';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

export default function S3Input({ 
  s3Options, 
  onS3Change, 
  onConnect, 
  loading = false 
}) {
  const [showSecretKey, setShowSecretKey] = useState(false);

  return (
    <Stack spacing={2} sx={{ flex: 1 }}>
      {/* First row: Access Key and Secret Key */}
      <Stack direction="row" spacing={2} alignItems="center">
        <TextField
          label="Access Key"
          name="accessKey"
          value={s3Options.accessKey}
          onChange={onS3Change}
          size="small"
          autoComplete="off"
          sx={{ flex: 1, minWidth: 200 }}
        />
        <TextField
          label="Secret Key"
          name="secretKey"
          value={s3Options.secretKey}
          onChange={onS3Change}
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
            onChange={onS3Change}
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
          onChange={onS3Change}
          size="small"
          sx={{ flex: 1, minWidth: 300 }}
        />
        <Button 
          variant="outlined" 
          onClick={onConnect} 
          disabled={loading}
          sx={{ minWidth: 100 }}
        >
          {loading ? 'Connecting...' : 'Connect'}
        </Button>
      </Stack>
    </Stack>
  );
}
