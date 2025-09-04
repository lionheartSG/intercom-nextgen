"use client";

import VideoCall from "../components/VideoCall";

export default function Home() {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";
  const channel = process.env.NEXT_PUBLIC_AGORA_CHANNEL || "test-channel";

  return (
    <div className="min-h-screen bg-gray-100">
      <VideoCall appId={appId} channel={channel} />
    </div>
  );
}
