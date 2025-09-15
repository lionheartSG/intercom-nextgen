"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import VideoCall from "./VideoCall";
import SettingsPage from "./SettingsPage";
import { Phone, XCircle, Settings } from "lucide-react";
import { useAgoraCall } from "../hooks/useAgoraCall";

interface PhoneCallUIProps {
  appId: string;
  rtcAppId: string;
}

export default function PhoneCallUI({ appId, rtcAppId }: PhoneCallUIProps) {
  const [settingsTapCount, setSettingsTapCount] = useState(0);
  const [showSettingsButton, setShowSettingsButton] = useState(false);
  const router = useRouter();

  // Use the Agora call logic hook
  const {
    callState,
    currentCall,
    error,
    targetUserIds,
    currentTargetUserId,
    channel,
    showVideoCall,
    isConnected,
    showSettings,
    siteSettings,
    isClient,
    rtmLoaded,
    handleInitiateCall,
    handleAcceptCall,
    handleDeclineCall,
    handleEndCall,
    handleSettingsSave,
    handleSettingsBack,
    setShowSettings,
  } = useAgoraCall({ appId, rtcAppId });

  // Magic settings button activation (UI-only logic)
  const handleMagicTap = useCallback(() => {
    const newCount = settingsTapCount + 1;
    setSettingsTapCount(newCount);

    if (newCount >= 10) {
      setShowSettingsButton(true);
      setSettingsTapCount(0); // Reset counter
    }
  }, [settingsTapCount]);

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
                <XCircle className="w-5 h-5 mr-2" />
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
                <Phone className="w-10 h-10 text-green-400" />
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
                <Phone className="w-10 h-10 text-blue-400" />
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
                          <Phone className="w-6 h-6" />
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
                  <Settings className="w-10 h-10 text-blue-200" />
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
