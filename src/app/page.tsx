"use client";

import PhoneCallUI from "../components/PhoneCallUI";

export default function Home() {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || "";

  return <PhoneCallUI appId={appId} rtcAppId={appId} />;
}
