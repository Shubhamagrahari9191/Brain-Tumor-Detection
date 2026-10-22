import React, { useState, useRef } from 'react';
import { Upload, X, FileImage, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

/**
 * Validates whether an image file is a legitimate Brain MRI scan in the browser.
 * Performs fast pixel-level heuristics using an offscreen canvas:
 * 1. Grayscale check (Color saturation / channel differences)
 * 2. Contrast & anatomical structure check
 * 3. Dark background / corner check
 * 4. Central tissue presence check
 */
const verifyBrainMriInBrowser = (file) => {
    return new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
            return resolve({
                valid: false,
                reason: 'Only image files (JPG, PNG, WebP) are supported.'
            });
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;

            if (w < 50 || h < 50) {
                return resolve({
                    valid: false,
                    reason: 'Image resolution is too low to be a diagnostic brain MRI scan.'
                });
            }

            // Downsample onto an offscreen canvas for instantaneous analysis
            const sampleSize = 100;
            const canvas = document.createElement('canvas');
            canvas.width = sampleSize;
            canvas.height = sampleSize;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

            const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
            let totalColorDiff = 0;
            let lums = [];
            const pixelCount = sampleSize * sampleSize;

            for (let i = 0; i < imgData.length; i += 4) {
                const r = imgData[i];
                const g = imgData[i + 1];
                const b = imgData[i + 2];

                // Difference between color channels (grayscale has ~0 difference)
                const colorDiff = (Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r)) / 3.0;
                totalColorDiff += colorDiff;

                // Standard luminance
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                lums.push(lum);
            }

            // 1. Color check (MRI scans are grayscale medical images)
            const avgColorDiff = totalColorDiff / pixelCount;
            if (avgColorDiff > 12.0) {
                return resolve({
                    valid: false,
                    reason: 'Color image detected. Only grayscale Brain MRI scans are accepted.'
                });
            }

            // 2. Contrast check (Must have distinct tissue structure, not solid blank or uniform)
            const meanLum = lums.reduce((acc, v) => acc + v, 0) / pixelCount;
            const variance = lums.reduce((acc, v) => acc + Math.pow(v - meanLum, 2), 0) / pixelCount;
            const stdLum = Math.sqrt(variance);
            if (stdLum < 15.0) {
                return resolve({
                    valid: false,
                    reason: 'Image lacks contrast or anatomical structures.'
                });
            }

            // 3. Corner / Outer background check (Brain MRIs have dark outer background)
            const margin = Math.floor(sampleSize * 0.08); // 8% corners
            let cornerPixels = [];
            for (let y = 0; y < margin; y++) {
                for (let x = 0; x < margin; x++) {
                    cornerPixels.push(lums[y * sampleSize + x]); // top-left
                    cornerPixels.push(lums[y * sampleSize + (sampleSize - 1 - x)]); // top-right
                    cornerPixels.push(lums[(sampleSize - 1 - y) * sampleSize + x]); // bottom-left
                    cornerPixels.push(lums[(sampleSize - 1 - y) * sampleSize + (sampleSize - 1 - x)]); // bottom-right
                }
            }
            const avgCorner = cornerPixels.reduce((a, b) => a + b, 0) / cornerPixels.length;
            if (avgCorner > 105.0) {
                return resolve({
                    valid: false,
                    reason: 'Bright background detected. Brain MRI scans must have a dark background.'
                });
            }

            // 4. Central tissue check (Brain tissue is centered with higher brightness)
            let centerLums = [];
            const start = Math.floor(sampleSize * 0.25);
            const end = Math.floor(sampleSize * 0.75);
            for (let y = start; y < end; y++) {
                for (let x = start; x < end; x++) {
                    centerLums.push(lums[y * sampleSize + x]);
                }
            }
            const avgCenter = centerLums.reduce((a, b) => a + b, 0) / centerLums.length;
            if (avgCenter < 18.0) {
                return resolve({
                    valid: false,
                    reason: 'No central brain anatomical structures detected.'
                });
            }

            // 5. Dark background presence
            const darkCount = lums.filter(l => l < 40.0).length;
            const darkRatio = darkCount / pixelCount;
            if (darkRatio < 0.005) {
                return resolve({
                    valid: false,
                    reason: 'Image lacks characteristic MRI background.'
                });
            }

            return resolve({ valid: true });
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({
                valid: false,
                reason: 'Unable to read the image file. Please provide a valid JPG, PNG, or WebP.'
            });
        };

        img.src = objectUrl;
    });
};

