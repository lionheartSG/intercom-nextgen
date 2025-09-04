"use client";

import { useState, useEffect, useRef } from "react";
import VideoCall from "./VideoCall";
import SettingsPage from "./SettingsPage";
import { generateRtmToken } from "../lib/agora-token";

interface SiteSettings {
  siteId: string;
  channel: string;
  userId: string;
  targetUserId: string;
  siteName: string;
}

interface PhoneCallUIProps {
  appId: string;
  rtcAppId: string;
  token?: string; // Keep for backward compatibility but not used
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

export default function PhoneCallUI({
  appId,
  rtcAppId,
  token,
}: PhoneCallUIProps) {
  const [callState, setCallState] = useState<CallState>("IDLE");
  const [currentCall, setCurrentCall] = useState<CallSignal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [channel, setChannel] = useState<string>("dragnet-channel");
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [rtmToken, setRtmToken] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  const currentCallIdRef = useRef<string | null>(null);
  const clientRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const [isClient, setIsClient] = useState(false);
  const [rtmLoaded, setRtmLoaded] = useState(false);

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
          setUserId(parsed.userId);
          setTargetUserId(parsed.targetUserId);
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
    setUserId(settings.userId);
    setTargetUserId(settings.targetUserId);
    setChannel(settings.channel);
    setShowSettings(false);
  };

  const handleSettingsBack = () => {
    setShowSettings(false);
  };

  // Generate RTM token
  const generateRtmTokenForUser = async (uid: string) => {
    try {
      const tokenResponse = await generateRtmToken({
        uid: uid,
        expirationTimeInSeconds: 3600, // 1 hour
      });
      setRtmToken(tokenResponse.token);
      return tokenResponse.token;
    } catch (err) {
      console.error("Failed to generate RTM token:", err);
      setError("Failed to generate authentication token");
      throw err;
    }
  };

  // Load RTM dynamically
  useEffect(() => {
    if (!isClient) return;

    const loadRTM = async () => {
      try {
        const { createClient, createChannel } = await import("agora-rtm-react");

        const useClient = createClient(appId);

        clientRef.current = useClient;
        setRtmLoaded(true);
      } catch (err) {
        console.error("Failed to load RTM:", err);
        setError("Failed to load messaging service");
      }
    };

    loadRTM();
  }, [isClient, appId]);

  // Initialize client
  useEffect(() => {
    if (userId && isClient && rtmLoaded && clientRef.current) {
      const initializeRtm = async () => {
        try {
          // Generate RTM token first
          const token = await generateRtmTokenForUser(userId);

          const client = clientRef.current();
          const actualClient = client;

          // Set up client event listeners
          const handleConnectionStateChange = (newState: string) => {
            setIsConnected(newState === "CONNECTED");
          };

          const handleMessageFromPeer = (message: any, peerId: string) => {
            try {
              const signal: CallSignal = JSON.parse(message.text);
              handleCallSignal(signal, peerId);
            } catch (err) {
              console.error("Failed to parse peer message:", err);
            }
          };

          actualClient.on(
            "ConnectionStateChanged",
            handleConnectionStateChange
          );
          actualClient.on("MessageFromPeer", handleMessageFromPeer);

          // Try different login approaches

          // First try with token
          try {
            await actualClient.login({ uid: userId, token: token });
            setIsConnected(true);
          } catch (tokenErr: any) {
            // If token login fails, try without token
            await actualClient.login({ uid: userId });
            setIsConnected(true);
          }

          // Automatically join the default channel after successful login
          try {
            await handleJoinChannel(channel);
          } catch (channelErr) {
            console.error("Failed to auto-join channel:", channelErr);
            // Don't set error here as RTM is still connected, just channel join failed
          }
        } catch (err: any) {
          console.error("Failed to initialize RTM:", err);
          console.error("Error details:", {
            code: err.code,
            message: err.message,
            userId: userId,
            hasAppId: !!appId,
          });
          setError(`Failed to connect to messaging service: ${err.message}`);
        }
      };

      initializeRtm();

      return () => {
        if (clientRef.current) {
          const client = clientRef.current();
          client.off("ConnectionStateChanged");
          client.off("MessageFromPeer");
        }
      };
    }
  }, [userId, isClient, rtmLoaded]);

