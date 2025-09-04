"use client";

import { useState, useEffect } from "react";

interface SiteSettings {
  siteId: string;
  channel: string;
  userId: string;
  targetUserId: string;
  siteName: string;
}

interface SettingsPageProps {
  onSettingsSave: (settings: SiteSettings) => void;
  onBack: () => void;
  currentSettings?: SiteSettings;
}

export default function SettingsPage({
  onSettingsSave,
  onBack,
  currentSettings,
}: SettingsPageProps) {
  const [settings, setSettings] = useState<SiteSettings>({
    siteId: "",
    channel: "",
    userId: "",
    targetUserId: "",
    siteName: "",
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("dragnet-site-settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      } catch (error) {
        console.error("Failed to parse saved settings:", error);
      }
    } else if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  const handleInputChange = (field: keyof SiteSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    // Validate required fields
    if (
      !settings.siteId ||
      !settings.channel ||
      !settings.userId ||
      !settings.targetUserId
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Save to localStorage
    localStorage.setItem("dragnet-site-settings", JSON.stringify(settings));

    // Notify parent component
    onSettingsSave(settings);
  };

  const generateChannelName = () => {
    if (settings.siteId) {
      handleInputChange("channel", `dragnet-site-${settings.siteId}`);
    }
  };

  const generateUserIds = () => {
    if (settings.siteId) {
      handleInputChange("userId", `${settings.siteId}-tablet-a`);
      handleInputChange("targetUserId", `${settings.siteId}-tablet-b`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            className="mr-4 p-2 hover:bg-gray-100 rounded-lg"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-bold">Site Configuration</h1>
        </div>

        <div className="space-y-6">
          {/* Site Information */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-3">Site Information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site Name
                </label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) =>
                    handleInputChange("siteName", e.target.value)
                  }
                  placeholder="e.g., Main Entrance, Security Office"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Site ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.siteId}
                  onChange={(e) => handleInputChange("siteId", e.target.value)}
                  placeholder="e.g., 1, 2, 3, main, north"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Unique identifier for this site
                </p>
              </div>
            </div>
          </div>

          {/* Channel Configuration */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-medium text-green-900 mb-3">
              Channel Configuration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RTM/RTC Channel <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.channel}
                    onChange={(e) =>
                      handleInputChange("channel", e.target.value)
                    }
                    placeholder="e.g., dragnet-site-1"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={generateChannelName}
                    className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                  >
                    Auto
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  All tablets at this site must use the same channel
                </p>
              </div>
            </div>
          </div>

          {/* User Configuration */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-medium text-purple-900 mb-3">
              Tablet Configuration
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  This Tablet ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.userId}
                  onChange={(e) => handleInputChange("userId", e.target.value)}
                  placeholder="e.g., site1-tablet-a"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Tablet ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.targetUserId}
                  onChange={(e) =>
                    handleInputChange("targetUserId", e.target.value)
                  }
                  placeholder="e.g., site1-tablet-b"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={generateUserIds}
                className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
              >
                Generate Tablet IDs
              </button>
              <p className="text-xs text-gray-500">
                Each tablet pair needs unique IDs. The other tablet should have
                the opposite configuration.
              </p>
            </div>
          </div>

          {/* Quick Setup Examples */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-3">
              Quick Setup Examples
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Site 1 - Tablet A:</span>
                <button
                  onClick={() => {
                    setSettings({
                      siteId: "1",
                      channel: "dragnet-site-1",
                      userId: "site1-tablet-a",
                      targetUserId: "site1-tablet-b",
                      siteName: "Main Entrance",
                    });
                  }}
                  className="text-blue-500 hover:text-blue-700"
                >
                  Apply
                </button>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Site 1 - Tablet B:</span>
                <button
                  onClick={() => {
                    setSettings({
                      siteId: "1",
                      channel: "dragnet-site-1",
                      userId: "site1-tablet-b",
                      targetUserId: "site1-tablet-a",
                      siteName: "Main Entrance",
                    });
                  }}
                  className="text-blue-500 hover:text-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
