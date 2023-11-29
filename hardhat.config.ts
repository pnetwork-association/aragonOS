import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";
import "./scripts";

import { execSync } from "child_process";

const getEnvironmentVariable = (_envVar: string) => process.env[_envVar];

const pk = execSync(`gpg --decrypt -q ${getEnvironmentVariable("PK")}`, {
  encoding: "utf-8",
}).trim();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.4.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10000,
      },
    },
  },
  networks: {
    // ... other networks ...

    xdai: {
      url: getEnvironmentVariable("XDAI_PROVIDER_URL"),
      accounts: [pk],
    },
  },
  etherscan: {
    apiKey: {
      xdai: getEnvironmentVariable("XDAI_ETHERSCAN_KEY") as string
    }
  },
  sourcify: {
    enabled: false
  }
};

export default config;
