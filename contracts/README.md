# BlueLedger Polygon Amoy contract

`BlueLedgerRegistry.sol` is a standalone Solidity contract for the SIH testnet prototype.

- Network: Polygon Amoy
- Chain ID: `80002`
- Explorer: `https://amoy.polygonscan.com`
- Solidity: `0.8.24`

Deploy it with a verifier-controlled testnet wallet using Remix, Foundry, or another audited deployment workflow. Set the deployed address as `BLUELEDGER_CONTRACT_ADDRESS` in the application runtime.

The contract stores hashes and identifiers only. Documents, imagery, GeoJSON and generated reports remain in BlueRegistry storage.

The application can prepare and record Polygon Amoy transactions without claiming that a contract has been deployed. A production or public-credit deployment requires independent contract review, access-control review and method-specific carbon validation.
