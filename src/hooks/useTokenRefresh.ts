import { useEffect, useCallback } from "react";

interface UseTokenRefreshProps {
  isJoined: boolean;
  tokenExpiresAt: number | null;
  generateToken: () => Promise<void>;
}

export function useTokenRefresh({
  isJoined,
  tokenExpiresAt,
  generateToken,
}: UseTokenRefreshProps) {
  // Function to check if token is expired or about to expire
  const isTokenExpired = useCallback(() => {
    if (!tokenExpiresAt) return true;
    const now = Math.floor(Date.now() / 1000);
    return tokenExpiresAt - now < 300; // Consider expired if less than 5 minutes left
  }, [tokenExpiresAt]);

  // Token refresh mechanism
  useEffect(() => {
    if (!isJoined || !tokenExpiresAt) return;

    const checkTokenExpiry = () => {
      if (isTokenExpired()) {
        generateToken().catch(console.error);
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60000);

    return () => clearInterval(interval);
  }, [isJoined, tokenExpiresAt, isTokenExpired, generateToken]);

  return {
    isTokenExpired,
  };
}
