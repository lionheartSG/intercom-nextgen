"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { OnlineUser, SiteSettings } from "@/types/command";
import type { RtmClient, RtmChannel } from "agora-rtm-react";
import { generateRtmToken } from "@/lib/agora-token";

export default function CommandPage() {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";
  const router = useRouter();
  const [channel, setChannel] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [rtmLoaded, setRtmLoaded] = useState(false);

  const clientRef = useRef<(() => RtmClient) | null>(null);
  const channelRef = useRef<RtmChannel | null>(null);

  // Update user presence
  const updateUserPresence = useCallback(
    (userId: string, isOnline: boolean = true) => {
      setOnlineUsers((prev) => {
        const existing = prev.find((user) => user.userId === userId);
        if (existing) {
          return prev.map((user) =>
            user.userId === userId
              ? { ...user, lastSeen: Date.now(), isOnline }
              : user
          );
        } else {
          return [...prev, { userId, lastSeen: Date.now(), isOnline }];
        }
      });
    },
    []
  );

  // Error handling
  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    console.error(defaultMessage, error);
    const errorMessage =
      error instanceof Error ? error.message : defaultMessage;
    setError(errorMessage);
  }, []);

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

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load RTM dynamically
  useEffect(() => {
    if (!isClient || !appId) return;

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

  // Event handlers for RTM client
  const handleConnectionStateChange = useCallback((newState: string) => {
    setIsConnected(newState === "CONNECTED");
  }, []);

  const handleChannelMessage = useCallback((message: any) => {
    try {
      const data = JSON.parse(message.text);

      // Handle heartbeat messages
      if (data.type === "heartbeat") {
        updateUserPresence(data.userId, true);
      }
    } catch (err) {
      handleError(err, "Failed to parse channel message");
    }
  }, [updateUserPresence, handleError]);

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
        rtmChannel.on("ChannelMessage", handleChannelMessage);
        await rtmChannel.join();
        setChannel(channelName);

        // Store channel reference for cleanup
        channelRef.current = rtmChannel;
      } catch (err) {
        handleError(err, "Failed to join channel");
      }
    },
    [handleChannelMessage, handleError]
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
        handleError(
          err,
          `Failed to connect to messaging service: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    };

    initializeRtm();

    return () => {
      const client = clientRef.current?.();
      if (client) {
        client.off("ConnectionStateChanged", handleConnectionStateChange);
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
    handleJoinChannel,
  ]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("dragnet-site-settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSiteSettings(parsed);
        setUserId(parsed.siteName); // Use site name as user ID
        setChannel(parsed.channel);
      } catch (error) {
        console.error("Failed to parse saved settings:", error);
      }
    }
  }, []);

  // Cleanup offline users
  const cleanupOfflineUsers = useCallback(() => {
    const now = Date.now();
    const OFFLINE_THRESHOLD = 30000; // 30 seconds

    setOnlineUsers((prev) =>
      prev.map((user) => ({
        ...user,
        isOnline: user.isOnline && now - user.lastSeen < OFFLINE_THRESHOLD,
      }))
    );
  }, []);

  // Cleanup offline users timer
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      cleanupOfflineUsers();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(cleanupInterval);
  }, [cleanupOfflineUsers]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Command Dashboard</h1>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Back
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Channel Status */}
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-blue-900 mb-4">
              Channel Status
            </h3>
            <div className="space-y-2">
              <p>
                <span className="font-medium">Channel:</span> {channel}
              </p>
              <p>
                <span className="font-medium">Connection:</span>
                <span
                  className={`ml-2 px-2 py-1 rounded text-sm ${
                    isConnected
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </p>
              <p>
                <span className="font-medium">Current User:</span> {userId}
              </p>
            </div>
          </div>

          {/* Online Tablets */}
          <div className="bg-green-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-green-900 mb-4">
              Online Tablets ({onlineUsers.filter((user) => user.isOnline).length})
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {onlineUsers.length === 0 ? (
                <p className="text-gray-600">No tablets detected yet...</p>
              ) : (
                onlineUsers.map((user) => (
                  <div
                    key={user.userId}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      user.isOnline ? "bg-green-100" : "bg-gray-100"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{user.userId}</p>
                      <p className="text-sm text-gray-600">
                        Last seen: {new Date(user.lastSeen).toLocaleTimeString()}
                      </p>
                    </div>
                    <div
                      className={`w-3 h-3 rounded-full ${
                        user.isOnline ? "bg-green-500" : "bg-gray-400"
                      }`}
                    ></div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Target Tablets Configuration */}
        {siteSettings?.targetUserIds && siteSettings.targetUserIds.length > 0 && (
          <div className="mt-6 bg-yellow-50 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-yellow-900 mb-4">
              Configured Target Tablets
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {siteSettings.targetUserIds.map((targetId) => {
                const isOnline =
                  onlineUsers.find((user) => user.userId === targetId)?.isOnline ||
                  false;
                const customText = siteSettings.customButtonTexts?.[targetId];
                return (
                  <div
                    key={targetId}
                    className={`p-4 rounded-lg border-2 ${
                      isOnline
                        ? "border-green-300 bg-green-50"
                        : "border-gray-300 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{targetId}</h4>
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isOnline ? "bg-green-500" : "bg-gray-400"
                        }`}
                      ></div>
                    </div>
                    {customText && (
                      <p className="text-sm text-gray-600">
                        Button: "{customText}"
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Status: {isOnline ? "Online" : "Offline"}
                    </p>
                  </div>
                )}
              )}
            </div>
          </div>
        )}

        {/* Refresh Info */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            Dashboard updates every 5 seconds. Tablets send heartbeat every 10
            seconds.
          </p>
          <p>
            Tablets are considered offline if no heartbeat received for 30 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}