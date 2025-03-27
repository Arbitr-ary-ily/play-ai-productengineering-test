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
  ArrowLeft
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Import pdfjs-dist
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

export default function PDFViewerPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const canvasRef = useRef(null);
  
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pageWidth, setPageWidth] = useState(800);
  const [isLoading, setIsLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [scale, setScale] = useState(1.5);
  
  // Function to render the current page
  const renderPage = async (pageNum) => {
    if (!pdfDoc) return;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Calculate scale to fit the page width
      const viewport = page.getViewport({ scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
    } catch (error) {
      console.error('Error rendering page:', error);
    }
  };

  // Load PDF document
  useEffect(() => {
    async function loadPDF() {
      // get the PDF URL from localStorage
      const url = localStorage.getItem(`pdf_${id}`);
      if (!url) {
        router.push('/');
        return;
      }
      
      setPdfUrl(url);
      
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
        
        // get PDF metadata from localStorage
        const uploads = JSON.parse(localStorage.getItem('pdfUploads') || '[]');
        const pdfData = uploads.find(upload => upload.id === id);
        if (pdfData) {
          setPdfName(pdfData.name);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
        setIsLoading(false);
      }
    }

    loadPDF();
  }, [id, router]);

  // Render page when current page changes
  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [currentPage, pdfDoc, scale]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = Math.min(window.innerWidth - 48, 800);
      setPageWidth(width);
      // Adjust scale based on window width
      const newScale = (width / 595.276) * 1.1; // 595.276 is default PDF width
      setScale(newScale);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
    // TODO: implement TTS functionality
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
            <ArrowLeft className="w-4 h-4 " />
            Back
          </Button>
        </div>
        <div className="mt-10">
          <h1 className="text-2xl font-medium text-gray-800">{pdfName}</h1>
          <p className="text-sm text-gray-500">Use the controls below to navigate and listen</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button variant="outline" size="icon" onClick={goToNextPage} disabled={currentPage >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={isPlaying ? "destructive" : "default"} 
            onClick={handlePlayPause}
            className={isPlaying ? "bg-red-500 hover:bg-red-600 transition-all duration-300" : "bg-lime-500 hover:bg-lime-600 transition-all duration-300"}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Play
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white">
        <div className="flex items-center justify-center min-h-[600px] p-4">
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
          Powered by <Link href="https://play.ai" target="_blank" className="text-lime-500 hover:text-lime-600 transition-all duration-300 font-medium hover:underline"><span>PlayAI Text-to-Speech</span></Link>
        </p>
      </div>
    </div>
  );
} 