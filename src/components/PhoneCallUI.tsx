"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import VideoCall from "./VideoCall";
import SettingsPage from "./SettingsPage";
import { generateRtmToken } from "../lib/agora-token";
import type { RtmClient, RtmChannel } from "agora-rtm-react";

interface SiteSettings {
  channel: string;
  targetUserIds: string[];
  siteName: string;
}

interface PhoneCallUIProps {
  appId: string;
  rtcAppId: string;
}

export type CallState =
  | "IDLE" // No call
  | "CALLING" // Tablet A: calling out
  | "RINGING" // Tablet B: incoming call
  | "CONNECTED" // Both: in call
  | "ENDED"; // Call finished

export interface CallSignal {
  type: "INCOMING_CALL" | "CALL_ACCEPTED" | "CALL_DECLINED" | "CALL_ENDED";
  from: string;
  to: string;
  channel: string;
  timestamp: number;
  callId: string;
}

interface RtmError {
  code: number;
  message: string;
  reason?: string;
}

export default function PhoneCallUI({ appId, rtcAppId }: PhoneCallUIProps) {
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [currentCall, setCurrentCall] = useState<CallSignal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [currentTargetUserId, setCurrentTargetUserId] = useState<string>("");
  const [channel, setChannel] = useState<string>("dragnet-channel");
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  const currentCallIdRef = useRef<string | null>(null);
  const clientRef = useRef<(() => RtmClient) | null>(null);
  const channelRef = useRef<RtmChannel | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [rtmLoaded, setRtmLoaded] = useState(false);

  // Utility functions
  const resetCallState = useCallback(() => {
    currentCallIdRef.current = null;
    setCurrentCall(null);
    setCallState("IDLE");
    setShowVideoCall(false);
    setCurrentTargetUserId("");
    setError(null);
  }, []);

  const generateCallId = useCallback((): string => {
    const callId = `call_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    currentCallIdRef.current = callId;
    return callId;
  }, []);

  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    console.error(defaultMessage, error);
    const errorMessage =
      error instanceof Error ? error.message : defaultMessage;
    setError(errorMessage);
  }, []);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (isClient) {
      const savedSettings = localStorage.getItem("dragnet-site-settings");
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSiteSettings(parsed);
          setUserId(parsed.siteName); // Use site name as user ID
          setTargetUserIds(parsed.targetUserIds || []);
          setChannel(parsed.channel);
        } catch (error) {
          console.error("Failed to parse saved settings:", error);
          // Show settings page if parsing fails
          setShowSettings(true);
        }
      } else {
        // Show settings page if no settings found
        setShowSettings(true);
      }
    }
  }, [isClient]);

  // Settings handlers
  const handleSettingsSave = (settings: SiteSettings) => {
    setSiteSettings(settings);
    setUserId(settings.siteName); // Use site name as user ID
    setTargetUserIds(settings.targetUserIds);
    setChannel(settings.channel);
    setShowSettings(false);
  };

  const handleSettingsBack = () => {
    setShowSettings(false);
  };

  // Generate RTM token
  const generateRtmTokenForUser = useCallback(
    async (uid: string): Promise<string> => {
      try {
        const tokenResponse = await generateRtmToken({
          uid: uid,
          expirationTimeInSeconds: 3600, // 1 hour
        });
        return tokenResponse.token;
      } catch (err) {
        handleError(err, "Failed to generate authentication token");
        throw err;
      }
    },
    [handleError]
  );

  // Load RTM dynamically
  useEffect(() => {
    if (!isClient) return;

    const loadRTM = async () => {
      try {
        const { createClient } = await import("agora-rtm-react");
        const useClient = createClient(appId);
        clientRef.current = useClient;
        setRtmLoaded(true);
      } catch (err) {
        handleError(err, "Failed to load messaging service");
      }
    };

    loadRTM();
  }, [isClient, appId, handleError]);

  const handleCallSignal = useCallback(
    (signal: CallSignal, from: string) => {
      switch (signal.type) {
        case "INCOMING_CALL":
          setCurrentCall(signal);
          setCallState("RINGING");
          break;
        case "CALL_ACCEPTED":
          setCurrentCall(signal);
          setCallState("CONNECTED");
          setShowVideoCall(true);
          break;
        case "CALL_DECLINED":
          setCurrentCall(null);
          setCallState("IDLE");
          setError("Call was declined");
          break;
        case "CALL_ENDED":
          resetCallState();
          break;
      }
    },
    [resetCallState]
  );

  const handleJoinChannel = useCallback(
    async (channelName: string) => {
      try {
        setError(null);
        if (!clientRef.current || !channelName) return;

        const { createChannel } = await import("agora-rtm-react");
        const RTMChannel = createChannel(channelName);
        const client = clientRef.current();

        if (!client) {
          throw new Error("RTM client not available for channel join");
        }

        const rtmChannel = RTMChannel(client);

        // Set up channel event listeners
        const handleChannelMessage = (message: any, memberId: string) => {
          try {
            const signal: CallSignal = JSON.parse(message.text);
            handleCallSignal(signal, memberId);
          } catch (err) {
            handleError(err, "Failed to parse channel message");
          }
        };

        rtmChannel.on("ChannelMessage", handleChannelMessage);
        await rtmChannel.join();
        setChannel(channelName);

        // Store channel reference for cleanup
        channelRef.current = rtmChannel;
      } catch (err) {
        handleError(err, "Failed to join channel");
      }
    },
    [handleCallSignal, handleError]
  );

  // Event handlers for RTM client
  const handleConnectionStateChange = useCallback((newState: string) => {
    setIsConnected(newState === "CONNECTED");
  }, []);

  const handleMessageFromPeer = useCallback(
    (message: any, peerId: string) => {
      try {
        const signal: CallSignal = JSON.parse(message.text);
        handleCallSignal(signal, peerId);
      } catch (err) {
        handleError(err, "Failed to parse peer message");
      }
    },
    [handleCallSignal, handleError]
  );

  // Initialize client
  useEffect(() => {
    if (!userId || !isClient || !rtmLoaded || !clientRef.current) return;

    const initializeRtm = async () => {
      try {
        // Generate RTM token first
        const token = await generateRtmTokenForUser(userId);
        const client = clientRef.current?.();
        if (!client) return;

        client.on("ConnectionStateChanged", handleConnectionStateChange);
        client.on("MessageFromPeer", handleMessageFromPeer);

        // Try login with token first, fallback to no token
        try {
          await client.login({ uid: userId, token });
          setIsConnected(true);
        } catch (tokenErr) {
          console.warn("Token login failed, trying without token:", tokenErr);
          await client.login({ uid: userId });
          setIsConnected(true);
        }

        // Automatically join the default channel after successful login
        try {
          await handleJoinChannel(channel);
        } catch (channelErr) {
          console.warn("Failed to auto-join channel:", channelErr);
          // Don't set error here as RTM is still connected, just channel join failed
        }
      } catch (err) {
        const rtmError = err as RtmError;
        handleError(
          err,
          `Failed to connect to messaging service: ${rtmError.message}`
        );
      }
    };

    initializeRtm();

    return () => {
      const client = clientRef.current?.();
      if (client) {
        client.off("ConnectionStateChanged", handleConnectionStateChange);
        client.off("MessageFromPeer", handleMessageFromPeer);
      }
    };
  }, [
    userId,
    isClient,
    rtmLoaded,
    generateRtmTokenForUser,
    handleError,
    channel,
    handleConnectionStateChange,
    handleMessageFromPeer,
    handleJoinChannel,
  ]);

  const sendCallSignal = useCallback(
    async (
      to: string,
      channel: string,
      type: CallSignal["type"]
    ): Promise<void> => {
      if (!isConnected) {
        throw new Error("RTM not connected");
      }

      const callId = currentCallIdRef.current || generateCallId();
      const signal: CallSignal = {
        type,
        from: userId,
        to,
        channel,
        timestamp: Date.now(),
        callId,
      };

      try {
        const client = clientRef.current?.();
        if (!client) {
          throw new Error("RTM client not available");
        }

        const message = client.createMessage({
          text: JSON.stringify(signal),
          messageType: "TEXT",
        });

        await client.sendMessageToPeer(message, to);
      } catch (error) {
        handleError(error, "Failed to send call signal");
        throw error;
      }
    },
    [isConnected, userId, generateCallId, handleError]
  );

  const handleInitiateCall = useCallback(
    async (targetUserId: string) => {
      if (!targetUserId || !channel) {
        setError("Please enter target user ID and channel");
        return;
      }

      try {
        setError(null);
        setCurrentTargetUserId(targetUserId);
        generateCallId();
        await sendCallSignal(targetUserId, channel, "INCOMING_CALL");
        setCallState("CALLING");
      } catch (err) {
        handleError(err, "Failed to initiate call");
      }
    },
    [channel, generateCallId, sendCallSignal, handleError]
  );

  const handleAcceptCall = useCallback(async () => {
    if (!currentCall) return;

    try {
      setError(null);
      await sendCallSignal(
        currentCall.from,
        currentCall.channel,
        "CALL_ACCEPTED"
      );
      setCallState("CONNECTED");
      setShowVideoCall(true);
    } catch (err) {
      handleError(err, "Failed to accept call");
    }
  }, [currentCall, sendCallSignal, handleError]);

  const handleDeclineCall = useCallback(async () => {
    if (!currentCall) return;

    try {
      setError(null);
      await sendCallSignal(
        currentCall.from,
        currentCall.channel,
        "CALL_DECLINED"
      );
      setCurrentCall(null);
      setCallState("IDLE");
    } catch (err) {
      handleError(err, "Failed to decline call");
    }
  }, [currentCall, sendCallSignal, handleError]);

  const handleEndCall = useCallback(async () => {
    try {
      // If already idle, don't double-cleanup
      if (callState === "IDLE") return;

      const target = currentCall?.from ?? currentTargetUserId;
      if (target) {
        await sendCallSignal(target, channel, "CALL_ENDED");
      } else {
        console.warn("No target user to notify about call end");
      }
      resetCallState();
    } catch (err) {
      handleError(err, "Failed to end call");
    }
  }, [
    callState,
    currentCall,
    currentTargetUserId,
    channel,
    sendCallSignal,
    resetCallState,
    handleError,
  ]);

  // Show settings page if no settings configured
  if (showSettings) {
    return (
      <SettingsPage
        onSettingsSave={handleSettingsSave}
        onBack={handleSettingsBack}
        currentSettings={siteSettings || undefined}
      />
    );
  }

  // Show loading state while client-side hydration is happening
  if (!isClient || !rtmLoaded) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">
            {!isClient ? "Loading..." : "Loading messaging service..."}
          </p>
        </div>
      </div>
    );
  }

  // Show video call when connected
  if (showVideoCall && channel) {
    return (
      <div className="min-h-screen bg-black relative">
        {/* Video Call Component */}
        <VideoCall appId={rtcAppId} endCall={handleEndCall} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Half - Full Black Background */}
      <div className="hidden lg:block lg:w-1/2 bg-black"></div>

      {/* Right Half - Centered Content */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20">
              <span className="text-white font-light text-4xl tracking-wider">
                D
              </span>
            </div>
            <h1 className="text-4xl font-light text-white mb-3 tracking-wide">
              Dragnet Intercom
            </h1>
            <p className="text-blue-200 text-lg font-light">
              Secure Communication
            </p>
          </div>
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl">
              <div className="flex items-center">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                {error}
              </div>
            </div>
          )}

          {/* Call State Display */}
          {callState !== "IDLE" && (
            <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse mr-3"></div>
                <p className="text-lg font-light text-blue-100 tracking-wide">
                  {callState === "CALLING" && "Calling..."}
                  {callState === "RINGING" && "Incoming Call!"}
                  {callState === "CONNECTED" && "Call Connected"}
                  {callState === "ENDED" && "Call Ended"}
                </p>
              </div>
            </div>
          )}

          {/* Incoming Call UI */}
          {callState === "RINGING" && currentCall && (
            <div className="mb-8 p-8 bg-white/5 backdrop-blur-sm border border-white/20 rounded-3xl text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-green-500/20 rounded-full flex items-center justify-center border border-green-500/30">
                <svg
                  className="w-10 h-10 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
              <p className="text-2xl font-light text-white mb-3 tracking-wide">
                Incoming call from: {currentCall.from}
              </p>
              <p className="text-blue-200 mb-8 font-light">
                Channel: {currentCall.channel}
              </p>
              <div className="flex gap-6 justify-center">
                <button
                  onClick={handleAcceptCall}
                  className="px-10 py-4 bg-green-500/20 backdrop-blur-sm border border-green-500/30 text-green-300 rounded-2xl hover:bg-green-500/30 hover:border-green-500/50 font-light text-lg transition-all duration-300"
                >
                  Accept
                </button>
                <button
                  onClick={handleDeclineCall}
                  className="px-10 py-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 rounded-2xl hover:bg-red-500/30 hover:border-red-500/50 font-light text-lg transition-all duration-300"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Outgoing Call UI */}
          {callState === "CALLING" && (
            <div className="mb-8 p-8 bg-white/5 backdrop-blur-sm border border-white/20 rounded-3xl text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-blue-500/20 rounded-full flex items-center justify-center animate-pulse border border-blue-500/30">
                <svg
                  className="w-10 h-10 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
              </div>
              <p className="text-2xl font-light text-white mb-8 tracking-wide">
                Calling {currentTargetUserId}...
              </p>
              <button
                onClick={handleEndCall}
                className="px-10 py-4 bg-red-500/20 backdrop-blur-sm border border-red-500/30 text-red-300 rounded-2xl hover:bg-red-500/30 hover:border-red-500/50 font-light text-lg transition-all duration-300"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Call Controls */}
          {callState === "IDLE" &&
            targetUserIds &&
            targetUserIds.length > 0 && (
              <div className="space-y-8">
                <h3 className="text-xl font-light text-blue-100 text-center mb-12 tracking-wide">
                  SELECT TABLET TO CALL
                </h3>
                <div className="space-y-6">
                  {targetUserIds.map((targetId, index) => (
                    <button
                      key={index}
                      onClick={() => handleInitiateCall(targetId)}
                      disabled={!channel || !isConnected}
                      className="group w-full px-8 py-5 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-2xl hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-lg text-center transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 disabled:hover:bg-white/5"
                    >
                      <div className="flex items-center justify-center space-x-4">
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors duration-300">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                          </svg>
                        </div>
                        <span className="tracking-wide">Call {targetId}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Settings Button */}
                <div className="mt-16 text-center">
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-8 py-3 bg-white/5 backdrop-blur-sm border border-white/10 text-blue-200 rounded-xl hover:bg-white/10 hover:border-white/20 font-light transition-all duration-300"
                  >
                    Settings
                  </button>
                </div>
              </div>
            )}

          {callState === "IDLE" &&
            (!targetUserIds || targetUserIds.length === 0) && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-8 bg-white/5 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/10">
                  <svg
                    className="w-10 h-10 text-blue-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
                    />
                  </svg>
                </div>
                <p className="text-blue-100 mb-12 text-xl font-light tracking-wide">
                  No target tablets configured
                </p>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-10 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl hover:bg-white/20 hover:border-white/30 font-light text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10"
                >
                  Configure Settings
                </button>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
