import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./dappkit.js";

const wallet = new ConnectWallet();

// Rocket Pool contract addresses on Ethereum Mainnet
const rETHContractAddress = "0xae78736cd615f374d3085123a210448e74fc6393";
const depositPoolAddress = "0xDD3f50F8A6CafbE9b31a427582963f465E745AF8";

// Deposit Pool ABI (for staking ETH)
const DEPOSIT_POOL_ABI = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

// rETH ABI
const rETH_ABI = [
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        name: "balance",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getTotalCollateral",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        name: "_rethAmount",
        type: "uint256",
      },
    ],
    name: "burn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const stakeBtn = document.getElementById("stake-btn");
const unstakeBtn = document.getElementById("unstake-btn");
const ethAmountInput = document.getElementById("eth-amount");
const rethAmountInput = document.getElementById("reth-amount");
const ethBalanceEl = document.getElementById("eth-balance");
const rethBalanceDisplayEl = document.getElementById("reth-balance-display");
const protocolLiquidityEl = document.getElementById("protocol-liquidity");

let protocolLiquidity = "0";

async function updateETHBalance() {
  try {
    const provider = wallet.getEthersProvider();
    const account = await wallet.getAccount();

    if (!provider || !account) {
      ethBalanceEl.innerHTML =
        'Balance: <span style="color: var(--orange)">0.00</span> ETH';
      return;
    }

    const balance = await provider.getBalance(account);
    const formattedBalance = ethers.formatEther(balance);
    const displayAmount = parseFloat(formattedBalance).toFixed(4);
    ethBalanceEl.innerHTML = `Balance: <span style="color: var(--orange)">${displayAmount}</span> ETH`;
  } catch (error) {
    console.error("Failed to update ETH balance:", error);
    ethBalanceEl.innerHTML =
      'Balance: <span style="color: var(--orange)">0.00</span> ETH';
  }
}

async function updateRETHBalance() {
  try {
    const provider = wallet.getEthersProvider();
    const account = await wallet.getAccount();

    if (!provider || !account) {
      rethBalanceDisplayEl.innerHTML =
        'Balance: <span style="color: var(--orange)">0.00</span> rETH';
      return;
    }

    const rEthContract = new ethers.Contract(
      rETHContractAddress,
      rETH_ABI,
      provider,
    );
    const balance = await rEthContract.balanceOf(account);
    const formattedBalance = ethers.formatEther(balance);
    const displayAmount = parseFloat(formattedBalance).toFixed(4);
    rethBalanceDisplayEl.innerHTML = `Balance: <span style="color: var(--orange)">${displayAmount}</span> rETH`;
  } catch (error) {
    console.error("Failed to update rETH balance:", error);
    rethBalanceDisplayEl.innerHTML =
      'Balance: <span style="color: var(--orange)">0.00</span> rETH';
  }
}

async function updateProtocolLiquidity() {
  try {
    const rpcUrl = getRpcUrl("ethereum");
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const rEthContract = new ethers.Contract(
      rETHContractAddress,
      rETH_ABI,
      provider,
    );
    const liquidity = await rEthContract.getTotalCollateral();
    protocolLiquidity = liquidity.toString();

    const formattedLiquidity = ethers.formatEther(liquidity);
    const displayAmount = parseFloat(formattedLiquidity).toFixed(2);
    protocolLiquidityEl.innerHTML = `<span style="color: var(--orange)">${displayAmount}</span> ETH`;

    updateUnstakeButtonState();
  } catch (error) {
    console.error("Failed to update protocol liquidity:", error);
    protocolLiquidityEl.innerHTML =
      '<span style="color: var(--orange)">0.00</span>';
  }
}

