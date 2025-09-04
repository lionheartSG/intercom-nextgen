"use client";

import { useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ClientConfig,
  ConnectionState,
  IAgoraRTCRemoteUser,
} from "agora-rtc-sdk-ng";

interface VideoCallProps {
  appId: string;
  channel: string;
  token?: string;
}

export default function VideoCall({ appId, channel, token }: VideoCallProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("DISCONNECTED");

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoElementRef = useRef<HTMLDivElement>(null);
  const remoteVideoElementRef = useRef<HTMLDivElement>(null);

  // Initialize Agora client
  useEffect(() => {
    const config: ClientConfig = {
      mode: "rtc",
      codec: "vp8",
    };

    clientRef.current = AgoraRTC.createClient(config);

    // Listen to connection state changes
    clientRef.current.on(
      "connection-state-change",
      (curState: ConnectionState, revState: ConnectionState) => {
        console.log("Connection state changed:", revState, "->", curState);
        setConnectionState(curState);
      }
    );

    // Listen to user joined
    clientRef.current.on(
      "user-published",
      async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
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
      (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
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
  }, []);

  const joinChannel = async () => {
    if (!clientRef.current || !appId || !channel) {
      setError("Missing required parameters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Join the channel
      await clientRef.current.join(appId, channel, token || null);
      setIsJoined(true);

      // Create local tracks
      const [audioTrack, videoTrack] =
        await AgoraRTC.createMicrophoneAndCameraTracks();

      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      // Play local video
      if (localVideoElementRef.current) {
        videoTrack.play(localVideoElementRef.current);
      }

      // Publish tracks
      await clientRef.current.publish([audioTrack, videoTrack]);
      setIsPublished(true);
    } catch (err) {
      console.error("Error joining channel:", err);
      setError(err instanceof Error ? err.message : "Failed to join channel");
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
      setIsPublished(false);
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

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-center">Video Call</h2>

        {/* Status */}
        <div className="mb-4 text-center">
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

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">How to test:</h3>
          <ol className="text-sm text-blue-800 space-y-1">
            <li>
              1. Replace "your_app_id_here" in .env.local with your actual Agora
              App ID
            </li>
            <li>2. Open this page in two different browser tabs or devices</li>
            <li>3. Click "Join Channel" on both devices</li>
            <li>
              4. You should see each other's video and hear each other's audio
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
