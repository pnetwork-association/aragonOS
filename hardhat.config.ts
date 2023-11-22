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
      enabled: true,
      runs: 1000,
    },
  },
  networks: {
    // ... other networks ...

    gnosis: {
      url: getEnvironmentVariable("GNOSIS_PROVIDER_URL"),
      accounts: [pk],
    },
  },
};

export default config;
