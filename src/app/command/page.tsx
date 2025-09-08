"use client";

import CommandDashboard from "../../components/CommandDashboard";

export default function CommandPage() {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

  return <CommandDashboard appId={appId} rtcAppId={appId} />;
}
