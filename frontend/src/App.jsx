import React, { useState } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import ImageUpload from './components/ImageUpload';
import ResultDisplay from './components/ResultDisplay';
import { Loader2 } from 'lucide-react';

function App() {
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleImageSelect = async (file) => {
    if (!file) {
      setResult(null);
      setError(null);
      return;
    }

    setIsProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      // Use VITE_API_URL if configured for separate deployment, else fallback to relative /api
      let apiBase = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.trim().replace(/\/$/, '') : '';
      if (apiBase && !apiBase.startsWith('http://') && !apiBase.startsWith('https://')) {
        apiBase = `https://${apiBase}`;
      }
      const response = await axios.post(`${apiBase}/api/predict`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setResult(response.data);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err.response?.data?.error || 'Failed to analyze image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 font-sans">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
            <span>MRI-Only Verification Active • Non-MRI Images Rejected</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Brain Tumor Detection
          </h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Upload an authentic Brain MRI scan to classify and detect potential tumors using Deep Learning.
            Supports detection of <span className="text-slate-200 font-medium">Glioma</span>, <span className="text-slate-200 font-medium">Meningioma</span>, and <span className="text-slate-200 font-medium">Pituitary</span> tumors.
          </p>
        </div>

        <div className="space-y-8">
          <ImageUpload
            onImageSelect={handleImageSelect}
            isProcessing={isProcessing}
          />

          {isProcessing && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-4" />
              <p className="text-slate-400 animate-pulse">Analyzing MRI Scan...</p>
            </div>
          )}

          {error && (
            <div className="w-full max-w-xl mx-auto p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-200 text-center">
              {error}
            </div>
          )}

          <ResultDisplay result={result} />
        </div>
      </main>
    </div>
  );
}

export default App;
