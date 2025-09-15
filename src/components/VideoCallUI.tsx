"use client";

import { Mic, MicOff, Video, VideoOff, Phone } from "lucide-react";

interface VideoCallUIProps {
  // Loading state
  isClient: boolean;
  agoraLoaded: boolean;

  // Call state
  isJoined: boolean;
  isLoading: boolean;
  error: string | null;

  // Video elements refs
  localVideoElementRef: React.RefObject<HTMLDivElement | null>;
  remoteVideoElementRef: React.RefObject<HTMLDivElement | null>;
  remoteAudioElementRef: React.RefObject<HTMLAudioElement | null>;

  // Control states
  isMuted: boolean;
  isVideoOff: boolean;

  // Event handlers
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export default function VideoCallUI({
  isClient,
  agoraLoaded,
  isJoined,
  isLoading,
  error,
  localVideoElementRef,
  remoteVideoElementRef,
  remoteAudioElementRef,
  isMuted,
  isVideoOff,
  onToggleMute,
  onToggleVideo,
  onEndCall,
}: VideoCallUIProps) {
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
        {/* Error Display */}
        {error && (
          <div className="absolute top-4 left-4 right-4 z-50 p-4 bg-red-500/90 backdrop-blur-sm border border-red-400 text-red-100 rounded-xl">
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

          {/* Remote Audio - Hidden audio element for remote audio */}
          <audio
            ref={remoteAudioElementRef}
            autoPlay
            playsInline
            style={{ display: "none" }}
          />

          {/* Local Video - Picture in Picture */}
          <div className="absolute top-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden border-2 border-white">
            <div ref={localVideoElementRef} className="w-full h-full"></div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          {!isJoined ? (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mb-4"></div>
              <p className="text-lg text-white font-light">
                {isLoading
                  ? "Joining video channel..."
                  : "Preparing video call..."}
              </p>
            </div>
          ) : (
            <div className="flex items-center space-x-6">
              {/* Mute Button */}
              <button
                onClick={onToggleMute}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                  !isMuted
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {!isMuted ? (
                  <Mic className="w-6 h-6 text-white" />
                ) : (
                  <MicOff className="w-6 h-6 text-white" />
                )}
              </button>

              {/* End Call Button */}
              <button
                onClick={onEndCall}
                className="w-16 h-16 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg"
              >
                <Phone className="w-6 h-6 text-white" />
              </button>

              {/* Video Toggle Button */}
              <button
                onClick={onToggleVideo}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg ${
                  !isVideoOff
                    ? "bg-gray-700 hover:bg-gray-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {!isVideoOff ? (
                  <Video className="w-6 h-6 text-white" />
                ) : (
                  <VideoOff className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
