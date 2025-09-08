"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import VideoCall from "./VideoCall";
import SettingsPage from "./SettingsPage";
import { generateRtmToken } from "../lib/agora-token";
import type { RtmClient, RtmChannel } from "agora-rtm-react";
import RingingPhoneSVG from "./svg/RingingPhone";
import ErrorPhoneSVG from "./svg/ErrorPhone";
import OutgoingPhoneSVG from "./svg/OutgoingPhone";
import IdlePhoneSVG from "./svg/IdlePhone";
import IdlePhone2SVG from "./svg/IdlePhone2";

import type { SiteSettings } from "@/types/command";

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
  const [settingsTapCount, setSettingsTapCount] = useState(0);
  const [showSettingsButton, setShowSettingsButton] = useState(false);
  const router = useRouter();

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

  // Heartbeat and presence tracking
  const sendHeartbeat = useCallback(async () => {
    if (!channelRef.current || !userId) return;

    try {
      const heartbeatMessage = {
        type: "heartbeat",
        userId: userId,
        timestamp: Date.now(),
        siteName: siteSettings?.siteName || userId,
      };

      await channelRef.current.sendMessage({
        text: JSON.stringify(heartbeatMessage),
      });
    } catch (error) {
      console.error("Failed to send heartbeat:", error);
    }
  }, [userId, siteSettings?.siteName]);


  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    console.error(defaultMessage, error);
    const errorMessage =
      error instanceof Error ? error.message : defaultMessage;
    setError(errorMessage);
  }, []);

  // Magic settings button activation
  const handleMagicTap = useCallback(() => {
    const newCount = settingsTapCount + 1;
    setSettingsTapCount(newCount);

    if (newCount >= 10) {
      setShowSettingsButton(true);
      setSettingsTapCount(0); // Reset counter
    }
  }, [settingsTapCount]);

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Heartbeat timer
  useEffect(() => {
    if (!isConnected || !channel) return;

    const heartbeatInterval = setInterval(() => {
      sendHeartbeat();
    }, 10000); // Send heartbeat every 10 seconds

    return () => clearInterval(heartbeatInterval);
  }, [isConnected, channel, sendHeartbeat]);


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
    (signal: CallSignal) => {
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
        const handleChannelMessage = (message: any) => {
          try {
            const data = JSON.parse(message.text);

            // Handle heartbeat messages
            if (data.type === "heartbeat") {
              return;
            }

            // Handle call signals
            const signal: CallSignal = data;
            handleCallSignal(signal);
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
    (message: any) => {
      try {
        const signal: CallSignal = JSON.parse(message.text);
        handleCallSignal(signal);
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
      {/* Left Half - Main Photo Background */}
      <div
        className="hidden lg:block lg:w-1/2 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url(/MainPhoto.jpg)",
        }}
      ></div>

      {/* Right Half - Centered Content */}
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20 overflow-hidden">
              {siteSettings?.logo ? (
                <Image
                  src={siteSettings.logo}
                  alt="Site Logo"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover rounded-3xl"
                />
              ) : (
                <span className="text-white font-light text-4xl tracking-wider">
                  D
                </span>
              )}
            </div>
            <h1 className="text-5xl font-semibold text-white mb-4 tracking-wide">
              Dragnet Intercom
            </h1>
            <p className="text-blue-100 text-xl font-medium">
              Secure Communication
            </p>
          </div>
          {/* Error Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 text-red-300 rounded-xl">
              <div className="flex items-center">
                <ErrorPhoneSVG />
                {error}
              </div>
            </div>
          )}

          {/* Call State Display */}
          {callState !== "IDLE" && (
            <div className="mb-8 p-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl text-center">
              <div className="flex items-center justify-center mb-3">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse mr-3"></div>
                <p className="text-xl font-semibold text-blue-50 tracking-wide">
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
                <RingingPhoneSVG />
              </div>
              <p className="text-3xl font-semibold text-white mb-4 tracking-wide">
                Incoming call from: {currentCall.from}
              </p>
              <p className="text-blue-100 mb-8 font-medium text-lg">
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
                <OutgoingPhoneSVG />
              </div>
              <p className="text-3xl font-semibold text-white mb-8 tracking-wide">
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
                <h3 className="text-2xl font-semibold text-blue-50 text-center mb-12 tracking-wide">
                  SELECT TABLET TO CALL
                </h3>
                <div className="space-y-6">
                  {targetUserIds.map((targetId, index) => (
                    <button
                      key={index}
                      onClick={() => handleInitiateCall(targetId)}
                      disabled={!channel || !isConnected}
                      className="group w-full px-8 py-6 bg-white/5 backdrop-blur-sm border border-white/10 text-white rounded-2xl hover:bg-white/10 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-xl text-center transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/10 disabled:hover:bg-white/5"
                    >
                      <div className="flex items-center justify-center space-x-4">
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors duration-300">
                          <IdlePhoneSVG />
                        </div>
                        <span className="tracking-wide">
                          {siteSettings?.customButtonTexts?.[targetId] ||
                            `Call ${targetId}`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Magic Settings Area */}
                <div className="mt-16 text-center">
                  {/* Hidden Magic Tap Area */}
                  <div
                    onClick={handleMagicTap}
                    className="w-full h-16 cursor-pointer"
                    title="Tap 10 times to unlock settings"
                  >
                    {/* Invisible tap area */}
                  </div>

                  {/* Settings Button - Only visible when unlocked */}
                  {showSettingsButton && (
                    <div className="mt-4 flex gap-4 justify-center">
                      <button
                        onClick={() => setShowSettings(true)}
                        className="px-8 py-3 bg-white/5 backdrop-blur-sm border border-white/10 text-blue-200 rounded-xl hover:bg-white/10 hover:border-white/20 font-light transition-all duration-300"
                      >
                        Settings
                      </button>
                      <button
                        onClick={() => router.push("/command")}
                        className="px-8 py-3 bg-blue-500/20 backdrop-blur-sm border border-blue-500/30 text-blue-100 rounded-xl hover:bg-blue-500/30 hover:border-blue-500/50 font-light transition-all duration-300"
                      >
                        Command Dashboard
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          {callState === "IDLE" &&
            (!targetUserIds || targetUserIds.length === 0) && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-8 bg-white/5 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/10">
                  <IdlePhone2SVG />
                </div>
                <p className="text-blue-100 mb-12 text-xl font-light tracking-wide">
                  No target tablets configured
                </p>

                {/* Hidden Magic Tap Area */}
                <div
                  onClick={handleMagicTap}
                  className="w-full h-16 cursor-pointer mb-4"
                  title="Tap 10 times to unlock settings"
                >
                  {/* Invisible tap area */}
                </div>

                {/* Settings Button - Only visible when unlocked */}
                {showSettingsButton && (
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-10 py-4 bg-white/10 backdrop-blur-sm border border-white/20 text-white rounded-2xl hover:bg-white/20 hover:border-white/30 font-light text-lg transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10"
                  >
                    Configure Settings
                  </button>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
