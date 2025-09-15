"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { generateRtmToken } from "../lib/agora-token";
import type { RtmClient, RtmChannel } from "agora-rtm-react";
import { useRingtone } from "./useRingtone";
import type { SiteSettings } from "@/types/command";

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

interface UseAgoraCallProps {
  appId: string;
  rtcAppId: string;
}

export function useAgoraCall({ appId, rtcAppId }: UseAgoraCallProps) {
  // State
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
  const [isClient, setIsClient] = useState(false);
  const [rtmLoaded, setRtmLoaded] = useState(false);

  // Ringtone functionality
  const { playRingtone, stopRingtone, initializeAudio } = useRingtone();

  // Refs
  const currentCallIdRef = useRef<string | null>(null);
  const clientRef = useRef<(() => RtmClient) | null>(null);
  const channelRef = useRef<RtmChannel | null>(null);

  // Utility functions
  const resetCallState = useCallback(() => {
    currentCallIdRef.current = null;
    setCurrentCall(null);
    setCallState("IDLE");
    setShowVideoCall(false);
    setCurrentTargetUserId("");
    setError(null);
    stopRingtone();
  }, [stopRingtone]);

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

  const handleCallSignal = useCallback(
    (signal: CallSignal) => {
      switch (signal.type) {
        case "INCOMING_CALL":
          setCurrentCall(signal);
          setCallState("RINGING");
          playRingtone();
          break;
        case "CALL_ACCEPTED":
          setCurrentCall(signal);
          setCallState("CONNECTED");
          setShowVideoCall(true);
          stopRingtone();
          break;
        case "CALL_DECLINED":
          setCurrentCall(null);
          setCallState("IDLE");
          setError("Call was declined");
          stopRingtone();
          break;
        case "CALL_ENDED":
          resetCallState();
          stopRingtone();
          break;
      }
    },
    [resetCallState, playRingtone, stopRingtone]
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

  // Call handlers
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
      stopRingtone();
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
  }, [currentCall, sendCallSignal, handleError, stopRingtone]);

  const handleDeclineCall = useCallback(async () => {
    if (!currentCall) return;

    try {
      setError(null);
      stopRingtone();
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
  }, [currentCall, sendCallSignal, handleError, stopRingtone]);

  const handleEndActiveCall = useCallback(async () => {
    try {
      if (callState === "IDLE") return;

      stopRingtone();
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
    stopRingtone,
  ]);

  // Settings handlers
  const handleSettingsSave = useCallback((settings: SiteSettings) => {
    setSiteSettings(settings);
    setUserId(settings.siteName);
    setTargetUserIds(settings.targetUserIds);
    setChannel(settings.channel);
    setShowSettings(false);
  }, []);

  const handleSettingsBack = useCallback(() => {
    setShowSettings(false);
  }, []);

  // Effects
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      initializeAudio();
    }
  }, [isClient, initializeAudio]);

  useEffect(() => {
    return () => {
      stopRingtone();
    };
  }, [stopRingtone]);

  useEffect(() => {
    if (!isConnected || !channel) return;

    const heartbeatInterval = setInterval(() => {
      sendHeartbeat();
    }, 10000);

    return () => clearInterval(heartbeatInterval);
  }, [isConnected, channel, sendHeartbeat]);

  useEffect(() => {
    if (isClient) {
      const savedSettings = localStorage.getItem("dragnet-site-settings");
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSiteSettings(parsed);
          setUserId(parsed.siteName);
          setTargetUserIds(parsed.targetUserIds || []);
          setChannel(parsed.channel);
        } catch (error) {
          console.error("Failed to parse saved settings:", error);
          setShowSettings(true);
        }
      } else {
        setShowSettings(true);
      }
    }
  }, [isClient]);

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

  useEffect(() => {
    if (!userId || !isClient || !rtmLoaded || !clientRef.current) return;

    const initializeRtm = async () => {
      try {
        const token = await generateRtmTokenForUser(userId);
        const client = clientRef.current?.();
        if (!client) return;

        client.on("ConnectionStateChanged", handleConnectionStateChange);
        client.on("MessageFromPeer", handleMessageFromPeer);

        try {
          await client.login({ uid: userId, token });
          setIsConnected(true);
        } catch (tokenErr) {
          console.warn("Token login failed, trying without token:", tokenErr);
          await client.login({ uid: userId });
          setIsConnected(true);
        }

        try {
          await handleJoinChannel(channel);
        } catch (channelErr) {
          console.warn("Failed to auto-join channel:", channelErr);
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

  return {
    // State
    callState,
    currentCall,
    error,
    userId,
    targetUserIds,
    currentTargetUserId,
    channel,
    showVideoCall,
    isConnected,
    showSettings,
    siteSettings,
    isClient,
    rtmLoaded,

    // Actions
    handleInitiateCall,
    handleAcceptCall,
    handleDeclineCall,
    handleEndActiveCall,
    handleSettingsSave,
    handleSettingsBack,
    setShowSettings,
    setError,
  };
}
