import { ethers } from "./libs/ethers.min.js";
import { ConnectWallet, Notification, getRpcUrl } from "./libs/dappkit.js";

// ============================================================
// CONFIGURATION
// ============================================================

const rETHContractAddress = "0xae78736cd615f374d3085123a210448e74fc6393";
const depositPoolAddress = "0xCE15294273CFb9D9b628F4D61636623decDF4fdC";

const DEPOSIT_POOL_ABI = [
  {
    inputs: [],
    name: "deposit",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

const rETH_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "getTotalCollateral",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "_rethAmount", type: "uint256" }],
    name: "burn",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ============================================================
// UI MANAGER
// ============================================================

class UIManager {
  constructor() {
    this.elements = {
      ethBalance: document.getElementById("eth-balance"),
      rethBalanceDisplay: document.getElementById("reth-balance-display"),
      protocolLiquidity: document.getElementById("protocol-liquidity"),
      ethAmountInput: document.getElementById("eth-amount"),
      rethAmountInput: document.getElementById("reth-amount"),
      stakeBtn: document.getElementById("stake-btn"),
      unstakeBtn: document.getElementById("unstake-btn"),
      rethMaxBtn: document.getElementById("reth-max-btn"),
    };
  }

  setETHBalance(value) {
    this.elements.ethBalance.innerHTML = `Balance: <span style="color: var(--orange)">${value}</span> ETH`;
  }

  setRETHBalance(value) {
    this.elements.rethBalanceDisplay.innerHTML = `Balance: <span style="color: var(--orange)">${value}</span> rETH`;
  }

  setProtocolLiquidity(value) {
    this.elements.protocolLiquidity.innerHTML = `<span style="color: var(--orange)">${value}</span> ETH`;
  }

  setUnstakeDisabled(disabled) {
    this.elements.unstakeBtn.disabled = disabled;
  }

  resetToDisconnected() {
    this.setETHBalance("0.00");
    this.setRETHBalance("0.00");
    this.elements.protocolLiquidity.textContent = "0.0";
    this.setUnstakeDisabled(true);
  }
}

// ============================================================
// CONTRACT MANAGER
// ============================================================

class ContractManager {
  constructor(wallet) {
    this.wallet = wallet;
    this.rethBalance = "0";
    this.protocolLiquidity = "0";
  }

  async updateETHBalance(ui) {
    try {
      const provider = this.wallet.getEthersProvider();
      const account = await this.wallet.getAccount();
      if (!provider || !account) {
        ui.setETHBalance("0.00");
        return;
      }

      const balance = await provider.getBalance(account);
      ui.setETHBalance(parseFloat(ethers.formatEther(balance)).toFixed(4));
    } catch (error) {
      console.error("Failed to update ETH balance:", error);
      ui.setETHBalance("0.00");
    }
  }

  async updateRETHBalance(ui) {
    try {
      const provider = this.wallet.getEthersProvider();
      const account = await this.wallet.getAccount();
      if (!provider || !account) {
        ui.setRETHBalance("0.00");
        this.rethBalance = "0";
        return;
      }

      const rEthContract = new ethers.Contract(
        rETHContractAddress,
        rETH_ABI,
        provider,
      );
      const balance = await rEthContract.balanceOf(account);
      this.rethBalance = ethers.formatEther(balance);
      ui.setRETHBalance(parseFloat(this.rethBalance).toFixed(4));
    } catch (error) {
      console.error("Failed to update rETH balance:", error);
      ui.setRETHBalance("0.00");
      this.rethBalance = "0";
    }
  }

  async updateProtocolLiquidity(ui) {
    try {
      const provider = new ethers.JsonRpcProvider(getRpcUrl("ethereum"));
      const rEthContract = new ethers.Contract(
        rETHContractAddress,
        rETH_ABI,
        provider,
      );
      const liquidity = await rEthContract.getTotalCollateral();
      this.protocolLiquidity = liquidity.toString();
      ui.setProtocolLiquidity(
        parseFloat(ethers.formatEther(liquidity)).toFixed(2),
      );
    } catch (error) {
      console.error("Failed to update protocol liquidity:", error);
      ui.setProtocolLiquidity("0.00");
    }
  }

  async updateAllBalances(ui) {
    await Promise.all([
      this.updateETHBalance(ui),
      this.updateRETHBalance(ui),
      this.updateProtocolLiquidity(ui),
    ]);
    this.syncUnstakeButton(ui);
  }

