import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import {
  ACL,
  APMRegistry,
  APMRegistryFactory,
  ENSSubdomainRegistrar,
  Kernel,
} from "../typechain-types";
import { EventLog } from "ethers";

const namehash = require("eth-ens-namehash");
const keccak256 = require("js-sha3").keccak_256;

const defaultOwner = process.env.OWNER;
const APM_REGISTRY_FACTORY_ADDRESS = process.env.APM_REGISTRY_FACTORY_ADDRESS;
const APM_REGISTRY_ADDRESS = process.env.APM_REGISTRY_ADDRESS;

const assignOpen = async (
  _args: TaskArguments,
  _hre: HardhatRuntimeEnvironment
) => {
  let owner: string = _args["owner"];
  let apmFactoryAddress: string = _args["apmRegistryFactoryAddress"];
  let apmAddress: string = _args["apmRegistryAddress"];

  const ENSSubdomainRegistrar = await _hre.ethers.getContractFactory(
    "ENSSubdomainRegistrar"
  );
  const APMRegistryFactory = await _hre.ethers.getContractFactory(
    "APMRegistryFactory"
  );
  const ACL = await _hre.ethers.getContractFactory("ACL");
  const APMRegistry = await _hre.ethers.getContractFactory("APMRegistry");
  const Kernel = await _hre.ethers.getContractFactory("Kernel");

  const accounts = await _hre.ethers.getSigners();
  if (!owner) {
    owner = accounts[0].address;
    console.log(
      "OWNER env variable not found, setting APM owner to the provider's first account"
    );
  }
  console.log("Owner:", owner);
  const apmFactory = APMRegistryFactory.attach(
    apmFactoryAddress
  ) as APMRegistryFactory;
  const apm = APMRegistry.attach(apmAddress) as APMRegistry;
  const kernel = Kernel.attach(await apm.kernel()) as Kernel;
  const acl = ACL.attach(await kernel.acl()) as ACL;
  const registrar = await apm.registrar();
  const ensSubdomainRegistrarBase = ENSSubdomainRegistrar.attach(
    registrar
  ) as ENSSubdomainRegistrar;

  const openTldName = "aragonpm.eth";
  const openLabelName = "open";
  const openLabelHash = "0x" + keccak256(openLabelName);
  const openTldHash = namehash.hash(openTldName);

  console.log("Create permission for root account on CREATE_NAME_ROLE");
  await (
    await acl.grantPermission(
      owner,
      registrar,
      await ensSubdomainRegistrarBase.CREATE_NAME_ROLE()
    )
  ).wait(1);

  console.log("Creating open subdomain and assigning it to APMRegistryFactory");
  await ensSubdomainRegistrarBase.createName(
    openLabelHash,
    await apmFactory.getAddress(),
    { gasLimit: 2e6, gasPrice: 5e9 }
  );

  const ANY_ENTITY = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF";
  const CREATE_REPO_ROLE = "0x" + keccak256("CREATE_REPO_ROLE");

  // New Open APM instance
  const receipt = await (
    await apmFactory.newAPM(openTldHash, openLabelHash, owner)
  ).wait(1);
  const log = receipt?.logs.filter((log) =>
    "eventName" in log ? log.eventName == "DeployAPM" : false
  )[0] as EventLog;
  const { apm: openApmAddress } = log.args;

  console.log("Open APM:", openApmAddress);
  const openApm = APMRegistry.attach(openApmAddress) as APMRegistry;
  const openKernel = Kernel.attach(await openApm.kernel()) as Kernel;
  const openAcl = ACL.attach(await openKernel.acl()) as ACL;

  console.log("Create permission for ANY_ENTITY on CREATE_REPO_ROLE");
  await (
    await openAcl.grantPermission(
      ANY_ENTITY,
      openApmAddress,
      CREATE_REPO_ROLE,
      {
        gasLimit: 500000,
      }
    )
  ).wait(1);
};

task("assign:open", "Assign open", assignOpen)
  .addOptionalParam("owner", "Owner", defaultOwner)
  .addOptionalParam(
    "apmRegistryFactoryAddress",
    "APM Registry Factory Address",
    APM_REGISTRY_FACTORY_ADDRESS
  )
  .addOptionalParam(
    "apmRegistryAddress",
    "APM Registry Address",
    APM_REGISTRY_ADDRESS
  );
