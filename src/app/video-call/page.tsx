"use client";

import VideoCall from "../../components/VideoCall";

export default function VideoCallPage() {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";
  const token = process.env.NEXT_PUBLIC_AGORA_TOKEN || undefined;

  return (
    <div className="min-h-screen bg-gray-100">
      <VideoCall appId={appId} token={token} />
    </div>
  );
}
