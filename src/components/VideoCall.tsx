"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { generateAgoraToken } from "../lib/agora-token";
import VideoCallUI from "./VideoCallUI";
import { useTokenRefresh } from "../hooks/useTokenRefresh";
import type {
  ILocalVideoTrack,
  ILocalAudioTrack,
  CameraVideoTrackInitConfig,
  ClientConfig,
} from "agora-rtc-sdk-ng";

interface VideoCallProps {
  appId: string;
  token?: string; // Optional - will generate dynamically if not provided
  channel: string;
  handleEndActiveCall: () => void;
}

export default function VideoCall({
  appId,
  token,
  channel,
  handleEndActiveCall,
}: VideoCallProps) {
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
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);

  // Utility function to detect mobile devices
  const isMobileDevice = () => {
    if (typeof window === "undefined") return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };

  // Helper function to configure mobile audio routing
  const configureMobileAudio = useCallback((audioElement: HTMLAudioElement) => {
    if (isMobileDevice()) {
      audioElement.setAttribute("playsinline", "true");
      audioElement.setAttribute("webkit-playsinline", "true");
      audioElement.volume = 0.8; // Lower volume to prevent feedback
    }
  }, []);

  const clientRef = useRef<any>(null);
  const localVideoTrackRef = useRef<ILocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const localVideoElementRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoElementRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const agoraRTCRef = useRef<typeof import("agora-rtc-sdk-ng").default | null>(
    null
  );
  // Check if we're on the client side and load Agora SDK
  useEffect(() => {
    setIsClient(true);

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
  }, [isJoined, isClient]);

  // Initialize Agora client
  useEffect(() => {
    if (!isClient || !agoraLoaded || !agoraRTCRef.current) return;

    const config: ClientConfig = {
      mode: "rtc",
      codec: "vp8",
    };

    clientRef.current = agoraRTCRef.current.createClient(config);

    // Listen to connection state changes IMMEDIATELY after client creation
    clientRef.current.on("connection-state-change", (curState: string) => {
      setConnectionState(curState);
    });

    setClientReady(true);

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
            if (remoteAudioTrack && remoteAudioElementRef.current) {
              // Configure mobile audio routing
              configureMobileAudio(remoteAudioElementRef.current);
              remoteAudioTrack.play(remoteAudioElementRef.current);
            }
          }
        }
      }
    );

    // Listen to user left
    clientRef.current.on(
      "user-unpublished",
      (user: any, mediaType: "audio" | "video") => {
        if (mediaType === "video" && user.videoTrack) {
          user.videoTrack.stop();
        }
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.stop();
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
  const generateToken = useCallback(
    async (uid?: number) => {
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
    },
    [channel]
  );

  // Function to generate token for refresh (no UID parameter)
  const generateTokenForRefresh = useCallback(async () => {
    await generateToken();
  }, [generateToken]);

  // Use token refresh hook
  const { isTokenExpired } = useTokenRefresh({
    isJoined,
    tokenExpiresAt,
    generateToken: generateTokenForRefresh,
  });

  const joinChannel = useCallback(async () => {
    if (
      !clientRef.current ||
      !appId ||
      !channel ||
      !agoraRTCRef.current ||
      isJoined
    ) {
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

      // Create local tracks with Agora's advanced audio processing
      const audioConfig: any = {
        // Use Agora's built-in audio processing
        sampleRate: 48000,
        channelCount: 1,
        // Additional Agora-specific settings
        AEC: true, // Acoustic Echo Cancellation
        ANS: true, // Automatic Noise Suppression
        AGC: true, // Automatic Gain Control
        // Use mono audio to reduce feedback
      };

      const videoConfig: CameraVideoTrackInitConfig = {
        // Video track options
        encoderConfig: "480p_1",
      };

      const [audioTrack, videoTrack] =
        await agoraRTCRef.current.createMicrophoneAndCameraTracks(
          audioConfig,
          videoConfig
        );

      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      // Initialize state based on track enabled status
      setIsMuted(!audioTrack.enabled);
      setIsVideoOff(!videoTrack.enabled);

      // Play local video
      if (localVideoElementRef.current) {
        videoTrack.play(localVideoElementRef.current);
      }

      // Set audio route to earpiece on mobile devices to prevent feedback
      if (isMobileDevice()) {
        try {
          // Use Agora's audio output routing for mobile
          await clientRef.current.setAudioOutput("earpiece");
          console.log("Audio routed to earpiece for mobile device");
        } catch (error) {
          console.log("Failed to set audio output to earpiece:", error);

          // Fallback: Configure audio element for mobile
          if (remoteAudioElementRef.current) {
            configureMobileAudio(remoteAudioElementRef.current);
          }
        }
      }

      // Publish tracks
      await clientRef.current.publish([audioTrack, videoTrack]);
    } catch (err: unknown) {
      console.error("Error joining channel:", err);

      // Handle specific Agora errors
      const error = err as { code: number; message: string };
      if (error.code === 4096) {
        setError(
          "Token required: Your Agora project requires token authentication. Please add NEXT_PUBLIC_AGORA_TOKEN to your .env.local file or configure your project to allow static keys for development."
        );
      } else if (error.code === 17) {
        setError(
          "Invalid App ID: Please check your Agora App ID in .env.local"
        );
      } else if (error.code === 2) {
        setError("Invalid token: Please check your Agora token");
      } else {
        setError(error.message || "Failed to join channel");
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    appId,
    channel,
    token,
    currentToken,
    generateToken,
    isJoined,
    agoraRTCRef,
    clientRef,
    currentUid,
    isTokenExpired,
    configureMobileAudio,
  ]);

  const toggleMute = useCallback(async () => {
    if (localAudioTrackRef.current) {
      const newState = !localAudioTrackRef.current.enabled;
      await localAudioTrackRef.current.setEnabled(newState);
      setIsMuted((prev) => !prev);
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    if (localVideoTrackRef.current) {
      const newState = !localVideoTrackRef.current.enabled;
      await localVideoTrackRef.current.setEnabled(newState);
      setIsVideoOff((prev) => !prev);
    }
  }, []);

  return (
    <VideoCallUI
      isClient={isClient}
      agoraLoaded={agoraLoaded}
      isJoined={isJoined}
      isLoading={isLoading}
      error={error}
      connectionState={connectionState}
      localVideoElementRef={localVideoElementRef}
      remoteVideoElementRef={remoteVideoElementRef}
      remoteAudioElementRef={remoteAudioElementRef}
      isMuted={isMuted}
      isVideoOff={isVideoOff}
      onToggleMute={toggleMute}
      onToggleVideo={toggleVideo}
      onEndCall={handleEndActiveCall}
    />
  );
}