const ImageUpload = ({ onImageSelect, isProcessing }) => {
    const [preview, setPreview] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [validationError, setValidationError] = useState(null);
    const [isValidating, setIsValidating] = useState(false);
    const [verifiedFileName, setVerifiedFileName] = useState('');
    const inputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = async (file) => {
        setValidationError(null);

        if (!file.type.startsWith('image/')) {
            setValidationError('Only image files (JPG, PNG, WebP) are supported.');
            return;
        }

        setIsValidating(true);
        const verification = await verifyBrainMriInBrowser(file);
        setIsValidating(false);

        if (!verification.valid) {
            setValidationError(`Invalid Image: Only Brain MRI scans are accepted. ${verification.reason}`);
            setPreview(null);
            onImageSelect(null, null);
            if (inputRef.current) {
                inputRef.current.value = '';
            }
            return;
        }

        // Image is a verified brain MRI scan
        setVerifiedFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
            onImageSelect(file, reader.result);
        };
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setPreview(null);
        setValidationError(null);
        setVerifiedFileName('');
        onImageSelect(null, null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto space-y-4">
            {validationError && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-300 flex items-start space-x-3 animate-fade-in shadow-lg">
                    <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                    <div className="text-sm">
                        <p className="font-semibold text-red-200">Non-MRI Image Rejected</p>
                        <p className="mt-1 text-red-300/90">{validationError}</p>
                        <p className="mt-2 text-xs text-slate-400">
                            Tip: Please upload a standard axial, sagittal, or coronal brain MRI scan with a dark background.
                        </p>
                    </div>
                </div>
            )}

            {!preview ? (
                <div
                    className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 ease-in-out ${
                        dragActive
                            ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10"
                            : "border-slate-600 hover:border-blue-400/60 bg-slate-800/50 hover:bg-slate-800/80"
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        className="hidden"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        onChange={handleChange}
                        disabled={isProcessing || isValidating}
                    />

                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="p-4 bg-slate-700/80 rounded-full shadow-inner border border-slate-600">
                            <Upload className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-white">
                                {isValidating ? "Validating MRI scan..." : "Drop your Brain MRI scan here"}
                            </p>
                            <p className="text-sm text-slate-400 mt-1">
                                or click to browse from your device
                            </p>
                        </div>

                        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-700/50 border border-slate-600/60 text-xs text-slate-300">
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                            <span>Strictly Brain MRI scans only (Axial / Sagittal / Coronal)</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            disabled={isProcessing || isValidating}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
                        >
                            {isValidating ? "Checking Image..." : "Select MRI Scan"}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="relative bg-slate-800 rounded-xl overflow-hidden shadow-xl border border-slate-700">
                    <button
                        type="button"
                        onClick={clearImage}
                        disabled={isProcessing}
                        aria-label="Remove image"
                        className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/90 rounded-full text-white transition-colors z-10 backdrop-blur-sm"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <img
                        src={preview}
                        alt="MRI Preview"
                        className="w-full h-72 object-contain bg-black"
                    />
                    <div className="p-4 bg-slate-800/95 border-t border-slate-700 flex items-center justify-between">
                        <div className="flex items-center space-x-2 truncate">
                            <FileImage className="h-5 w-5 text-blue-400 shrink-0" />
                            <span className="text-sm text-slate-300 truncate font-mono">
                                {verifiedFileName || "MRI Scan"}
                            </span>
                        </div>
                        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Verified Brain MRI</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ImageUpload;
