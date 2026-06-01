require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function saveUploadMetadata(metadata) {
  if (!supabase) return;

  const payload = {
    original_name: metadata.originalName,
    stored_name: metadata.storedName,
    size: metadata.size,
    fps: metadata.fps,
    status: metadata.status,
    error_message: metadata.errorMessage || null,
    processed_at: new Date().toISOString()
  };

  const { error } = await supabase.from('video_uploads').insert(payload);
  if (error) {
    console.error('Supabase save error:', error);
  }
}

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [];

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// Simple health endpoint for load balancers and container platforms
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${cleanName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

app.use(express.static(path.join(__dirname)));

app.post('/process', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file uploaded.' });
  }

  const fps = req.body.fps || '60';
  const scaleMap = { '60': '2', '120': '6', '240': '12' };
  const scale = scaleMap[fps] || '2';

  const inputPath = req.file.path;
  const outputFilename = `${path.parse(req.file.originalname).name}_output.mp4`;
  const outputPath = path.join(outputDir, outputFilename);

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const localFfmpeg = path.join(__dirname, 'ffmpeg.exe');
  const ffmpegCmd = fs.existsSync(localFfmpeg) ? localFfmpeg : 'ffmpeg';
  const args = ['-y', '-itsscale', scale, '-i', inputPath, '-c:v', 'copy', '-c:a', 'copy', outputPath];
  const ffmpeg = spawn(ffmpegCmd, args, { shell: false });
  let responded = false;

  const cleanupFiles = () => {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
  };

  const sendError = (status, message) => {
    if (responded) return;
    responded = true;
    cleanupFiles();
    res.status(status).json({ error: message });
  };

  ffmpeg.stderr.on('data', (data) => {
    console.log(`[ffmpeg] ${data}`);
  });

  ffmpeg.on('error', (err) => {
    console.error('Failed to start ffmpeg:', err);
    if (responded) return;
    if (err.code === 'ENOENT') {
      sendError(500, 'ffmpeg was not found. Install ffmpeg or place ffmpeg.exe next to server.js.');
    } else {
      sendError(500, 'Failed to run ffmpeg. Make sure ffmpeg is installed on the server.');
    }
  });

  ffmpeg.on('close', async (code) => {
    if (responded) return;
    if (code !== 0) {
      console.error(`ffmpeg exited with code ${code}`);
      await saveUploadMetadata({
        originalName: req.file.originalname,
        storedName: req.file.filename,
        size: req.file.size,
        fps,
        status: 'failed',
        errorMessage: 'ffmpeg exited with non-zero code'
      });
      return sendError(500, 'Video processing failed.');
    }

    responded = true;
    await saveUploadMetadata({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      fps,
      status: 'processed'
    });

    res.download(outputPath, outputFilename, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      cleanupFiles();
    });
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`RZN HD Uploader server running on http://localhost:${port}`);
});
