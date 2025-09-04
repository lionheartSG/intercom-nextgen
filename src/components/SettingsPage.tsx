"use client";

import { useState, useEffect } from "react";

interface SiteSettings {
  channel: string;
  targetUserIds: string[];
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
    channel: "",
    targetUserIds: [],
    siteName: "",
  });

  // Generate random 8-digit code
  const generateRandomSiteCode = () => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  };

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem("dragnet-site-settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Ensure targetUserIds is always an array
        setSettings({
          ...parsed,
          targetUserIds: parsed.targetUserIds || [],
        });
      } catch (error) {
        console.error("Failed to parse saved settings:", error);
        // If parsing fails, generate new settings with random code
        setSettings({
          channel: "",
          targetUserIds: [],
          siteName: generateRandomSiteCode(),
        });
      }
    } else if (currentSettings) {
      setSettings({
        ...currentSettings,
        targetUserIds: currentSettings.targetUserIds || [],
      });
    } else {
      // No saved settings and no current settings, generate new with random code
      setSettings({
        channel: "",
        targetUserIds: [],
        siteName: generateRandomSiteCode(),
      });
    }
  }, [currentSettings]);

  const handleInputChange = (field: keyof SiteSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const addTargetUserId = () => {
    setSettings((prev) => ({
      ...prev,
      targetUserIds: [...prev.targetUserIds, ""],
    }));
  };

  const updateTargetUserId = (index: number, value: string) => {
    setSettings((prev) => ({
      ...prev,
      targetUserIds: prev.targetUserIds.map((id, i) =>
        i === index ? value : id
      ),
    }));
  };

  const removeTargetUserId = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      targetUserIds: prev.targetUserIds.filter((_, i) => i !== index),
    }));
  };

  const handleSave = () => {
    // Validate required fields
    if (
      !settings.channel ||
      !settings.siteName ||
      !settings.targetUserIds ||
      settings.targetUserIds.length === 0
    ) {
      alert("Please fill in all required fields");
      return;
    }

    // Save to localStorage
    localStorage.setItem("dragnet-site-settings", JSON.stringify(settings));

    // Notify parent component
    onSettingsSave(settings);
  };

  return (
    <div
      className="min-h-screen bg-gray-100 flex items-center justify-center p-4"
      style={{ colorScheme: "light" }}
    >
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
          <h1 className="text-2xl font-bold text-gray-900">
            Site Configuration
          </h1>
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
                  placeholder="e.g., BCA-FCC, BCA-Lobby, Main Entrance (auto-generated if empty)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                />
                <p className="text-xs text-gray-600 mt-1">
                  This will be used as your tablet ID. Change to your preferred
                  site name.
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
                <input
                  type="text"
                  value={settings.channel}
                  onChange={(e) => handleInputChange("channel", e.target.value)}
                  placeholder="e.g., dragnet-bca-fcc, dragnet-main-entrance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                />
                <p className="text-xs text-gray-600 mt-1">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Tablet IDs <span className="text-red-500">*</span>
                </label>
                {(settings.targetUserIds || []).map((targetId, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={targetId}
                      onChange={(e) =>
                        updateTargetUserId(index, e.target.value)
                      }
                      placeholder="e.g., BCA-Lobby, BCA-FCC, BCA-Office"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900"
                    />
                    <button
                      onClick={() => removeTargetUserId(index)}
                      className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                      title="Remove"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addTargetUserId}
                  className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                >
                  + Add Target Tablet
                </button>
              </div>
              <p className="text-xs text-gray-600">
                This tablet will use the site name as its ID. Add all the
                tablets you want to be able to call.
              </p>
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
