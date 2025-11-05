import React, { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { NeynarProvider, useNeynarContext, useSignInWithNeynar } from "@neynar/react";
import { ethers } from "ethers";

function XmasApp() {
  const { user } = useNeynarContext();
  const { signIn, isLoading } = useSignInWithNeynar();

  const [pfpUrl, setPfpUrl] = useState(null);
  const [aiImage, setAiImage] = useState(null);
  const [address, setAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    sdk.actions.ready().catch(console.error);
  }, []);

  useEffect(() => {
    if (user?.pfp_url) setPfpUrl(user.pfp_url);
  }, [user]);

  // ✅ Native wallet connection inside Farcaster
  async function connectWallet() {
    try {
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) {
        alert("⚠️ Please open this inside the Farcaster app.");
        return;
      }

      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const addr = await signer.getAddress();
      const bal = await ethersProvider.getBalance(addr);

      setAddress(addr);
      setBalance(parseFloat(ethers.formatEther(bal)).toFixed(4));
    } catch (err) {
      console.error("Wallet connection failed:", err);
    }
  }

  // 🎁 Generate Christmas AI Portrait
  async function generateChristmasAI() {
    if (!pfpUrl) return alert("No profile photo found!");
    setLoadingAI(true);

    try {
      const res = await fetch("/api/generate-christmas", {
        method: "POST",
        body: JSON.stringify({ pfpUrl, username: user.username }),
      });
      const data = await res.json();
      setAiImage(data.image);
    } catch (e) {
      console.error(e);
      alert("Generation failed!");
    } finally {
      setLoadingAI(false);
    }
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <h1>🎄 Farcaster Christmas Portrait</h1>
        <p>Sign in with your Farcaster profile to start</p>
        <button onClick={signIn} disabled={isLoading} className="btn">
          {isLoading ? "Loading..." : "Sign in with Farcaster"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 text-center">
      <h2>Welcome, @{user.username}</h2>
      <img
        src={pfpUrl}
        alt="pfp"
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          border: "3px solid #c62828",
        }}
      />

      {/* 🪙 Wallet */}
      {!address ? (
        <button onClick={connectWallet} className="btn mt-4">
          💫 Connect Wallet
        </button>
      ) : (
        <div className="mt-4">
          <p>Wallet: <code>{address}</code></p>
          <p>Balance: {balance} ETH</p>
        </div>
      )}

      {/* 🎨 Generate AI Portrait */}
      <div className="mt-6">
        <button onClick={generateChristmasAI} disabled={loadingAI} className="btn">
          {loadingAI ? "✨ Generating..." : "🎁 Generate Christmas Portrait"}
        </button>
      </div>

      {aiImage && (
        <div className="mt-6">
          <h3>Your AI Christmas Portrait</h3>
          <img
            src={aiImage}
            alt="Christmas Portrait"
            style={{
              width: 256,
              borderRadius: 16,
              boxShadow: "0 0 12px rgba(0,0,0,0.3)",
            }}
          />
          <div className="mt-3">
            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = aiImage;
                a.download = "farcaster-xmas.png";
                a.click();
              }}
              className="btn"
            >
              ⬇️ Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ Wrap in Neynar Provider
export default function AppWrapper() {
  return (
    <NeynarProvider
      config={{
        clientId: process.env.NEYNAR_CLIENT_ID,
        environment: "production",
      }}
    >
      <XmasApp />
    </NeynarProvider>
  );
}
