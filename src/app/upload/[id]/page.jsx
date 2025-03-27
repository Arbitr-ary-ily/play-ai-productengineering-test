"use client"

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronLeft, 
  ChevronRight, 
  Play,
  Pause,
  ArrowLeft,
  SkipBack,
  SkipForward,
  Shuffle
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Howl, Howler } from 'howler';
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
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Add this function at the top of your PDFViewerPage component
const formatTime = (timeInSeconds) => {
  if (timeInSeconds == null || isNaN(timeInSeconds)) {
    return "0:00";
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

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
  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-1 mr-1">
      <div className="flex items-center gap-3 border rounded-lg p-3 bg-gray-50">
        <div className="flex items-center gap-3 min-w-[300px]">
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
            className="flex-1"
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
            <>
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {generationProgress.toFixed(0)}%
              </div>
            </>
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

        {audioError && (
          <span className="text-red-500 text-sm">
            {audioError}
          </span>
        )}

        {isLoading && (
          <div className="flex items-center gap-2">
            <div className="h-1 w-20 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-lime-500 transition-all duration-300"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <span className="text-sm text-gray-600">
              {generationProgress.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
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
  const [audioUrl, setAudioUrl] = useState(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const [pdfText, setPdfText] = useState([]);
  const [isExtractingText, setIsExtractingText] = useState(false);
  
  // Add a state to cache extracted text for each page
  const [extractedPageCache, setExtractedPageCache] = useState({});
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
    },
    {
      name: 'Briggs',
      value: 's3://voice-cloning-zero-shot/71cdb799-1e03-41c6-8a05-f7cd55134b0b/original/manifest.json',
      style: 'Narrative',
    },
    {
      name: 'Samara',
      value: 's3://voice-cloning-zero-shot/90217770-a480-4a91-b1ea-df00f4d4c29d/original/manifest.json',
      style: 'Conversational',
    }
  ];
  // Add this constant at the top of your component
  const DEFAULT_VOICE = 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json';
  
  // Add this state variable to track if all pages have been extracted
  const [allPagesExtracted, setAllPagesExtracted] = useState(false);
  const [pagesBeingExtracted, setPagesBeingExtracted] = useState(false);
  const [currentReadingPage, setCurrentReadingPage] = useState(1);
  const [continuousPlayback, setContinuousPlayback] = useState(true);
  const [pageChangeTimeout, setPageChangeTimeout] = useState(null);
  const [audioTimePerPage, setAudioTimePerPage] = useState({});
  
  // Add these state variables
  const [audioChunks, setAudioChunks] = useState([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);
  const [audioContext, setAudioContext] = useState(null);
  const [audioQueue, setAudioQueue] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaSourceRef = useRef(null);
  const sourceBufferRef = useRef(null);
  const [howlSound, setHowlSound] = useState(null);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Add these new state variables in PDFViewerPage
  const [selectedVoice, setSelectedVoice] = useState(AVAILABLE_VOICES[0].value);
  const [speed, setSpeed] = useState(1.0);
  const [temperature, setTemperature] = useState(1.0);
  const [generationProgress, setGenerationProgress] = useState(0);
  
  // Add this state to track cached audio
  const [cachedAudio, setCachedAudio] = useState({});
  
  // Add loading state messages
  const [loadingState, setLoadingState] = useState('');
  
  // Add loading states array
  const LOADING_STATES = [
    'Initializing voice engine...',
    'Analyzing text structure...',
    'Processing voice patterns...',
    'Calibrating voice parameters...',
    'Optimizing audio quality...',
    'Synthesizing speech...',
    'Enhancing voice clarity...',
    'Finalizing audio generation...',
    'Preparing for playback...'
  ];
  
  // Function to render the current page
  const renderPage = useCallback(async (pageNum) => {
    if (!pdfDoc) return;
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error('Canvas element not found');
        return;
      }

      // Clear the canvas first
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);

      console.log(`Rendering page ${pageNum}`);
      const page = await pdfDoc.getPage(pageNum);
      
      // Calculate scale to fit the page width while maintaining aspect ratio
      const containerWidth = Math.min(window.innerWidth - 48, 1200);
      const viewport = page.getViewport({ scale: 1.0 });
      const scale = containerWidth / viewport.width;
      
      // Update canvas dimensions
      canvas.width = containerWidth;
      canvas.height = viewport.height * scale;
      
      // Create new viewport with calculated scale
      const scaledViewport = page.getViewport({ scale });
      
      const renderContext = {
        canvasContext: context,
        viewport: scaledViewport,
        renderInteractiveForms: false,
        background: 'white'
      };
      
      // Cancel any existing render task
      if (page._renderTask) {
        await page._renderTask.cancel();
      }
      
      // Create new render task
      const renderTask = page.render(renderContext);
      page._renderTask = renderTask;
      
      await renderTask.promise;
      console.log(`Page ${pageNum} rendered successfully`);
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  }, [pdfDoc]);

  // Load PDF document
  useEffect(() => {
    let mounted = true;
    
    async function loadPDF() {
      try {
        console.log('Starting PDF loading process');
        setIsLoading(true);
        
        // Get PDF metadata from localStorage
        const uploads = JSON.parse(localStorage.getItem('pdfUploads') || '[]');
        const pdfData = uploads.find(upload => upload.id === id);
        
        if (!pdfData || !pdfData.url) {
          console.error('PDF data not found');
          setAudioError('PDF not found. Please go back and select another PDF.');
          setIsLoading(false);
          return;
        }
        
        setPdfUrl(pdfData.url);
        setPdfName(pdfData.name || 'Unnamed PDF');
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument({
          url: pdfData.url,
          withCredentials: false,
          standardFontDataUrl: `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`
        });
        
        const pdf = await loadingTask.promise;
        
        if (!mounted) return;
        
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        
        // Render the first page
        if (pdf.numPages > 0) {
          await renderPage(1);
        }
        
        setIsLoading(false);
        
        // Start text extraction in background
        extractTextForAllPages(pdfData.url);
        
      } catch (error) {
        console.error('Error in loadPDF:', error);
        if (mounted) {
          setAudioError(`Error loading PDF: ${error.message}`);
          setIsLoading(false);
        }
      }
    }

    loadPDF();

    return () => {
      mounted = false;
    };
  }, [id]);

  // Extract text for all pages
  const extractTextForAllPages = async (url) => {
    if (pagesBeingExtracted) return;
    
    setPagesBeingExtracted(true);
    setAllPagesExtracted(false);
    
    try {
      console.log(`Starting text extraction for all pages`);
      
      // Process pages sequentially
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (!extractedPageCache[pageNum]) {
          await extractPageAndUpdateCache(pdfDoc, pageNum);
        }
      }
      
      setAllPagesExtracted(true);
    } catch (error) {
      console.error(`Error extracting text:`, error);
    } finally {
      setPagesBeingExtracted(false);
      setIsLoading(false);
    }
  };

  // Helper function to extract text for a single page
  const extractPageAndUpdateCache = async (pdfDoc, pageNum) => {
    try {
      console.log(`Extracting text for page ${pageNum}`);
      
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine all text items, preserving spaces and line breaks
      let text = '';
      let lastY = null;
      let lastX = null;
      
      for (const item of textContent.items) {
        if (item.str.trim() === '') continue;
        
        // Check if we need to add a line break based on Y position change
        if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
          text += '\n';
        }
        // Check if we need to add a space based on X position
        else if (lastX !== null && item.transform[4] - lastX > 10) {
          text += ' ';
        }
        
        text += item.str;
        lastY = item.transform[5];
        lastX = item.transform[4] + (item.width || 0);
      }
      
      // Clean up the text
      text = text.replace(/\s+/g, ' ').trim();
      
      console.log(`Extracted ${text.length} characters from page ${pageNum}`);
      
      // Update the cache
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

  // Function to clean page text
  const cleanPageText = (text) => {
    if (!text) return '';
    
    return text
      // Replace multiple spaces, tabs, and newlines with a single space
      .replace(/\s+/g, ' ')
      // Remove any non-printable characters
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, ' ')
      // Remove multiple spaces again (in case previous replacements created any)
      .replace(/\s+/g, ' ')
      // Trim whitespace from start and end
      .trim();
  };

  // Handle page navigation
  const goToNextPage = async () => {
    if (currentPage < totalPages && !isLoadingAudio && !isExtractingText) {
      const nextPage = currentPage + 1;
      
      console.log(`Navigating to page ${nextPage}`);
      setCurrentPage(nextPage);
    }
  };

  const goToPrevPage = async () => {
    if (currentPage > 1 && !isLoadingAudio && !isExtractingText) {
      const prevPage = currentPage - 1;
      
      console.log(`Navigating to page ${prevPage}`);
      setCurrentPage(prevPage);
    }
  };

  // Function to estimate reading time for text
  const estimateReadingTime = (text) => {
    if (!text) return 0;
    // Average reading speed: about 150 words per minute for TTS
    const wordCount = text.split(/\s+/).length;
    return (wordCount / 150) * 60; // in seconds
  };

  // Auto page-turn based on audio progress
  const setupPageTurnTimer = (text) => {
    // Clear any existing timeout
    if (pageChangeTimeout) {
      clearTimeout(pageChangeTimeout);
    }
    
    if (!text || !continuousPlayback || currentPage >= totalPages) {
      return;
    }
    
    // Estimate how long it will take to read the current page
    const readingTime = estimateReadingTime(text);
    console.log(`Estimated reading time for page ${currentPage}: ${readingTime} seconds`);
    
    // Store the audio time for this page
    setAudioTimePerPage(prev => ({
      ...prev,
      [currentPage]: readingTime
    }));
    
    // Set a timeout to flip to the next page
    const timeout = setTimeout(() => {
      if (isPlaying && continuousPlayback && currentPage < totalPages) {
        console.log(`Auto-flipping to page ${currentPage + 1}`);
        setCurrentReadingPage(currentPage + 1);
        setCurrentPage(currentPage + 1);
      }
    }, readingTime * 1000); // Convert seconds to milliseconds
    
    setPageChangeTimeout(timeout);
  };

  // Update the useEffect for page rendering
  useEffect(() => {
    let isMounted = true;

    const renderCurrentPage = async () => {
      if (pdfDoc && canvasRef.current && isMounted) {
        await renderPage(currentPage);
      }
    };

    renderCurrentPage();

    return () => {
      isMounted = false;
    };
  }, [currentPage, pdfDoc, renderPage]);

  // Reset and clean up when unmounting
  useEffect(() => {
    return () => {
      if (pageChangeTimeout) {
        clearTimeout(pageChangeTimeout);
      }
    };
  }, [pageChangeTimeout]);

  // Function to get text for a range of pages
  const getTextForPages = async (startPage, endPage) => {
    const texts = [];
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      let pageText = extractedPageCache[pageNum];
      if (!pageText) {
        pageText = await extractPageAndUpdateCache(pdfDoc, pageNum);
      }
      if (pageText) {
        texts.push(pageText);
      }
    }
    return texts.join(' ');
  };

  // Update the handleSeek function
  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Update the handleSliderChange function
  const handleSliderChange = (values) => {
    const time = values[0];
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Update the handleSliderCommit function to be the same as handleSliderChange
  const handleSliderCommit = handleSliderChange;

  // Update the handleVoiceChange function
  const handleVoiceChange = (newVoice) => {
    // Remove error handling event listener before cleanup
    if (audioRef.current) {
      const oldAudio = audioRef.current;
      oldAudio.removeEventListener('error', () => {});
      oldAudio.pause();
      oldAudio.src = '';
      audioRef.current = null;
    }
    setSelectedVoice(newVoice);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    // Clear any existing error when changing voice
    setAudioError(null);
  };

  // Update the handleSpeedChange function
  const handleSpeedChange = (value) => {
    // Immediately stop and clear current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setSpeed(value);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    // Don't set audio error when changing speed
  };

  // Update the handleTemperatureChange function
  const handleTemperatureChange = (value) => {
    // Immediately stop and clear current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setTemperature(value);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    // Don't set audio error when changing temperature
  };

  // Update the useEffect for audio time tracking
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
          goToNextPage();
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

  // Add this function to handle audio persistence
  const saveAudioToLocalStorage = (audioUrl, voice, pageNum, continuous) => {
    const audioData = {
      url: audioUrl,
      voice,
      pageNum,
      continuous,
      timestamp: Date.now(),
    };
    
    const existingAudios = JSON.parse(localStorage.getItem('pdfAudios') || '{}');
    existingAudios[`${id}-${pageNum}-${continuous ? 'continuous' : 'single'}`] = audioData;
    localStorage.setItem('pdfAudios', JSON.stringify(existingAudios));
  };

  // Update the fetchAndPlayAudio function with better loading simulation
  const fetchAndPlayAudio = async (text, pageNum, continuous = false) => {
    try {
      // Immediately stop any existing audio playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }

      setIsLoadingAudio(true);
      setAudioError(null);
      setGenerationProgress(0);
      setIsPlaying(false);

      const cacheKey = `${id}-${pageNum}-${continuous ? 'continuous' : 'single'}-${selectedVoice}-${speed}-${temperature}`;

      // Start loading
      let progress = 0;
      let stateIndex = 0;
      const simulationInterval = setInterval(() => {
        // Increment progress
        progress += Math.random() * 2;
        if (progress > 99) progress = 99;
        
        setGenerationProgress(progress);
        
        setLoadingState(LOADING_STATES[stateIndex % LOADING_STATES.length]);
        stateIndex++;
      }, 800);

      const response = await fetch('/api/pdf-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          pageNum,
          continuous,
          voice: selectedVoice,
          speed,
          temperature,
        }),
      });

      if (!response.ok) {
        clearInterval(simulationInterval);
        throw new Error('Failed to generate audio');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let audioData = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              
              const data = JSON.parse(jsonStr);
              
              if (data.audio) {
                try {
                  const binaryString = atob(data.audio);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  audioData = bytes.buffer;
                } catch (e) {
                  console.error('Error decoding audio data:', e);
                  throw new Error('Failed to decode audio data');
                }
              }
              
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error('Error parsing chunk:', e);
            }
          }
        }
      }

      clearInterval(simulationInterval);

      if (!audioData) {
        throw new Error('No audio data received');
      }

      setLoadingState('Preparing playback...');
      setGenerationProgress(100);

      const blob = new Blob([new Uint8Array(audioData)], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);

      // Create new audio element
      const newAudio = new Audio();
      newAudio.src = audioUrl;

      // Set up event listeners for time updates
      newAudio.addEventListener('timeupdate', () => {
        setCurrentTime(newAudio.currentTime);
      });

      newAudio.addEventListener('loadedmetadata', () => {
        setDuration(newAudio.duration);
      });

      newAudio.addEventListener('ended', () => {
        setIsPlaying(false);
        if (continuousPlayback && currentPage < totalPages) {
          goToNextPage();
        }
      });

      // Cache the audio with the new settings in the key
      setCachedAudio(prev => ({
        ...prev,
        [cacheKey]: {
          audio: newAudio,
          url: audioUrl
        }
      }));

      // Update audio reference
      audioRef.current = newAudio;

      // Play the audio
      setIsLoadingAudio(false);
      await newAudio.play();
      setIsPlaying(true);

    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError(error.message);
      setIsLoadingAudio(false);
      setIsPlaying(false);
      setLoadingState('');
    }
  };

  // Update handlePlayPause to include settings in cache key
  const handlePlayPause = async () => {
    try {
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      const cacheKey = `${id}-${currentPage}-${continuousPlayback ? 'continuous' : 'single'}-${selectedVoice}-${speed}-${temperature}`;
      
      // Check if we have cached audio with current settings
      if (cachedAudio[cacheKey] && audioRef.current) {
        setIsPlaying(true);
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(error => {
            console.error('Error playing cached audio:', error);
            setAudioError('Error playing audio: ' + error.message);
            setIsPlaying(false);
          });
        return;
      }

      // Generate new audio if not cached
      setIsPlaying(true);
      setIsLoadingAudio(true);

      const text = continuousPlayback 
        ? await getTextForPages(currentPage, totalPages)
        : extractedPageCache[currentPage] || await extractPageAndUpdateCache(pdfDoc, currentPage);

      if (!text) {
        throw new Error('No text available');
      }

      await fetchAndPlayAudio(text, currentPage, continuousPlayback);
    } catch (error) {
      console.error('Error in handlePlayPause:', error);
      setAudioError(error.message);
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  // Handle window resize
  useEffect(() => {
    let resizeTimeout;
    
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (pdfDoc && currentPage) {
          renderPage(currentPage);
        }
      }, 250); // Debounce resize events
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }, [pdfDoc, currentPage, renderPage]);
  
  // Handle audio playback
  useEffect(() => {
    const audioElement = audioRef.current;
    
    if (audioElement) {
      if (isPlaying) {
        const playPromise = audioElement.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Error playing audio:', error);
            setIsPlaying(false);
            setAudioError("Error playing audio: " + error.message);
          });
        }
      } else {
        audioElement.pause();
      }
      
      const handleError = (e) => {
        // Only set error if it's not from a voice change
        if (audioElement.src && !audioElement.paused) {
          console.error("Audio playback error:", e);
          setIsPlaying(false);
          setAudioError("Audio playback error. Please try again.");
        }
      };
      
      audioElement.addEventListener('error', handleError);
      
      return () => {
        audioElement.removeEventListener('error', handleError);
      };
    }
  }, [isPlaying]);
  
  // Handle audio ended event
  useEffect(() => {
    const audioElement = audioRef.current;
    
    const handleAudioEnded = () => {
      setIsPlaying(false);
      
      // Optionally auto-advance to next page
      // if (currentPage < totalPages) {
      //   goToNextPage();
      // }
    };
    
    if (audioElement) {
      audioElement.addEventListener('ended', handleAudioEnded);
      return () => {
        audioElement.removeEventListener('ended', handleAudioEnded);
      };
    }
  }, [currentPage, totalPages]);
  
  const initializeAudioContext = () => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      setAudioContext(ctx);
    }
  };

  // Handle audio errors more comprehensively
  useEffect(() => {
    const audioElement = audioRef.current;
    
    const handleAudioError = (e) => {
      // Log detailed error information
      console.error('Audio error event:', e);
      
      // Get more detailed error information if available
      let errorMessage = 'Unknown audio error';
      if (e.target && e.target.error) {
        const errorCode = e.target.error.code;
        const codeToMessage = {
          1: 'Audio fetching aborted',
          2: 'Network error while loading audio',
          3: 'Audio decoding error',
          4: 'Audio not supported by browser'
        };
        errorMessage = codeToMessage[errorCode] || `Audio error code: ${errorCode}`;
        console.error('Audio error details:', e.target.error);
      }
      
      // Only update state if we're not already handling an error
      if (!audioError) {
        setAudioError(errorMessage);
        setIsPlaying(false);
        setIsLoadingAudio(false);
      }
    };
    
    if (audioElement) {
      audioElement.addEventListener('error', handleAudioError);
      return () => {
        audioElement.removeEventListener('error', handleAudioError);
      };
    }
  }, [audioError]);

  // Final fallback to native audio element
  const tryNativeAudioElement = (src) => {
    console.log('Trying native audio element as final fallback');
    
    if (audioRef.current) {
      try {
        // Reset the audio element completely
        const audio = audioRef.current;
        
        // Cancel any pending play attempts
        let playAttemptInProgress = false;
        
        // First make sure we're not in the middle of playing
        if (!audio.paused) {
          audio.pause();
        }
        
        // Reset the audio element state
        audio.removeAttribute('src');
        audio.load();
        audio.currentTime = 0;
        
        // Clear any existing event handlers to prevent conflicts
        const oldHandlers = audio.cloneNode(false);
        audio.parentNode.replaceChild(oldHandlers, audio);
        audioRef.current = oldHandlers;
        
        // Now set up the audio element with the new source
        const newAudio = audioRef.current;
        
        // Set source with correct MIME type
        newAudio.src = src;
        
        // Set up robust event handling
        newAudio.oncanplaythrough = () => {
          console.log('Native audio element can play through');
          setIsLoadingAudio(false);
          
          if (playAttemptInProgress) return;
          playAttemptInProgress = true;
          
          // Add a small delay to prevent immediate play conflicts
          setTimeout(() => {
            if (!isPlaying) {
              console.log('State changed to not playing, canceling play attempt');
              playAttemptInProgress = false;
              return;
            }
            
            console.log('Attempting to play native audio element');
            const playPromise = newAudio.play();
            
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('Native audio element playback started successfully');
                  setIsPlaying(true);
                  playAttemptInProgress = false;
                })
                .catch(err => {
                  console.error('Native audio element play error:', err);
                  
                  // If the error is related to interruption, try again with a delay
                  if (err.message.includes('interrupted')) {
                    console.log('Play was interrupted, trying again after delay');
                    setTimeout(() => {
                      if (isPlaying) { // Only retry if still in playing state
                        const retryPlayPromise = newAudio.play();
                        if (retryPlayPromise !== undefined) {
                          retryPlayPromise
                            .then(() => {
                              console.log('Native audio playback started on retry');
                              setIsPlaying(true);
                            })
                            .catch(retryErr => {
                              console.error('Native audio play error on retry:', retryErr);
                              setAudioError(`Cannot play audio: ${retryErr.message}`);
                              setIsPlaying(false);
                            });
                        }
                      }
                    }, 500);
                  } else {
                    setAudioError(`Cannot play audio: ${err.message}`);
                    setIsPlaying(false);
                  }
                  
                  playAttemptInProgress = false;
                });
            }
          }, 100);
        };
        
        // Better error handling
        newAudio.onerror = (e) => {
          const errorCode = newAudio.error ? newAudio.error.code : 0;
          const errorMessage = {
            1: 'Audio fetching aborted',
            2: 'Network error while loading audio',
            3: 'Audio decoding error',
            4: 'Audio not supported by browser'
          }[errorCode] || 'Unknown audio error';
          
          console.error('Native audio element error:', errorMessage, e);
          setAudioError(`Audio playback failed: ${errorMessage}`);
          setIsPlaying(false);
          setIsLoadingAudio(false);
          playAttemptInProgress = false;
        };
        
        // Add ended handler
        newAudio.onended = () => {
          console.log('Native audio playback ended');
          setIsPlaying(false);
          playAttemptInProgress = false;
        };
        
        // Force preload
        newAudio.load();
        
        // Set up a timeout in case the canplaythrough event never fires
        setTimeout(() => {
          if (isLoadingAudio && isPlaying && !playAttemptInProgress) {
            console.log('Timeout reached for audio loading, trying to play anyway');
            setIsLoadingAudio(false);
            playAttemptInProgress = true;
            
            const timeoutPlayPromise = newAudio.play();
            if (timeoutPlayPromise !== undefined) {
              timeoutPlayPromise
                .then(() => {
                  console.log('Native audio element playback started after timeout');
                  setIsPlaying(true);
                  playAttemptInProgress = false;
                })
                .catch(err => {
                  console.error('Native audio element play error after timeout:', err);
                  setAudioError(`Audio playback error: ${err.message}`);
                  setIsPlaying(false);
                  playAttemptInProgress = false;
                });
            }
          }
        }, 3000); // Reduced timeout for better user experience
      } catch (error) {
        console.error('Error setting up native audio element:', error);
        setAudioError(`Error setting up audio: ${error.message}`);
        setIsPlaying(false);
        setIsLoadingAudio(false);
      }
    } else {
      setAudioError('No audio element available for fallback');
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  // Make sure to clean up resources
  useEffect(() => {
    return () => {
      // Clean up Howler resources
      if (howlSound) {
        howlSound.unload();
      }
      
      // Clean up MediaSource if it exists
      if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
        try {
          mediaSourceRef.current.endOfStream();
        } catch (e) {
          console.error('Error ending stream on cleanup:', e);
        }
      }
      
      // Clean up blob URLs
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      // Clean up audio context
      if (audioContext) {
        audioContext.close();
      }
    };
  }, [audioUrl, audioContext, howlSound]);
  
  const handleBackClick = () => {
    router.push('/');
  };

  // Add useEffect for time updates and cleanup
  useEffect(() => {
    if (audioRef.current) {
      const updateTime = () => {
        setCurrentTime(audioRef.current.currentTime);
      };
      
      audioRef.current.addEventListener('timeupdate', updateTime);
      return () => {
        audioRef.current?.removeEventListener('timeupdate', updateTime);
      };
    }
  }, []);

  // Add cleanup effect when navigating away
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
        }
      }
      setIsPlaying(false);
    };
  }, []);

  // Add cleanup effect
  useEffect(() => {
    return () => {
      // Only clean up URLs when component unmounts
      Object.values(cachedAudio).forEach(({ url }) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

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
        {/* Top row with page navigation */}
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

          {/* Reading Mode Toggle */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center border rounded-lg p-3 mb-[-5] bg-gray-50">
          <div className="text-sm font-medium text-gray-700 mb-2 sm:mb-0 sm:mr-3">
            Reading Mode:
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setContinuousPlayback(false)}
              className={`px-3 py-1.5 text-sm rounded-md ${!continuousPlayback ? 'bg-lime-200 text-lime-900 font-medium' : 'bg-gray-200 text-gray-600'}`}
            >
              Single Page
            </button>
            
            <div className="relative">
              <button 
                onClick={() => setContinuousPlayback(!continuousPlayback)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${continuousPlayback ? 'bg-lime-500' : 'bg-gray-300'}`}
                role="switch"
                aria-checked={continuousPlayback}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${continuousPlayback ? 'translate-x-6' : 'translate-x-1'}`} 
                />
              </button>
            </div>
            
            <button 
              onClick={() => setContinuousPlayback(true)}
              className={`px-3 py-1.5 text-sm rounded-md ${continuousPlayback ? 'bg-lime-200 text-lime-900 font-medium' : 'bg-gray-200 text-gray-600'}`}
            >
              Entire Book
            </button>
          </div>
        </div>
      </div>

        {/* Middle row with voice selector and audio controls */}
        <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg border mb-3">
          <Select 
            value={selectedVoice} 
            onValueChange={handleVoiceChange}
            disabled={isLoadingAudio}
          >
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
              disabled={isLoadingAudio}
              className="w-[100px]"
            />
            <span className="text-sm font-medium">{speed.toFixed(1)}x</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Temperature:</span>
            <Slider
              value={[temperature]}
              min={0.5}
              max={1.5}
              step={0.1}
              onValueChange={([value]) => handleTemperatureChange(value)}
              disabled={isLoadingAudio}
              className="w-[100px]"
            />
            <span className="text-sm font-medium">{temperature.toFixed(1)}</span>
          </div>

          <div className="flex items-center flex-grow gap-3">
            <span className="text-sm font-medium text-gray-600">
              {formatTime(currentTime)}
            </span>
            
            <Slider
              value={[currentTime || 0]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSliderChange}
              onValueCommit={handleSliderCommit}
              disabled={isLoadingAudio || !duration}
              className="flex-grow"
            />
            
            <span className="text-sm font-medium text-gray-600">
              {formatTime(duration)}
            </span>
          </div>

          <Button 
            variant={isPlaying ? "destructive" : "default"} 
            onClick={handlePlayPause}
            disabled={isLoadingAudio}
            className={isPlaying ? 
              "bg-red-500 hover:bg-red-600 transition-all duration-300" : 
              "bg-lime-500 hover:bg-lime-600 transition-all duration-300"
            }
          >
            {isLoadingAudio ? (
              <div className="flex items-center gap-2">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">{loadingState}</span>
                <span className="text-sm font-medium ml-1">{generationProgress.toFixed(0)}%</span>
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
      </div>

      {audioError && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          <p className="text-sm">{audioError}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white w-full">
        <div className="flex items-center justify-center min-h-[800px] p-4">
          {isLoading ? (
            <div className="text-center">
              <p className="text-gray-500">Loading PDF...</p>
            </div>
          ) : (
            <div className="pdf-container shadow-lg w-full max-w-[1000px] mx-auto">
              <canvas ref={canvasRef} className="w-full h-auto" />
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          Powered by <Link href="https://play.ai" target="_blank" className="text-lime-500 hover:text-lime-600 transition-all duration-300 font-medium hover:underline"><span>PlayAI Text-to-Speech</span></Link>
        </p>
      </div>
    </div>
  );
} 