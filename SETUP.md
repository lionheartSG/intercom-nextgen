# React Agora Video Call App

A simple video calling application built with Next.js and Agora SDK that allows two devices to communicate.

## Setup Instructions

1. **Configure Agora App ID**

   - Open `.env.local` file
   - Replace `your_app_id_here` with your actual Agora App ID
   - Save the file

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Start Development Server**

   ```bash
   npm run dev
   ```

4. **Test the Application**
   - Open the app in two different browser tabs or devices
   - Click "Join Channel" on both devices
   - You should see each other's video and hear each other's audio

## Features

- ✅ Real-time video and audio communication
- ✅ Mute/unmute audio
- ✅ Start/stop video
- ✅ Connection status indicator
- ✅ Error handling
- ✅ Responsive design

## Environment Variables

- `NEXT_PUBLIC_AGORA_APP_ID`: Your Agora App ID
- `NEXT_PUBLIC_AGORA_CHANNEL`: Channel name (default: "test-channel")

## Troubleshooting

- Make sure you have granted camera and microphone permissions
- Ensure both devices are using the same channel name
- Check that your Agora App ID is correct
- For production, consider implementing token-based authentication
