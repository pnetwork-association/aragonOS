// const logDeploy = require('./helpers/deploy-logger')
import {
  HardhatArguments,
  HardhatRuntimeEnvironment,
  TaskArguments,
} from "hardhat/types";
import { task } from "hardhat/config";
import { types } from "hardhat/config";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const defaultKernelBase = process.env.KERNEL_BASE;
const defaultAclBaseAddress = process.env.ACL_BASE;
const defaultEvmScriptRegistryFactoryAddress = process.env.EVM_REG_FACTORY;

export const deployDaoFactory = async (
  _args: TaskArguments,
  _hre: HardhatRuntimeEnvironment
) => {
  const kernelBaseAddress = _args["kernelAddress"];
  const aclBaseAddress = _args["aclAddress"];
  const evmScriptRegistryFactoryAddress = _args["evmScriptAddress"];
  const withEvmScriptRegistryFactory = _args["withEvmFactory"];

  const ACL = await _hre.ethers.getContractFactory("ACL");
  const Kernel = await _hre.ethers.getContractFactory("Kernel");
  const DAOFactory = await _hre.ethers.getContractFactory("DAOFactory");

  let kernelBase;
  if (kernelBaseAddress) {
    kernelBase = Kernel.attach(kernelBaseAddress);
    console.log(
      `Skipping deploying new Kernel base, using provided address: ${kernelBaseAddress}`
    );
  } else {
    console.log("Deploying Kernel...");
    kernelBase = await (await Kernel.deploy(true)).waitForDeployment(); // immediately petrify
    console.log(`Deployed Kernel: ${await kernelBase.getAddress()}`)
  }

  let aclBase;
  if (aclBaseAddress) {
    aclBase = ACL.attach(aclBaseAddress);
    console.log(
      `Skipping deploying new ACL base, using provided address: ${aclBaseAddress}`
    );
  } else {
    console.log("Deploying ACL...");
    aclBase = await (await ACL.deploy()).waitForDeployment();
    console.log(`Deployed ACL: ${await aclBase.getAddress()}`)
  }

  let evmScriptRegistryFactory;
  if (withEvmScriptRegistryFactory) {
    const EVMScriptRegistryFactory = await _hre.ethers.getContractFactory(
      "EVMScriptRegistryFactory"
    );

    if (evmScriptRegistryFactoryAddress) {
      evmScriptRegistryFactory = EVMScriptRegistryFactory.attach(
        evmScriptRegistryFactoryAddress
      );
      console.log(
        `Skipping deploying new EVMScriptRegistryFactory, using provided address: ${evmScriptRegistryFactoryAddress}`
      );
    } else {
      console.log("Deploying EVMScriptRegistryFactory...");
      evmScriptRegistryFactory = await (await EVMScriptRegistryFactory.deploy()).waitForDeployment();
      console.log(`Deployed EVMScriptRegistryFactory: ${await evmScriptRegistryFactory.getAddress()}`)
    }
  }
  console.log("Deploying DAOFactory...");
  const daoFactory = await (await DAOFactory.deploy(
    await kernelBase.getAddress(),
    await aclBase.getAddress(),
    evmScriptRegistryFactory
      ? await evmScriptRegistryFactory.getAddress()
      : ZERO_ADDR
  )).waitForDeployment();
  console.log(`Deployed DAOFactory: ${await daoFactory.getAddress()}`)

  console.info(`Deployed contracts: {
    kernelBase: ${await kernelBase.getAddress()},
    aclBase: ${await aclBase.getAddress()},
    evmScriptRegistryFactory: ${evmScriptRegistryFactory && await evmScriptRegistryFactory.getAddress()},
    daoFactory: ${await daoFactory.getAddress()},
  }`);

  return {
    kernelBase,
    aclBase,
    evmScriptRegistryFactory,
    daoFactory,
  };
};

task("deploy:dao-factory", "Deploy DAO factory", deployDaoFactory)
  .addOptionalParam("kernelAddress", "Kernel Address", defaultKernelBase)
  .addOptionalParam("aclAddress", "ACL Address", defaultAclBaseAddress)
  .addOptionalParam(
    "evmScriptAddress",
    "EVM scripts Address",
    defaultEvmScriptRegistryFactoryAddress
  )
  .addOptionalParam(
    "withEvmFactory",
    "With EVM Script Registry Factory",
    true,
    types.boolean
  );
