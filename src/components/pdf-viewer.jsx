"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import react-pdf components with SSR disabled
const ReactPDF = dynamic(
  () => import("react-pdf").then((mod) => {
    // Set up the worker for PDF.js
    const { pdfjs } = mod;
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
    return mod;
  }),
  {
    ssr: false,
    loading: () => null,
  }
);

export default function PDFViewer({ 
  file, 
  pageNumber, 
  scale = 1.2, 
  onDocumentLoadSuccess,
  onPageTextExtracted
}) {
  const [textContent, setTextContent] = useState("");
  
  // Extract text when it's available and pass it to the parent
  useEffect(() => {
    if (textContent && onPageTextExtracted) {
      onPageTextExtracted(textContent);
    }
  }, [textContent, onPageTextExtracted]);
  
  // Handle document load success
  const handleDocumentLoadSuccess = ({ numPages }) => {
    if (onDocumentLoadSuccess) {
      onDocumentLoadSuccess(numPages);
    }
  };
  
  // Handle page load success and extract text
  const handlePageLoadSuccess = (page) => {
    page.getTextContent().then((content) => {
      const text = content.items.map(item => item.str).join(' ');
      setTextContent(text);
    });
  };
  
  if (!ReactPDF) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50">
        <Skeleton className="h-[400px] w-[300px] rounded-md" />
      </div>
    );
  }
  
  const { Document, Page } = ReactPDF;
  
  return (
    <div className="flex justify-center p-4">
      {Document && Page ? (
        <Document
          file={file}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-[600px]">
              <Skeleton className="h-[400px] w-[300px] rounded-md" />
            </div>
          }
          error={
            <div className="flex items-center justify-center h-[600px] text-red-500">
              Failed to load PDF. Please try again.
            </div>
          }
          className="shadow-lg"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            onLoadSuccess={handlePageLoadSuccess}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      ) : (
        <div className="flex items-center justify-center h-[600px] bg-gray-50">
          <Skeleton className="h-[400px] w-[300px] rounded-md" />
        </div>
      )}
    </div>
  );
} 