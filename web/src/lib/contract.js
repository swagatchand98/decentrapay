import { ethers } from "ethers";
import artifact from "../../../shared/DecentraPay.json";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || artifact.address;
export const CONTRACT_ABI = artifact.abi;

export const AMOY_CHAIN_ID = 80002;
export const AMOY_CHAIN_ID_HEX = "0x13882";
export const EXPLORER_BASE = "https://amoy.polygonscan.com";

export function getReadProvider() {
  return new ethers.JsonRpcProvider(import.meta.env.VITE_AMOY_RPC);
}

const contractInterface = new ethers.Interface(CONTRACT_ABI);

// Custom Solidity errors (InsufficientBalance, FingerSlotTaken, etc.) come
// back from MetaMask as raw hex revert data, not a decoded name — MetaMask
// has no way to know our ABI, so it falls back to a generic message like
// "Internal JSON-RPC error" instead of naming the actual error. Wherever that
// hex data survived the round-trip, decode it ourselves against our own ABI.
//
// Separately, ethers' own "could not coalesce error" is *its* generic
// fallback when it can't pattern-match a JSON-RPC error into one of its
// specific typed errors. The real underlying error is still there, just not
// surfaced — depending on which internal path threw it, it ends up either
// spread directly onto the error (makeError does
// Object.assign(error, { error, payload })) or nested under .info (some
// paths set that explicitly), so check both.
export function describeError(err) {
  const rawData = err?.data || err?.info?.error?.data || err?.error?.data;
  if (typeof rawData === "string" && rawData.startsWith("0x") && rawData !== "0x") {
    try {
      const decoded = contractInterface.parseError(rawData);
      if (decoded) {
        const args = decoded.args.map((a) => (typeof a === "bigint" ? a.toString() : a)).join(", ");
        return `${decoded.name}(${args})`;
      }
    } catch {
      // Not one of our custom errors (or data too short/malformed) — fall through.
    }
  }

  const inner = err?.info?.error || err?.error;
  if (inner) {
    return inner.message || inner.reason || JSON.stringify(inner);
  }
  return err?.shortMessage || err?.reason || err?.message || String(err);
}

export function getReadContract() {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, getReadProvider());
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("No injected wallet found. Install MetaMask to continue.");
  }

  const browserProvider = new ethers.BrowserProvider(window.ethereum);
  await browserProvider.send("eth_requestAccounts", []);

  const network = await browserProvider.getNetwork();
  if (network.chainId !== BigInt(AMOY_CHAIN_ID)) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: AMOY_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: AMOY_CHAIN_ID_HEX,
              chainName: "Polygon Amoy Testnet",
              nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
              rpcUrls: [import.meta.env.VITE_AMOY_RPC],
              blockExplorerUrls: [EXPLORER_BASE],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }

  const signer = await browserProvider.getSigner();
  const writeContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return { signer, address: await signer.getAddress(), writeContract };
}
