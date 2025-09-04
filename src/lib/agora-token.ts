"use server";

import { RtcTokenBuilder, RtcRole } from "agora-token";

export interface TokenRequest {
  channel: string;
  uid?: number;
  expirationTimeInSeconds?: number;
}

export interface TokenResponse {
  token: string;
  expiresAt: number;
}

export async function generateAgoraToken({
  channel,
  uid = 0,
  expirationTimeInSeconds = 3600, // 1 hour default
}: TokenRequest): Promise<TokenResponse> {
  try {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    console.log("Token generation debug:", {
      hasAppId: !!appId,
      hasCertificate: !!appCertificate,
      appIdLength: appId?.length,
      certificateLength: appCertificate?.length,
      channel,
      uid,
      expirationTimeInSeconds,
    });

    if (!appId || !appCertificate) {
      throw new Error(
        "Missing Agora App ID or App Certificate in environment variables"
      );
    }

    // Generate token with publisher role (can publish and subscribe)
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTime + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
      currentTime
    );

    const expiresAt = Math.floor(Date.now() / 1000) + expirationTimeInSeconds;

    console.log("Generated token:", {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + "...",
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    });

    return {
      token,
      expiresAt,
    };
  } catch (error) {
    console.error("Error generating Agora token:", error);
    throw new Error("Failed to generate token");
  }
}

// Alternative function for generating token with string UID
export async function generateAgoraTokenWithStringUid({
  channel,
  uid = "0",
  expirationTimeInSeconds = 3600,
}: {
  channel: string;
  uid?: string;
  expirationTimeInSeconds?: number;
}): Promise<TokenResponse> {
  try {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      throw new Error(
        "Missing Agora App ID or App Certificate in environment variables"
      );
    }

    // Generate token with string UID
    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTime + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs,
      currentTime
    );

    const expiresAt = Math.floor(Date.now() / 1000) + expirationTimeInSeconds;

    return {
      token,
      expiresAt,
    };
  } catch (error) {
    console.error("Error generating Agora token with string UID:", error);
    throw new Error("Failed to generate token");
  }
}

// Test function to verify token generation
export async function testTokenGeneration(): Promise<boolean> {
  try {
    const result = await generateAgoraToken({
      channel: "test-channel",
      uid: 12345,
      expirationTimeInSeconds: 3600,
    });

    console.log("Token generation test successful:", {
      hasToken: !!result.token,
      tokenLength: result.token.length,
      expiresAt: new Date(result.expiresAt * 1000).toISOString(),
    });

    return true;
  } catch (error) {
    console.error("Token generation test failed:", error);
    return false;
  }
}