  const handleCallSignal = (signal: CallSignal, from: string) => {
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
        setCurrentCall(null);
        setCallState("IDLE");
        setShowVideoCall(false);
        break;
    }
  };

  const sendCallSignal = async (
    to: string,
    channel: string,
    type: CallSignal["type"]
  ) => {
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
      // Get the actual client instance
      const client = clientRef.current();
      const message = client.createMessage({
        text: JSON.stringify(signal),
        messageType: "TEXT",
      });
      await client.sendMessageToPeer(message, to);
    } catch (error) {
      console.error("Failed to send call signal:", error);
      throw error;
    }
  };

  const generateCallId = (): string => {
    const callId = `call_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    currentCallIdRef.current = callId;
    return callId;
  };

  const handleInitiateCall = async () => {
    if (!targetUserId || !channel) {
      setError("Please enter target user ID and channel");
      return;
    }

    try {
      setError(null);
      generateCallId();
      await sendCallSignal(targetUserId, channel, "INCOMING_CALL");
      setCallState("CALLING");
    } catch (err) {
      console.error("Failed to initiate call:", err);
      setError("Failed to initiate call");
    }
  };

  const handleAcceptCall = async () => {
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
      console.error("Failed to accept call:", err);
      setError("Failed to accept call");
    }
  };

  const handleDeclineCall = async () => {
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
      console.error("Failed to decline call:", err);
      setError("Failed to decline call");
    }
  };

  const handleEndCall = async () => {
    try {
      setError(null);

      // Send end call signal
      if (currentCallIdRef.current && channelRef.current) {
        const endSignal: CallSignal = {
          type: "CALL_ENDED",
          from: userId,
          to: "",
          channel: channel,
          timestamp: Date.now(),
          callId: currentCallIdRef.current,
        };

        const client = clientRef.current();
        const message = client.createMessage({
          text: JSON.stringify(endSignal),
          messageType: "TEXT",
        });
        await channelRef.current.sendMessage(message);
      }

      currentCallIdRef.current = null;
      setCurrentCall(null);
      setCallState("IDLE");
      setShowVideoCall(false);
    } catch (err) {
      console.error("Failed to end call:", err);
      setError("Failed to end call");
    }
  };

  const handleJoinChannel = async (channelName: string) => {
    try {
      setError(null);
      if (clientRef.current && channelName) {
        const { createChannel } = await import("agora-rtm-react");
        const useChannel = createChannel(channelName);
        const client = clientRef.current();
        const rtmChannel = useChannel(client);

        // Set up channel event listeners
        const handleChannelMessage = (message: any, memberId: string) => {
          try {
            const signal: CallSignal = JSON.parse(message.text);
            handleCallSignal(signal, memberId);
          } catch (err) {
            console.error("Failed to parse channel message:", err);
          }
        };

        rtmChannel.on("ChannelMessage", handleChannelMessage);

        await rtmChannel.join();
        setChannel(channelName);

        // Store channel reference for cleanup
        channelRef.current = rtmChannel;
      }
    } catch (err) {
      console.error("Failed to join channel:", err);
      setError("Failed to join channel");
    }
  };

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
        <VideoCall appId={rtcAppId} />

        {/* Mobile-style End Call Button - Centered at bottom */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={handleEndCall}
            className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
          >
            <svg
              className="w-8 h-8 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.88-.2.2-.51.2-.71 0s-.2-.51 0-.71c.91-.91 1.96-1.68 3.13-2.25.39-.19.87-.19 1.26 0 .39.19.64.56.64.98v3.1c1.45-.47 3-.72 4.6-.72s3.15.25 4.6.72v-3.1c0-.42.25-.79.64-.98.39-.19.87-.19 1.26 0 1.17.57 2.22 1.34 3.13 2.25.2.2.2.51 0 .71s-.51.2-.71 0c-.79-.76-1.68-1.39-2.66-1.88-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Phone Call System</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Settings"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>

        {/* Connection Status */}
        <div className="mb-4 text-center">
          <div
            className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              isConnected
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Site Information Display */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          {siteSettings && (
            <div className="mb-2">
              <p className="text-sm text-blue-800">
                <strong>Site:</strong>{" "}
                {siteSettings.siteName || siteSettings.siteId}
              </p>
            </div>
          )}
          <p className="text-sm text-blue-800">
            <strong>Your ID:</strong>{" "}
            <span className="font-mono">{userId}</span>
          </p>
          <p className="text-sm text-blue-800">
            <strong>Target ID:</strong>{" "}
            <span className="font-mono">{targetUserId}</span>
          </p>
        </div>

        {/* Channel Status */}
        <div className="mb-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Channel:</strong>{" "}
            <span className="font-mono">{channel}</span>
            <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded">
              Auto-joined
            </span>
          </p>
        </div>

        {/* Call State Display */}
        {callState !== "IDLE" && (
          <div className="mb-4 p-4 bg-yellow-50 rounded-lg text-center">
            <p className="text-lg font-medium text-yellow-800">
              {callState === "CALLING" && "Calling..."}
              {callState === "RINGING" && "Incoming Call!"}
              {callState === "CONNECTED" && "Call Connected"}
              {callState === "ENDED" && "Call Ended"}
            </p>
          </div>
        )}

        {/* Incoming Call UI */}
        {callState === "RINGING" && currentCall && (
          <div className="mb-4 p-4 bg-green-50 rounded-lg text-center">
            <p className="text-lg font-medium text-green-800 mb-2">
              Incoming call from: {currentCall.from}
            </p>
            <p className="text-sm text-green-600 mb-4">
              Channel: {currentCall.channel}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleAcceptCall}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
              >
                Accept
              </button>
              <button
                onClick={handleDeclineCall}
                className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Outgoing Call UI */}
        {callState === "CALLING" && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-lg font-medium text-blue-800 mb-4">
              Calling {targetUserId}...
            </p>
            <button
              onClick={handleEndCall}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Make Call UI */}
        {callState === "IDLE" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target User ID
              </label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="Enter user ID to call"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleInitiateCall}
              disabled={!targetUserId || !channel || !isConnected}
              className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Make Call
            </button>
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-2">How to test:</h3>
          <ol className="text-sm text-gray-700 space-y-1">
            <li>1. Open this page in two browser tabs</li>
            <li>2. Note the User ID in each tab</li>
            <li>3. Both tabs will automatically join the same channel</li>
            <li>
              4. In one tab, enter the other tab's User ID and click "Make Call"
            </li>
            <li>5. In the other tab, click "Accept" when the call comes in</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