function updateUnstakeButtonState() {
  const unstakeAmount = rethAmountInput.value;

  if (!unstakeAmount || parseFloat(unstakeAmount) <= 0) {
    unstakeBtn.disabled = false;
    return;
  }

  try {
    const unstakeWei = ethers.parseEther(unstakeAmount);
    const liquidityBN = BigInt(protocolLiquidity);

    if (liquidityBN === 0n || unstakeWei > liquidityBN) {
      unstakeBtn.disabled = true;
    } else {
      unstakeBtn.disabled = false;
    }
  } catch (error) {
    unstakeBtn.disabled = false;
  }
}

async function stakeETH() {
  const provider = wallet.getEthersProvider();
  if (!provider) {
    Notification.show("Please connect your wallet first", "warning");
    return;
  }

  const amount = ethAmountInput.value;
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    Notification.show(
      "Please enter a valid amount of ETH to stake.",
      "warning",
    );
    return;
  }

  try {
    const signer = await provider.getSigner();
    const depositPoolContract = new ethers.Contract(
      depositPoolAddress,
      DEPOSIT_POOL_ABI,
      signer,
    );

    const tx = await depositPoolContract.deposit({
      value: ethers.parseEther(amount),
    });

    Notification.track(tx, {
      label: `Staking ${amount} ETH`,
      onSuccess: () => {
        updateETHBalance();
        updateRETHBalance();
        updateProtocolLiquidity();
      },
    });
  } catch (error) {
    console.error("Stake error:", error);
    Notification.show("Transaction failed: " + error.message, "danger");
  }
}

async function unstakeRETH() {
  const provider = wallet.getEthersProvider();
  if (!provider) {
    Notification.show("Please connect your wallet first", "warning");
    return;
  }

  const amount = rethAmountInput.value;
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    Notification.show(
      "Please enter a valid amount of rETH to unstake.",
      "warning",
    );
    return;
  }

  const amountInWei = ethers.parseEther(amount);
  const liquidityBN = BigInt(protocolLiquidity);

  if (amountInWei > liquidityBN) {
    Notification.show(
      "Not enough liquidity to unstake that amount.",
      "warning",
    );
    return;
  }

  try {
    const signer = await provider.getSigner();
    const rEthContract = new ethers.Contract(
      rETHContractAddress,
      rETH_ABI,
      signer,
    );

    const tx = await rEthContract.burn(amountInWei);

    Notification.track(tx, {
      label: `Unstaking ${amount} rETH`,
      onSuccess: () => {
        updateETHBalance();
        updateRETHBalance();
        updateProtocolLiquidity();
      },
    });
  } catch (error) {
    console.error("Unstake error:", error);
    Notification.show("Transaction failed: " + error.message, "danger");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  wallet.onConnect(async (data) => {
    const account = data.accounts[0];
    const shortAccount = `${account.slice(0, 6)}...${account.slice(-4)}`;
    Notification.show(
      `Connected to ${wallet.getLastWallet()} with account ${shortAccount}`,
      "success",
    );

    await updateETHBalance();
    await updateRETHBalance();
    await updateProtocolLiquidity();
  });

  wallet.onDisconnect(() => {
    Notification.show("Wallet disconnected", "warning");
    ethBalanceEl.innerHTML =
      'Balance: <span style="color: var(--orange)">0.00</span> ETH';
    rethBalanceDisplayEl.innerHTML =
      'Balance: <span style="color: var(--orange)">0.00</span> rETH';
    protocolLiquidityEl.textContent = "0.0";
    unstakeBtn.disabled = true;
  });

  wallet.onChainChange(async ({ name, allowed }) => {
    if (!allowed) {
      Notification.show(
        `Please switch to a supported network. Chain is not supported.`,
        "danger",
        { duration: 0 },
      );
      return;
    }
    Notification.show(`Switched to ${name}`, "info");

    await updateETHBalance();
    await updateRETHBalance();
    await updateProtocolLiquidity();
  });

  stakeBtn.addEventListener("click", stakeETH);
  unstakeBtn.addEventListener("click", unstakeRETH);
  rethAmountInput.addEventListener("input", updateUnstakeButtonState);

  updateProtocolLiquidity();
});
