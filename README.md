# PlayAI Book Reader

A web app that lets you upload PDFs and listen to them using PlayAI's text-to-speech. Built with Next.js and a clean UI.

## Quick Start

1. Clone the repo
2. Install dependencies:
```bash
npm install
```

3. Get your API keys:
   - Sign up at [PlayAI](https://play.ai) to get your API key and user ID
   - Create an account at [Uploadthing](https://uploadthing.com) to get your upload token

4. Add these environment variables to `.env.local`:
```env
API_KEY=your_playai_api_key
USER_ID=your_playai_user_id
TTS_API_URL=https://api.play.ai/v1/tts/stream
UPLOADTHING_TOKEN=your_uploadthing_token
```

5. Run the app:
```bash
npm run dev
```

## Tech Stack

- Next.js 15 for the framework
- PDF.js for PDF rendering
- PlayAI SDK for text-to-speech
- Uploadthing for file storage
- Tailwind CSS for styling
- Shadcn UI for components

## Design Decisions

- Used PDF.js for reliable PDF rendering across browsers
- Implemented client-side text extraction for better TTS quality
- Added voice caching to improve playback performance
- Built a responsive UI that works well on both desktop and mobile
- Used Uploadthing for secure file storage and handling

## Features

- PDF upload and viewing
- Text-to-speech with multiple voices
- Page navigation
- Audio controls (play/pause, seek, speed)
- Sidebar navigation
- Voice chat interface

## Voices Available

- Angelo (Conversational)
- Deedee (Conversational)
- Jennifer (Conversational)
- Briggs (Narrative)
- Samara (Conversational)
