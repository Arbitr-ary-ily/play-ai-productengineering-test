"use client"

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronLeft, 
  ChevronRight, 
  Play,
  Pause,
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Import pdfjs-dist
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

const formatTime = (timeInSeconds) => {
  if (timeInSeconds == null || isNaN(timeInSeconds)) {
    return "0:00";
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Add AudioControls component for better organization
const AudioControls = ({ 
  isPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  isLoading,
  audioError,
  hasExistingAudio,
  continuousPlayback,
  generationProgress,
  onSliderChange,
  onSliderCommit
}) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center flex-grow gap-2">
        <span className="text-sm font-medium text-gray-600">
          {formatTime(currentTime)}
        </span>
        
        <Slider
          value={[currentTime || 0]}
          max={duration || 100}
          step={0.1}
          onValueChange={onSliderChange}
          onValueCommit={onSliderCommit}
          disabled={isLoading || !duration}
          className="flex-grow"
        />
        
        <span className="text-sm font-medium text-gray-600">
          {formatTime(duration)}
        </span>
      </div>

      <Button 
        variant={isPlaying ? "destructive" : "default"} 
        onClick={onPlayPause}
        disabled={isLoading}
        className={isPlaying ? 
          "bg-red-500 hover:bg-red-600 transition-all duration-300" : 
          "bg-lime-500 hover:bg-lime-600 transition-all duration-300"
        }
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{generationProgress}%</span>
          </div>
        ) : isPlaying ? (
          <>
            <Pause className="w-4 h-4 mr-2" />
            Pause
          </>
        ) : (
          <>
            <Play className="w-4 h-4 mr-2" />
            {continuousPlayback ? 'Play Entire Book' : 'Play Page'}
          </>
        )}
      </Button>
    </div>
  );
};

