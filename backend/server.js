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

app.use(
    '/uploads',
    express.static(path.join(__dirname, 'uploads'))
);


// In-memory storage
const predictionHistory = [];


// Multer Configuration
const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads/'));
    },

    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }

});


const upload = multer({
    storage: storage
});



// Prediction API
app.post('/api/predict', upload.single('image'), (req, res) => {


    if (!req.file) {
        return res.status(400).json({
            error: 'No image uploaded'
        });
    }


    const imagePath = req.file.path;
    const absoluteImagePath = path.resolve(imagePath);



    // Python executable
    const pythonCommand =
        process.platform === "win32"
            ? "python"
            : "python";



    const options = {

        mode: 'text',

        // IMPORTANT FOR RAILWAY
        pythonPath: pythonCommand,

        // unbuffered output
        pythonOptions: ['-u'],

        scriptPath: __dirname,

        args: [
            absoluteImagePath,
            req.file.originalname
        ]
    };



    PythonShell.run(
        'predict_api.py',
        options
    )

    .then(results => {


        try {


            console.log("Python Output:", results);


            const lastLine =
                results[results.length - 1];


            const predictionResult =
                JSON.parse(lastLine);



            const newPrediction = {


                imagePath:
                    'uploads/' + req.file.filename,


                prediction:
                    predictionResult.class,


                confidence:
                    predictionResult.confidence,


                timestamp:
                    new Date()

            };



            predictionHistory.push(newPrediction);



            res.json(newPrediction);



        }

        catch(error) {


            console.error(
                "JSON Parse Error:",
                results
            );


            res.status(500).json({

                error: "Prediction failed",

                details: results

            });

        }



    })

    .catch(err => {


        console.error(
            "PythonShell Error:",
            err
        );


        res.status(500).json({

            error: "Inference error",

            details: err.message

        });


    });


});





// Prediction History API
app.get('/api/history', (req, res) => {


    try {


        const history =
            predictionHistory
            .slice(-10)
            .reverse();


        res.json(history);


    }

    catch(error) {


        res.status(500).json({

            error:
            "Could not fetch history"

        });


    }


});





// Serve React frontend build
const distPath =
    path.join(__dirname, '../frontend/dist');



if(fs.existsSync(distPath)){


    app.use(
        express.static(distPath)
    );


    app.get('*', (req,res)=>{


        res.sendFile(
            path.resolve(
                distPath,
                'index.html'
            )
        );


    });


}




// Start Server
app.listen(
    PORT,
    ()=>{
        console.log(
            `Server running on port ${PORT}`
        );
    }
);