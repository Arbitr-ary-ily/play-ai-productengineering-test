import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';

export async function POST(req) {
  try {
    const { pageNum, pdfUrl } = await req.json();

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    // Get the specified page
    const page = await pdf.getPage(pageNum);
    
    // Extract text content
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map(item => item.str)
      .join(' ')
      .replace(/\\s+/g, ' ')
      .trim();

    // Get page dimensions for potential text positioning
    const viewport = page.getViewport({ scale: 1.0 });

    return new Response(
      JSON.stringify({
        text,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to extract text from PDF',
        details: error.message 
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
} 