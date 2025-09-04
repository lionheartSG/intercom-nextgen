# Production Token Setup Guide

This guide explains how to set up secure token-based authentication for your Agora video calling application in production.

## 🔐 Environment Variables Setup

Add the following to your `.env.local` file:

```bash
# Client-side (public)
NEXT_PUBLIC_AGORA_APP_ID=your_app_id_here
NEXT_PUBLIC_AGORA_CHANNEL=test-channel

# Server-side (private - DO NOT expose to client)
AGORA_APP_ID=your_app_id_here
AGORA_APP_CERTIFICATE=your_app_certificate_here
```

## 📋 Step-by-Step Setup

### 1. Get Your Agora Credentials

1. Go to [Agora Console](https://console.agora.io/)
2. Navigate to your project
3. Copy your **App ID**
4. Go to **App Certificate** section
5. Copy your **Primary Certificate**

### 2. Configure Environment Variables

- Replace `your_app_id_here` with your actual App ID
- Replace `your_app_certificate_here` with your actual Primary Certificate
- **Important**: Never commit these credentials to version control

### 3. Deploy with Environment Variables

For production deployment, set these environment variables in your hosting platform:

**Vercel:**

```bash
vercel env add AGORA_APP_ID
vercel env add AGORA_APP_CERTIFICATE
vercel env add NEXT_PUBLIC_AGORA_APP_ID
```

**Netlify:**

- Go to Site Settings → Environment Variables
- Add the variables listed above

**Other platforms:**

- Set the environment variables in your hosting platform's dashboard

## 🔄 How Token Generation Works

1. **Client Request**: When user clicks "Join Channel", the app requests a token
2. **Server Action**: The `generateAgoraToken` server action creates a secure token using your App ID and Certificate
3. **Token Response**: Server returns the token with expiration time
4. **Channel Join**: Client uses the token to join the Agora channel
5. **Auto Refresh**: Token automatically refreshes before expiration

## 🛡️ Security Features

- ✅ **Server-side Generation**: Tokens are generated on the server, keeping your certificate secure
- ✅ **Automatic Expiration**: Tokens expire after 1 hour for security
- ✅ **Auto Refresh**: Tokens refresh automatically before expiration
- ✅ **Random UIDs**: Each user gets a unique random UID
- ✅ **No Client Exposure**: App Certificate never reaches the client

## 🧪 Testing

1. Set up your environment variables
2. Start the development server: `npm run dev`
3. Open the app in two browser tabs
4. Click "Join Channel" on both tabs
5. You should see each other's video and hear each other's audio

## 🚀 Production Deployment

1. Set environment variables in your hosting platform
2. Deploy your application
3. Test with real devices/browsers
4. Monitor token generation in your server logs

## 🔧 Troubleshooting

**"Missing App ID or Certificate" Error:**

- Check that `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are set in your environment variables
- Ensure these are server-side variables (not prefixed with `NEXT_PUBLIC_`)

**"Invalid Token" Error:**

- Verify your App Certificate is correct
- Check that your App ID matches between client and server
- Ensure your Agora project is configured for token authentication

**Token Expiration Issues:**

- Tokens automatically refresh every hour
- Check browser console for token generation logs
- Verify server action is working correctly

## 📚 Additional Resources

- [Agora Token Documentation](https://docs.agora.io/en/Video/token?platform=All%20Platforms)
- [Agora Console](https://console.agora.io/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
