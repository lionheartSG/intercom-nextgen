"use client";

import { useState } from "react";
import { testTokenGeneration, generateAgoraToken } from "../../lib/agora-token";

export default function TestTokenPage() {
  const [testResult, setTestResult] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async () => {
    setIsLoading(true);
    setTestResult("Running token generation test...\n");

    try {
      const success = await testTokenGeneration();
      setTestResult(
        (prev) => prev + `\nTest result: ${success ? "SUCCESS" : "FAILED"}`
      );

      if (success) {
        // Test with actual channel
        const tokenResult = await generateAgoraToken({
          channel: "test-channel",
          uid: Math.floor(Math.random() * 1000000),
          expirationTimeInSeconds: 3600,
        });

        setTestResult(
          (prev) =>
            prev +
            `\n\nGenerated token for test-channel:\nLength: ${
              tokenResult.token.length
            }\nExpires: ${new Date(
              tokenResult.expiresAt * 1000
            ).toISOString()}\nToken preview: ${tokenResult.token.substring(
              0,
              50
            )}...`
        );
      }
    } catch (error) {
      setTestResult(
        (prev) =>
          prev +
          `\n\nError: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Token Generation Test</h1>

        <button
          onClick={runTest}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? "Testing..." : "Test Token Generation"}
        </button>

        {testResult && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg">
            <h3 className="font-bold mb-2">Test Results:</h3>
            <pre className="whitespace-pre-wrap text-sm">{testResult}</pre>
          </div>
        )}

        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-bold text-yellow-800 mb-2">Debug Steps:</h3>
          <ol className="text-sm text-yellow-700 space-y-1">
            <li>1. Click "Test Token Generation" above</li>
            <li>2. Check the browser console for detailed logs</li>
            <li>3. Check the server console for token generation logs</li>
            <li>4. Verify your App ID and Certificate are correct</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
