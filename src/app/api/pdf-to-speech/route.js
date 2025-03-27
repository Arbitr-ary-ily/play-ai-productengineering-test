import { NextResponse } from "next/server";

// Configure API to not parse response automatically to allow streaming
export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '20mb'
    }
  }
};

// API configuration
const API_KEY = "ak-c3eaeadb838944cfaec82e41129a71f3";
const USER_ID = "5jcbndHqeMg9yRPw95Ti5cVfNus2";
const BASE_URL = "https://api.play.ai/api/v1";
const DEFAULT_VOICE = 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json';
const MODEL_NAME = "PlayDialog";
const OUTPUT_FORMAT = "mp3";
const MAX_CHUNK_SIZE = 15000; // Play.ai limit is 20000, using 15000 for safety

// In-memory cache for audio data
const audioCache = new Map();

/**
 * Clean text for TTS processing
 */
function cleanTextForTTS(text) {
  if (!text) return "";
  let cleaned = text.replace(/\r\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ');
  return cleaned.trim();
}

/**
 * Generate a cache key for the text
 */
function generateCacheKey(text, voice = DEFAULT_VOICE) {
  return `${text.substring(0, 50)}_${voice}_${text.length}`;
}

/**
 * Split text into chunks that respect sentence boundaries
 */
function splitTextIntoChunks(text) {
  if (!text) return [];
  if (text.length <= MAX_CHUNK_SIZE) return [text];

  const chunks = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';

  for (const sentence of sentences) {
    // If adding this sentence would exceed chunk size
    if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // If single sentence is too long, split by words
      if (sentence.length > MAX_CHUNK_SIZE) {
        const words = sentence.split(/\s+/);
        let wordChunk = '';
        
        for (const word of words) {
          if (wordChunk.length + word.length + 1 > MAX_CHUNK_SIZE) {
            chunks.push(wordChunk.trim());
            wordChunk = word;
          } else {
            wordChunk += (wordChunk ? ' ' : '') + word;
          }
        }
        if (wordChunk) chunks.push(wordChunk.trim());
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

/**
 * Make request to Play.ai API and cache the response
 */
async function makePlayAIRequest(text, options = {}) {
  const cacheKey = generateCacheKey(text, options.voice);
  
  // Check cache first
  if (audioCache.has(cacheKey)) {
    console.log('Using cached audio data');
    return audioCache.get(cacheKey);
  }

  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'X-USER-ID': USER_ID,
  };

  const payload = {
    text,
    voice: options.voice || DEFAULT_VOICE,
    model: MODEL_NAME,
    outputFormat: OUTPUT_FORMAT,
    speed: 1,
    sampleRate: 24000,
    language: 'english'
  };

  console.log('Making request to Play.ai with payload:', {
    textLength: text.length,
    voice: payload.voice,
    model: payload.model
  });

  const response = await fetch(`${BASE_URL}/tts/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Play.ai API Error:', error);
    throw new Error(`PlayAI API Error: ${error || response.statusText}`);
  }

  // Cache the audio data
  const buffer = await response.arrayBuffer();
  audioCache.set(cacheKey, buffer);
  
  return buffer;
}

/**
 * Handle range requests for audio streaming
 */
function handleRangeRequest(buffer, range) {
  // If no range header or invalid range, return the full buffer
  if (!range || typeof range !== 'string') {
    return {
      buffer,
      start: 0,
      end: buffer.byteLength - 1,
      contentLength: buffer.byteLength
    };
  }

  const bytes = range.match(/bytes=(\d+)-(\d+)?/);
  if (!bytes) {
    return {
      buffer,
      start: 0,
      end: buffer.byteLength - 1,
      contentLength: buffer.byteLength
    };
  }

  const start = parseInt(bytes[1], 10);
  const end = bytes[2] ? parseInt(bytes[2], 10) : buffer.byteLength - 1;
  
  // Validate start and end values
  const validStart = !isNaN(start) && start >= 0 && start < buffer.byteLength;
  const validEnd = !isNaN(end) && end >= start && end < buffer.byteLength;
  
  if (!validStart || !validEnd) {
    return {
      buffer,
      start: 0,
      end: buffer.byteLength - 1,
      contentLength: buffer.byteLength
    };
  }
  
  return {
    buffer: buffer.slice(start, end + 1),
    start,
    end,
    contentLength: buffer.byteLength
  };
}

/**
 * Create a streaming response from multiple audio chunks
 */
async function createMultipartStream(chunks) {
  try {
    // Collect all audio buffers
    const buffers = await Promise.all(
      chunks.map(chunk => makePlayAIRequest(chunk))
    );
    
    // Combine all buffers
    const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buffer of buffers) {
      combinedBuffer.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }
    
    return combinedBuffer.buffer;
  } catch (error) {
    console.error('Error in stream processing:', error);
    throw error;
  }
}

/**
 * POST handler for text-to-speech streaming
 */
export async function POST(req) {
  try {
    const { text, pageNum, continuous, voice, speed, temperature } = await req.json();

    // Clean and chunk the text
    const cleanedText = cleanTextForTTS(text);
    const chunks = splitTextIntoChunks(cleanedText);
    const totalChunks = chunks.length;

    // Create a TransformStream to track progress
    const encoder = new TextEncoder();
    const stream = new TransformStream({
      async transform(chunk, controller) {
        controller.enqueue(chunk);
      }
    });

    // Get a single writer instance that we'll reuse
    const writer = stream.writable.getWriter();

    // Start the audio generation process
    const generateAudio = async () => {
      try {
        const audioBuffers = [];
        let processedChunks = 0;

        for (const chunk of chunks) {
          const response = await fetch('https://api.play.ai/api/v1/tts/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${API_KEY}`,
              'X-USER-ID': USER_ID,
            },
            body: JSON.stringify({
              model: "PlayDialog",
              text: chunk,
              voice: voice,
              outputFormat: "mp3",
              speed: speed || 1,
              temperature: temperature || 1,
              sampleRate: 24000,
              language: "english"
            }),
          });

          if (!response.ok) {
            throw new Error('Failed to generate audio');
          }

          const buffer = await response.arrayBuffer();
          audioBuffers.push(buffer);
          processedChunks++;

          // Send progress update
          const progress = Math.min(99, Math.floor((processedChunks / totalChunks) * 100));
          await writer.write(encoder.encode(`data: ${JSON.stringify({ progress })}\n\n`));
        }

        // Combine all audio buffers
        const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.byteLength, 0);
        const combinedBuffer = new Uint8Array(totalLength);
        let offset = 0;

        for (const buffer of audioBuffers) {
          combinedBuffer.set(new Uint8Array(buffer), offset);
          offset += buffer.byteLength;
        }

        // Convert the buffer to base64 to safely transmit as JSON
        const base64Audio = Buffer.from(combinedBuffer).toString('base64');

        // Send the final audio data
        await writer.write(encoder.encode(`data: ${JSON.stringify({ 
          progress: 100,
          audio: base64Audio
        })}\n\n`));

        await writer.close();
      } catch (error) {
        try {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ 
            error: error.message 
          })}\n\n`));
          await writer.close();
        } catch (writeError) {
          console.error('Error writing error message:', writeError);
        }
      }
    };

    // Start the generation process
    generateAudio();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in text-to-speech API:', error);
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for text-to-speech streaming
 */
export async function GET(req) {
  try {
    console.log("Starting TTS request processing (GET)");
    
    const { searchParams } = new URL(req.url);
    const text = searchParams.get('text');
    const voiceId = searchParams.get('voiceId') || DEFAULT_VOICE;
    
    if (!text?.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    console.log(`Received text of length: ${text.length} characters`);
    
    // Limit text length for GET requests
    if (text.length > 2000) {
      console.warn(`Text too long for GET request: ${text.length} characters`);
      return NextResponse.json({
        error: "Text too long for GET request. Use POST for texts longer than 2000 characters."
      }, { status: 413 });
    }
    
    // Clean text
    const cleanedText = cleanTextForTTS(text);
    console.log(`Cleaned text: ${cleanedText.substring(0, 50)}...`);
    
    // Get audio buffer (from cache or by generating)
    const audioBuffer = await makePlayAIRequest(cleanedText, { voice: voiceId });

    // Handle range request if present
    const range = req.headers.get('range');
    const { buffer, start, end, contentLength } = handleRangeRequest(audioBuffer, range);

    // Return the response with appropriate headers
    return new Response(buffer, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.byteLength.toString(),
        'Content-Range': range ? `bytes ${start}-${end}/${contentLength}` : undefined,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000',
        'X-Content-Type-Options': 'nosniff'
      }
    });
    
  } catch (error) {
    console.error('Error in GET handler:', error);
    return NextResponse.json({ 
      error: error.message || "An error occurred during processing" 
    }, { 
      status: 500 
    });
  }
}

// Remove circular reference
// export { POST as POST } from './route.js';




