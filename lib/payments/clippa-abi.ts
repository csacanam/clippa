/**
 * Minimal ABI for the Clippa escrow contract — only the bits the
 * payment agent needs. Full source: contracts/src/Clippa.sol
 */
export const clippaAbi = [
  {
    type: "function",
    name: "recordPayout",
    stateMutability: "nonpayable",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "clipId", type: "bytes32" },
      { name: "payoutId", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getCampaign",
    stateMutability: "view",
    inputs: [{ name: "campaignId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "balance", type: "uint256" },
          { name: "totalFunded", type: "uint256" },
          { name: "totalPaidOut", type: "uint256" },
          { name: "maxPayoutPerClip", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "clipRemaining",
    stateMutability: "view",
    inputs: [
      { name: "campaignId", type: "bytes32" },
      { name: "clipId", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;
