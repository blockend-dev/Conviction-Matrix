// EIP-712 order signing for SoDEX — compatible with MetaMask / WalletConnect
// On testnet this is the full flow; on mainnet requires deposited balance

export interface OrderParams {
  market: string;
  side: "BUY" | "SELL";
  orderType: "LIMIT" | "MARKET";
  size: string;          // base asset amount as string (e.g. "0.05")
  price?: string;        // limit price as string, required for LIMIT orders
  clientOrderId?: string;
}

// EIP-712 domain and types — matches SoDEX spec
export const SODEX_DOMAIN = {
  name: "SoDEX",
  version: "1",
  chainId: 1,  // ValueChain mainnet; 11155111 for testnet
};

export const ORDER_TYPES = {
  Order: [
    { name: "market",    type: "string" },
    { name: "side",      type: "string" },
    { name: "orderType", type: "string" },
    { name: "size",      type: "string" },
    { name: "price",     type: "string" },
    { name: "nonce",     type: "uint256" },
    { name: "expiry",    type: "uint256" },
  ],
};

// Browser-side: calls eth_signTypedData_v4 via window.ethereum
export async function signOrderBrowser(params: OrderParams): Promise<string> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No wallet detected");
  }
  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  if (!accounts[0]) throw new Error("Wallet not connected");

  const nonce = Date.now();
  const expiry = Math.floor(Date.now() / 1000) + 3600;  // 1 hour

  const message = {
    market:    params.market,
    side:      params.side,
    orderType: params.orderType,
    size:      params.size,
    price:     params.price ?? "0",
    nonce,
    expiry,
  };

  const typedData = JSON.stringify({
    types:       { EIP712Domain: [ { name: "name", type: "string" }, { name: "version", type: "string" }, { name: "chainId", type: "uint256" } ], ...ORDER_TYPES },
    domain:      SODEX_DOMAIN,
    primaryType: "Order",
    message,
  });

  const signature = (await window.ethereum.request({
    method: "eth_signTypedData_v4",
    params: [accounts[0], typedData],
  })) as string;

  return signature;
}

// Submit signed order to SoDEX
export async function submitOrder(params: OrderParams, signature: string, sender: string): Promise<{ orderId: string }> {
  const nonce = Date.now();
  const expiry = Math.floor(Date.now() / 1000) + 3600;

  const body = { ...params, signature, sender, nonce, expiry };

  const res = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Order submission failed: ${res.status}`);
  return res.json();
}

// Add ethereum to Window type
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}
