const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory storage for predictions (no MongoDB required)
const predictionHistory = [];

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads/'));
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Routes
app.post('/api/predict', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    const imagePath = req.file.path;
    const absoluteImagePath = path.resolve(imagePath);

    // Python script options
    const options = {
        mode: 'text',
        pythonOptions: ['-u'], // get print results in real-time
        scriptPath: __dirname,
        args: [absoluteImagePath, req.file.originalname]
    };

    PythonShell.run('predict_api.py', options).then(results => {
        // results is an array consisting of messages collected during execution
        try {
            // The last line should be the JSON result
            const lastLine = results[results.length - 1];
            const predictionResult = JSON.parse(lastLine);

            // Save to in-memory storage
            const newPrediction = {
                imagePath: 'uploads/' + req.file.filename,
                prediction: predictionResult.class,
                confidence: predictionResult.confidence,
                timestamp: new Date()
            };

            predictionHistory.push(newPrediction);

            // Return the result
            res.json(newPrediction);

        } catch (e) {
            console.error("Error parsing Python output:", results);
            res.status(500).json({ error: 'Prediction failed', details: results });
        }
    }).catch(err => {
        console.error("PythonShell Error:", err);
        res.status(500).json({ error: 'Inference error', details: err.message });
    });
});

app.get('/api/history', async (req, res) => {
    try {
        // Return last 10 predictions from in-memory storage
        const history = predictionHistory.slice(-10).reverse();
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch history' });
    }
});

// Serve static assets from frontend build if available
const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
    });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
