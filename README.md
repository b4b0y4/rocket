# Rocket

A minimal web interface for staking and unstaking ETH with [Rocket Pool](https://rocketpool.net/).

## Features

- **Connect Wallet**: Link your Web3 wallet (MetaMask, WalletConnect, etc.)
- **Stake ETH**: Deposit ETH to receive rETH
- **Unstake rETH**: Burn rETH to redeem ETH (liquidity permitting)
- **Real-time Balances**: View ETH and rETH holdings
- **Protocol Liquidity**: Monitor available unstaking liquidity
- **Dark/Light Theme**: Toggle between light and dark modes
- **Custom RPC**: Configure custom RPC endpoints

## Getting Started

1. Open `index.html` in a web browser
2. Click "Connect" to link your wallet
3. Enter an amount and click "Stake" to deposit ETH
4. Enter an amount and click "Unstake" to redeem rETH

## How It Works

- **Staking**: Calls the Rocket Pool deposit pool contract to convert ETH to rETH
- **Unstaking**: Burns rETH through the rETH contract to claim ETH
- **Liquidity Check**: Displays available protocol liquidity to validate unstaking requests

## Technologies

- Ethers.js for blockchain interactions
- Web3 wallet integration via EIP-6963
- Responsive CSS with theme support
- Minimal dependencies

## Notes

- Runs on Ethereum Mainnet only
- Requires a connected Web3 wallet
- Custom RPC endpoints can be configured via the settings button