  syncUnstakeButton(ui) {
    const amount = ui.elements.rethAmountInput.value;
    if (!amount || parseFloat(amount) <= 0) {
      ui.setUnstakeDisabled(false);
      return;
    }
    try {
      const unstakeWei = ethers.parseEther(amount);
      const liquidityBN = BigInt(this.protocolLiquidity);
      ui.setUnstakeDisabled(liquidityBN === 0n || unstakeWei > liquidityBN);
    } catch {
      ui.setUnstakeDisabled(false);
    }
  }

  async executeStake(amount, ui) {
    const provider = this.wallet.getEthersProvider();
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
      onSuccess: () => this.updateAllBalances(ui),
    });
  }

  async executeUnstake(amount, ui) {
    const amountInWei = ethers.parseEther(amount);
    if (amountInWei > BigInt(this.protocolLiquidity)) {
      Notification.show(
        "Not enough liquidity to unstake that amount.",
        "warning",
      );
      return;
    }

    const provider = this.wallet.getEthersProvider();
    const signer = await provider.getSigner();
    const rEthContract = new ethers.Contract(
      rETHContractAddress,
      rETH_ABI,
      signer,
    );

    const tx = await rEthContract.burn(amountInWei);
    Notification.track(tx, {
      label: `Unstaking ${amount} rETH`,
      onSuccess: () => this.updateAllBalances(ui),
    });
  }
}

// ============================================================
// MAIN APP
// ============================================================

class RocketPoolApp {
  constructor() {
    this.wallet = new ConnectWallet();
    this.wallet.setNameResolutionOrder("ens-first");
    this.ui = new UIManager();
    this.contracts = new ContractManager(this.wallet);
  }

  init() {
    this.setupWalletEvents();
    this.setupUIEvents();
    this.contracts.updateProtocolLiquidity(this.ui);

    if (this.wallet.isConnected()) {
      const tryLoad = async (retries = 5) => {
        const provider = this.wallet.getEthersProvider();
        if (provider) {
          await this.contracts.updateETHBalance(this.ui);
          await this.contracts.updateRETHBalance(this.ui);
          this.contracts.syncUnstakeButton(this.ui);
        } else if (retries > 0) {
          setTimeout(() => tryLoad(retries - 1), 300);
        }
      };
      tryLoad();
    }
  }

  setupWalletEvents() {
    this.wallet.onConnect(async (data) => {
      const account = data.accounts[0];
      const shortAccount = `${account.slice(0, 6)}...${account.slice(-4)}`;
      Notification.show(
        `Connected to ${this.wallet.getLastWallet()} with account ${shortAccount}`,
        "success",
      );
      await this.contracts.updateAllBalances(this.ui);
    });

    this.wallet.onDisconnect(() => {
      Notification.show("Wallet disconnected", "warning");
      this.ui.resetToDisconnected();
    });

    this.wallet.onChainChange(async ({ name, allowed }) => {
      if (!allowed) return;
      Notification.show(`Switched to ${name}`, "info");
      await this.contracts.updateAllBalances(this.ui);
    });
  }

  setupUIEvents() {
    this.ui.elements.stakeBtn.addEventListener("click", () =>
      this.handleTransaction(async () => {
        const amount = this.ui.elements.ethAmountInput.value;
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
          throw new Error("Please enter a valid amount of ETH to stake.");
        await this.contracts.executeStake(amount, this.ui);
      }),
    );

    this.ui.elements.unstakeBtn.addEventListener("click", () =>
      this.handleTransaction(async () => {
        const amount = this.ui.elements.rethAmountInput.value;
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0)
          throw new Error("Please enter a valid amount of rETH to unstake.");
        await this.contracts.executeUnstake(amount, this.ui);
      }),
    );

    this.ui.elements.rethMaxBtn.addEventListener("click", () => {
      this.ui.elements.rethAmountInput.value = this.contracts.rethBalance;
      this.contracts.syncUnstakeButton(this.ui);
    });

    this.ui.elements.rethAmountInput.addEventListener("input", () =>
      this.contracts.syncUnstakeButton(this.ui),
    );
  }

  async handleTransaction(fn) {
    if (!this.wallet.isConnected()) {
      Notification.show("Please connect your wallet first", "warning");
      return;
    }
    try {
      await fn();
    } catch (err) {
      console.error("Transaction error:", err);
      Notification.show(
        err.reason || err.message.split("(")[0] || "Transaction failed",
        "error",
      );
    }
  }
}

// ============================================================
// INIT
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const app = new RocketPoolApp();
  app.init();
});
