"use client";

import { useEffect, useRef, useState } from "react";
import { generateAgoraToken } from "../lib/agora-token";

interface VideoCallProps {
  appId: string;
  token?: string; // Optional - will generate dynamically if not provided
}

export default function VideoCall({ appId, token }: VideoCallProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<string>("DISCONNECTED");
  const [isClient, setIsClient] = useState(false);
  const [agoraLoaded, setAgoraLoaded] = useState(false);
  const [clientReady, setClientReady] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [currentUid, setCurrentUid] = useState<number>(0);
  const [channel, setChannel] = useState<string>("");
  const [channelInput, setChannelInput] = useState<string>("");

  const clientRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoElementRef = useRef<HTMLDivElement>(null);
  const remoteVideoElementRef = useRef<HTMLDivElement>(null);
  const agoraRTCRef = useRef<any>(null);

  // Check if we're on the client side and load Agora SDK
  useEffect(() => {
    setIsClient(true);

    // Load channel from localStorage
    const savedChannel = localStorage.getItem("agora-channel");
    if (savedChannel) {
      setChannel(savedChannel);
      setChannelInput(savedChannel);
    } else {
      // Default channel if none saved
      const defaultChannel = "dragnet-channel";
      setChannel(defaultChannel);
      setChannelInput(defaultChannel);
    }

    // Dynamically import Agora SDK
    const loadAgora = async () => {
      try {
        const AgoraRTC = await import("agora-rtc-sdk-ng");
        agoraRTCRef.current = AgoraRTC.default;
        setAgoraLoaded(true);
      } catch (err) {
        console.error("Failed to load Agora SDK:", err);
        setError("Failed to load video calling SDK");
      }
    };

    loadAgora();
  }, []);

  // Auto-join channel when component is ready
  useEffect(() => {
    if (
      isClient &&
      agoraLoaded &&
      clientReady &&
      !isJoined &&
      channel &&
      appId
    ) {
      joinChannel().catch((err) => {
        console.error("Auto-join failed:", err);
        setError("Failed to auto-join video channel");
      });
    }
  }, [isClient, agoraLoaded, clientReady, isJoined, channel, appId]);

  // Token refresh mechanism
  useEffect(() => {
    if (!isJoined || !tokenExpiresAt) return;

    const checkTokenExpiry = () => {
      if (isTokenExpired()) {
        generateToken().catch(console.error);
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, [isJoined, tokenExpiresAt]);

  // Cleanup effect - stop camera when component unmounts
  useEffect(() => {
    return () => {
      // Stop and close all tracks when component unmounts
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      // Leave channel if still joined
      if (clientRef.current && isJoined) {
        clientRef.current.leave().catch(console.error);
      }
    };
  }, []);

  // Initialize Agora client
  useEffect(() => {
    if (!isClient || !agoraLoaded || !agoraRTCRef.current) return;

    const config = {
      mode: "rtc",
      codec: "vp8",
    };

    clientRef.current = agoraRTCRef.current.createClient(config);
    setClientReady(true);

    // Listen to connection state changes
    clientRef.current.on(
      "connection-state-change",
      (curState: string, revState: string) => {
        setConnectionState(curState);
      }
    );

    // Listen to user joined
    clientRef.current.on(
      "user-published",
      async (user: any, mediaType: "audio" | "video") => {
        if (clientRef.current) {
          await clientRef.current.subscribe(user, mediaType);

          if (mediaType === "video" && remoteVideoElementRef.current) {
            const remoteVideoTrack = user.videoTrack;
            if (remoteVideoTrack) {
              remoteVideoTrack.play(remoteVideoElementRef.current);
            }
          }

          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            if (remoteAudioTrack) {
              remoteAudioTrack.play();
            }
          }
        }
      }
    );

    // Listen to user left
    clientRef.current.on(
      "user-unpublished",
      (user: any, mediaType: "audio" | "video") => {
        if (mediaType === "video" && remoteVideoElementRef.current) {
          remoteVideoElementRef.current.innerHTML = "";
        }
      }
    );

    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
      }
      setClientReady(false);
    };
  }, [isClient, agoraLoaded]);

  // Function to generate a new token
  const generateToken = async (uid?: number) => {
    try {
      const tokenUid = uid || 0; // Use provided UID or default to 0

      const tokenResponse = await generateAgoraToken({
        channel,
        uid: tokenUid,
        expirationTimeInSeconds: 3600, // 1 hour
      });

      setCurrentToken(tokenResponse.token);
      setTokenExpiresAt(tokenResponse.expiresAt);

      return tokenResponse.token;
    } catch (err) {
      console.error("Error generating token:", err);
      setError("Failed to generate authentication token");
      throw err;
    }
  };

  // Function to check if token is expired or about to expire
  const isTokenExpired = () => {
    if (!tokenExpiresAt) return true;
    const now = Math.floor(Date.now() / 1000);
    return tokenExpiresAt - now < 300; // Consider expired if less than 5 minutes left
  };

  // Function to handle channel change
  const handleChannelChange = (newChannel: string) => {
    setChannelInput(newChannel);
  };

  // Function to set channel and save to localStorage
  const setChannelAndSave = (newChannel: string) => {
    // Validate channel name
    if (!newChannel.trim()) {
      setError("Channel name cannot be empty");
      return false;
    }

    // Agora channel name validation (alphanumeric, hyphens, underscores only)
    const channelRegex = /^[a-zA-Z0-9_-]+$/;
    if (!channelRegex.test(newChannel)) {
      setError(
        "Channel name can only contain letters, numbers, hyphens, and underscores"
      );
      return false;
    }

    if (newChannel.length > 64) {
      setError("Channel name must be 64 characters or less");
      return false;
    }

    setChannel(newChannel);
    localStorage.setItem("agora-channel", newChannel);
    setError(null);
    return true;
  };

  // Function to apply channel change
  const applyChannelChange = () => {
    if (setChannelAndSave(channelInput)) {
      // Clear current token since channel changed
      setCurrentToken(null);
      setTokenExpiresAt(null);
    }
  };

  const joinChannel = async () => {
    if (!clientRef.current || !appId || !channel || !agoraRTCRef.current) {
      setError("Missing required parameters or Agora SDK not loaded");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Generate a consistent UID for this session
      const sessionUid = currentUid || Math.floor(Math.random() * 1000000);
      setCurrentUid(sessionUid);

      // Generate a new token if we don't have one or if it's expired
      let joinToken = token || currentToken;

      if (!joinToken || isTokenExpired()) {
        joinToken = await generateToken(sessionUid);
      }

      // Join the channel with the same UID used for token generation
      await clientRef.current.join(appId, channel, joinToken, sessionUid);
      setIsJoined(true);

      // Create local tracks
      const [audioTrack, videoTrack] =
        await agoraRTCRef.current.createMicrophoneAndCameraTracks();

      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      // Play local video
      if (localVideoElementRef.current) {
        videoTrack.play(localVideoElementRef.current);
      }

      // Publish tracks
      await clientRef.current.publish([audioTrack, videoTrack]);
    } catch (err: any) {
      console.error("Error joining channel:", err);

      // Handle specific Agora errors
      if (err.code === 4096) {
        setError(
          "Token required: Your Agora project requires token authentication. Please add NEXT_PUBLIC_AGORA_TOKEN to your .env.local file or configure your project to allow static keys for development."
        );
      } else if (err.code === 17) {
        setError(
          "Invalid App ID: Please check your Agora App ID in .env.local"
        );
      } else if (err.code === 2) {
        setError("Invalid token: Please check your Agora token");
      } else {
        setError(err.message || "Failed to join channel");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const leaveChannel = async () => {
    if (!clientRef.current) return;

    setIsLoading(true);

    try {
      // Stop local tracks
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }

      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }

      // Leave the channel
      await clientRef.current.leave();

      // Clear local video
      if (localVideoElementRef.current) {
        localVideoElementRef.current.innerHTML = "";
      }

      // Clear remote video
      if (remoteVideoElementRef.current) {
        remoteVideoElementRef.current.innerHTML = "";
      }

      setIsJoined(false);
      setConnectionState("DISCONNECTED");
    } catch (err) {
      console.error("Error leaving channel:", err);
      setError(err instanceof Error ? err.message : "Failed to leave channel");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMute = async () => {
    if (localAudioTrackRef.current) {
      await localAudioTrackRef.current.setEnabled(
        !localAudioTrackRef.current.enabled
      );
    }
  };

  const toggleVideo = async () => {
    if (localVideoTrackRef.current) {
      await localVideoTrackRef.current.setEnabled(
        !localVideoTrackRef.current.enabled
      );
    }
  };

  // Show loading state while client-side hydration is happening
  if (!isClient || !agoraLoaded) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4 text-center">Video Call</h2>
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">
              {!isClient ? "Loading..." : "Loading video SDK..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="h-screen flex flex-col">
        <h2 className="text-white text-center py-4 text-lg font-medium">
          Video Call
        </h2>

        {/* Channel Input */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Channel Settings</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={channelInput}
              onChange={(e) => handleChannelChange(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !isJoined &&
                  channelInput !== channel
                ) {
                  applyChannelChange();
                }
              }}
              placeholder="Enter channel name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isJoined}
            />
            <button
              onClick={applyChannelChange}
              disabled={isJoined || channelInput === channel}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {channelInput === channel ? "Current" : "Set Channel"}
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Current channel:{" "}
            <span className="font-mono font-semibold">{channel}</span>
          </p>
        </div>

        {/* Status */}
        <div className="mb-4 text-center space-y-2">
          <div className="inline-block px-3 py-1 rounded-full text-sm font-medium">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 ${
                connectionState === "CONNECTED"
                  ? "bg-green-500"
                  : connectionState === "CONNECTING"
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
            ></span>
            {connectionState}
          </div>

          {/* Auto-join Status */}
          {!isJoined && !isLoading && (
            <div className="text-xs text-blue-600">
              Auto-joining video channel...
            </div>
          )}

          {/* Token Status */}
          {currentToken && isJoined && (
            <div className="text-xs text-gray-600">
              Token expires:{" "}
              {tokenExpiresAt
                ? new Date(tokenExpiresAt * 1000).toLocaleTimeString()
                : "Unknown"}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Video Container - Mobile Style */}
        <div className="flex-1 relative">
          {/* Remote Video - Full Screen */}
          <div className="absolute inset-0">
            <div
              ref={remoteVideoElementRef}
              className="w-full h-full bg-gray-900"
            ></div>
          </div>

          {/* Local Video - Picture in Picture */}
          <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
            <div ref={localVideoElementRef} className="w-full h-full"></div>
          </div>
        </div>

        {/* Mobile Controls */}
        <div className="flex justify-center space-x-8 pb-8">
          {!isJoined ? (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
              <p className="text-sm text-white">
                {isLoading
                  ? "Joining video channel..."
                  : "Preparing video call..."}
              </p>
            </div>
          ) : (
            <>
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className="w-12 h-12 bg-gray-600 bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all"
              >
                {localAudioTrackRef.current?.enabled ? (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                )}
              </button>

              {/* Video Toggle Button */}
              <button
                onClick={toggleVideo}
                className="w-12 h-12 bg-gray-600 bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all"
              >
                {localVideoTrackRef.current?.enabled ? (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.55-.18L19.73 21 21 19.73 3.27 2zM5 16V8h1.73l8 8H5z" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>

        {/* Instructions
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">
            Setup Instructions:
          </h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>
              1. Replace "your_app_id_here" in .env.local with your actual Agora
              App ID
            </li>
            <li>
              2. <strong>Token Setup:</strong> If you get a "Token required"
              error, you have two options:
            </li>
            <li className="ml-4">
              a) <strong>For Development:</strong> Go to your Agora Console →
              Project Settings → App Certificate → Enable "Use App Certificate"
              and set it to "No" (allows static keys)
            </li>
            <li className="ml-4">
              b) <strong>For Production:</strong> Generate a token server-side
              and add NEXT_PUBLIC_AGORA_TOKEN to .env.local
            </li>
            <li>3. Open this page in two different browser tabs or devices</li>
            <li>4. Click "Join Channel" on both devices</li>
            <li>
              5. You should see each other's video and hear each other's audio
            </li>
          </ol>
        </div> */}
      </div>
    </div>
  );
}