export default function PDFViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pageWidth, setPageWidth] = useState(800);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [scale, setScale] = useState(1.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [continuousPlayback, setContinuousPlayback] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // Add text extraction states
  const [extractedPageCache, setExtractedPageCache] = useState({});
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [allPagesExtracted, setAllPagesExtracted] = useState(false);
  
  // Add audio caching state
  const [cachedAudio, setCachedAudio] = useState({});
  
  const AVAILABLE_VOICES = [
    {
      name: 'Angelo',
      value: 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json',
      style: 'Conversational',
    },
    {
      name: 'Deedee',
      value: 's3://voice-cloning-zero-shot/e040bd1b-f190-4bdb-83f0-75ef85b18f84/original/manifest.json',
      style: 'Conversational',
    },
    {
      name: 'Jennifer',
      value: 's3://voice-cloning-zero-shot/801a663f-efd0-4254-98d0-5c175514c3e8/jennifer/manifest.json',
      style: 'Conversational',
    }
  ];
  
  const [selectedVoice, setSelectedVoice] = useState(AVAILABLE_VOICES[0].value);
  const [speed, setSpeed] = useState(1.0);
  const [temperature, setTemperature] = useState(1.0);

  // Function to extract text from a page
  const extractPageText = async (pageNum) => {
    if (extractedPageCache[pageNum]) return extractedPageCache[pageNum];
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\\s+/g, ' ')
        .trim();
      
      setExtractedPageCache(prev => ({
        ...prev,
        [pageNum]: text
      }));
      
      return text;
    } catch (error) {
      console.error(`Error extracting text from page ${pageNum}:`, error);
      return null;
    }
  };

  // Function to get text for continuous playback
  const getTextForPages = async (startPage, endPage) => {
    const texts = [];
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const text = await extractPageText(pageNum);
      if (text) texts.push(text);
    }
    return texts.join(' ');
  };

  // Function to render the current page
  const renderPage = async (pageNum) => {
    if (!pdfDoc) return;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Extract text for the current page
      if (!extractedPageCache[pageNum]) {
        extractPageText(pageNum);
      }
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  // Load PDF document
  useEffect(() => {
    async function loadPDF() {
      try {
        const uploads = JSON.parse(localStorage.getItem('pdfUploads') || '[]');
        const pdfData = uploads.find(upload => upload.id === id);
        
        if (!pdfData || !pdfData.url) {
          console.error('PDF data not found');
          router.push('/');
          return;
        }
        
        setPdfUrl(pdfData.url);
        setPdfName(pdfData.name || 'Unnamed PDF');
        
        const loadingTask = pdfjsLib.getDocument(pdfData.url);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setIsLoading(false);
      }
    }

    loadPDF();
  }, [id, router]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [currentPage, pdfDoc, scale]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth - 48, 1200);
      setPageWidth(width);
      const newScale = (width / 595.276) * 1.2;
      setScale(newScale);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update audio time tracking
  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      
      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };
      
      const handleDurationChange = () => {
        setDuration(audio.duration);
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
        if (continuousPlayback && currentPage < totalPages) {
          setCurrentPage(prev => prev + 1);
        }
      };
      
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('durationchange', handleDurationChange);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [continuousPlayback, currentPage, totalPages]);

  // Clean up audio resources on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
      
      // Clean up cached audio URLs
      Object.values(cachedAudio).forEach(({ url }) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  const handleVoiceChange = (newVoice) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setSelectedVoice(newVoice);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setAudioError(null);
  };

  const handleSpeedChange = (value) => {
    setSpeed(value);
    if (audioRef.current) {
      audioRef.current.playbackRate = value;
    }
  };

  const handleTemperatureChange = (value) => {
    setTemperature(value);
  };

  const handleSliderChange = (values) => {
    const time = values[0];
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const fetchAndPlayAudio = async (text, pageNum) => {
    try {
      setIsLoadingAudio(true);
      setAudioError(null);
      setGenerationProgress(0);
      
      const cacheKey = `${id}-${pageNum}-${continuousPlayback ? 'continuous' : 'single'}-${selectedVoice}-${speed}-${temperature}`;
      
      // Check cache first
      if (cachedAudio[cacheKey]) {
        const { audio } = cachedAudio[cacheKey];
        audioRef.current = audio;
        await audio.play();
        setIsPlaying(true);
        setIsLoadingAudio(false);
        return;
      }
      
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 5, 95));
      }, 500);
      
      const response = await fetch('/api/pdf-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          speed,
          temperature,
          pageNum,
          continuous: continuousPlayback,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const data = await response.json();
      const audioData = atob(data.audio);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      const audio = new Audio(audioUrl);
      audio.playbackRate = speed;
      
      // Cache the audio
      setCachedAudio(prev => ({
        ...prev,
        [cacheKey]: { audio, url: audioUrl }
      }));
      
      audioRef.current = audio;
      await audio.play();
      
      setGenerationProgress(100);
      setIsPlaying(true);
      
    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError(error.message);
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handlePlayPause = async () => {
    try {
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      const text = continuousPlayback
        ? await getTextForPages(currentPage, totalPages)
        : await extractPageText(currentPage);

      if (!text) {
        throw new Error('No text available to read');
      }

      await fetchAndPlayAudio(text, currentPage);
    } catch (error) {
      console.error('Error in handlePlayPause:', error);
      setAudioError(error.message);
    }
  };

  const handleBackClick = () => {
    router.push('/');
  };

  if (!pdfUrl) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="mb-6 items-center">
        <div className="absolute top-4 left-4">
          <Button variant="outline" onClick={handleBackClick} className="mr-4" size="sm">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        <div className="mt-10">
          <h1 className="text-2xl font-medium text-gray-800">{pdfName}</h1>
        </div>
      </div>
      
      <div className="flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {currentPage} of {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setContinuousPlayback(!continuousPlayback)}
              className={`px-3 py-1.5 text-sm rounded-md ${continuousPlayback ? 'bg-lime-200 text-lime-900' : 'bg-gray-200 text-gray-600'}`}
            >
              {continuousPlayback ? 'Reading Entire Book' : 'Reading Single Page'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border">
          <Select value={selectedVoice} onValueChange={handleVoiceChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select voice" />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_VOICES.map((voice) => (
                <SelectItem key={voice.value} value={voice.value}>
                  {voice.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Speed:</span>
            <Slider
              value={[speed]}
              min={0.5}
              max={2.0}
              step={0.1}
              onValueChange={([value]) => handleSpeedChange(value)}
              className="w-[100px]"
            />
            <span className="text-sm">{speed.toFixed(1)}x</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Temperature:</span>
            <Slider
              value={[temperature]}
              min={0.5}
              max={1.5}
              step={0.1}
              onValueChange={([value]) => handleTemperatureChange(value)}
              className="w-[100px]"
            />
            <span className="text-sm">{temperature.toFixed(1)}</span>
          </div>

          <AudioControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            currentTime={currentTime}
            duration={duration}
            onSliderChange={handleSliderChange}
            onSliderCommit={handleSliderChange}
            isLoading={isLoadingAudio}
            audioError={audioError}
            hasExistingAudio={!!audioRef.current}
            continuousPlayback={continuousPlayback}
            generationProgress={generationProgress}
          />
        </div>
      </div>

      {audioError && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          {audioError}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="flex items-center justify-center min-h-[800px] p-4">
          {isLoading ? (
            <div className="text-center">
              <p className="text-gray-500">Loading PDF...</p>
            </div>
          ) : (
            <div className="pdf-container shadow-lg">
              <canvas ref={canvasRef} className="max-w-full" />
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          Powered by <Link href="https://play.ai" target="_blank" className="text-lime-500 hover:text-lime-600 transition-all duration-300 font-medium hover:underline">PlayAI Text-to-Speech</Link>
        </p>
      </div>
    </div>
  );
} 