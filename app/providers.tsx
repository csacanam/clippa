"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { celo, celoSepolia } from "viem/chains";

export function Providers({ children }: { children: React.ReactNode }) {
  const useTestnet = process.env.NEXT_PUBLIC_USE_TESTNET === "true";
  const defaultChain = useTestnet ? celoSepolia : celo;

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        // We don't support external wallets (Coinbase, MetaMask, WalletConnect,
        // etc.) — Clippa only uses Privy embedded wallets. This stops Privy
        // from loading those connectors and quiets the "Celo not supported by
        // Coinbase Smart Wallet" warning.
        externalWallets: { disableAllExternalWallets: true },
        defaultChain,
        supportedChains: [celo, celoSepolia],
        appearance: {
          theme: "light",
          accentColor: "#5B3FFF",
          logo: undefined,
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
