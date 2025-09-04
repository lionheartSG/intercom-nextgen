"use client";

import { useEffect, useRef, useState } from "react";
import { generateAgoraToken } from "../lib/agora-token";

interface VideoCallProps {
  appId: string;
  channel: string;
  token?: string;
}

export default function VideoCall({ appId, channel, token }: VideoCallProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<string>("DISCONNECTED");
  const [isClient, setIsClient] = useState(false);
  const [agoraLoaded, setAgoraLoaded] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [currentUid, setCurrentUid] = useState<number>(0);

  const clientRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoElementRef = useRef<HTMLDivElement>(null);
  const remoteVideoElementRef = useRef<HTMLDivElement>(null);
  const agoraRTCRef = useRef<any>(null);

  // Check if we're on the client side and load Agora SDK
  useEffect(() => {
    setIsClient(true);

    // Dynamically import Agora SDK
    const loadAgora = async () => {
      try {
        const AgoraRTC = await import("agora-rtc-sdk-ng");
        agoraRTCRef.current = AgoraRTC.default;
        setAgoraLoaded(true);
        console.log("Agora SDK loaded successfully");
      } catch (err) {
        console.error("Failed to load Agora SDK:", err);
        setError("Failed to load video calling SDK");
      }
    };

    loadAgora();
  }, []);

  // Token refresh mechanism
  useEffect(() => {
    if (!isJoined || !tokenExpiresAt) return;

    const checkTokenExpiry = () => {
      if (isTokenExpired()) {
        console.log("Token is about to expire, refreshing...");
        generateToken().catch(console.error);
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, [isJoined, tokenExpiresAt]);

  // Initialize Agora client
  useEffect(() => {
    if (!isClient || !agoraLoaded || !agoraRTCRef.current) return;

    const config = {
      mode: "rtc",
      codec: "vp8",
    };

    clientRef.current = agoraRTCRef.current.createClient(config);

    // Listen to connection state changes
    clientRef.current.on(
      "connection-state-change",
      (curState: string, revState: string) => {
        console.log("Connection state changed:", revState, "->", curState);
        setConnectionState(curState);
      }
    );

    // Listen to user joined
    clientRef.current.on(
      "user-published",
      async (user: any, mediaType: "audio" | "video") => {
        console.log("User published:", user, mediaType);

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
        console.log("User unpublished:", user, mediaType);
        if (mediaType === "video" && remoteVideoElementRef.current) {
          remoteVideoElementRef.current.innerHTML = "";
        }
      }
    );

    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
      }
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

      console.log(
        "Token generated successfully for UID:",
        tokenUid,
        "expires at:",
        new Date(tokenResponse.expiresAt * 1000)
      );
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
        console.log("Generating new token for UID:", sessionUid);
        joinToken = await generateToken(sessionUid);
      }

      console.log("Joining channel with:", {
        appId,
        channel,
        uid: sessionUid,
        hasToken: !!joinToken,
        tokenExpiresAt: tokenExpiresAt
          ? new Date(tokenExpiresAt * 1000).toISOString()
          : "N/A",
      });

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
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Video Call</h2>

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

          {/* Token Status */}
          {currentToken && (
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

        {/* Video Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Local Video */}
          <div className="relative">
            <h3 className="text-sm font-medium mb-2">You</h3>
            <div
              ref={localVideoElementRef}
              className="w-full h-48 bg-gray-200 rounded-lg border-2 border-gray-300"
            ></div>
          </div>

          {/* Remote Video */}
          <div className="relative">
            <h3 className="text-sm font-medium mb-2">Remote User</h3>
            <div
              ref={remoteVideoElementRef}
              className="w-full h-48 bg-gray-200 rounded-lg border-2 border-gray-300"
            ></div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center space-x-4">
          {!isJoined ? (
            <button
              onClick={joinChannel}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Joining..." : "Join Channel"}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                {localAudioTrackRef.current?.enabled ? "Mute" : "Unmute"}
              </button>
              <button
                onClick={toggleVideo}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                {localVideoTrackRef.current?.enabled
                  ? "Stop Video"
                  : "Start Video"}
              </button>
              <button
                onClick={leaveChannel}
                disabled={isLoading}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Leaving..." : "Leave Channel"}
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
