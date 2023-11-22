import { task, types } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { DAOFactory, ENS } from "../typechain-types";
import { EventLog } from "ethers";

const namehash = require("eth-ens-namehash").hash;
const keccak256 = require("js-sha3").keccak_256;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

const defaultOwner = process.env.OWNER;
const defaultDaoFactoryAddress = process.env.DAO_FACTORY;
const defaultENSAddress = process.env.ENS;

const deploy = async (
  _args: TaskArguments,
  _hre: HardhatRuntimeEnvironment
) => {
  let ensAddress: string = _args["ensAddress"];
  let owner: string = _args["owner"];
  const daoFactoryAddress: string = _args["daoFactory"];

  const APMRegistry = await _hre.ethers.getContractFactory("APMRegistry");
  const Repo = await _hre.ethers.getContractFactory("Repo");
  const ENSSubdomainRegistrar = await _hre.ethers.getContractFactory(
    "ENSSubdomainRegistrar"
  );
  const DAOFactory = await _hre.ethers.getContractFactory("DAOFactory");
  const APMRegistryFactory = await _hre.ethers.getContractFactory(
    "APMRegistryFactory"
  );
  const ENS = await _hre.ethers.getContractFactory("ENS");

  const tldName = "eth";
  const labelName = "aragonpm";
  const tldHash = namehash(tldName);
  const labelHash = "0x" + keccak256(labelName);
  const apmNode = namehash(`${labelName}.${tldName}`);

  let ens: ENS;

  console.log("Deploying APM...");

  const accounts = await _hre.ethers.getSigners();
  if (!owner) {
    owner = accounts[0].address;
    console.log(
      "OWNER env variable not found, setting APM owner to the provider's first account"
    );
  }
  console.log("Owner:", owner);

  if (!ensAddress) {
    console.log("=========");
    console.log("Missing ENS! Deploying a custom ENS...");
    ens = (await _hre.run("deploy:ens")).ens;
    ensAddress = await ens.getAddress();
  } else {
    ens = ENS.attach(ensAddress) as ENS;
  }

  console.log("ENS:", ensAddress);
  console.log(`TLD: ${tldName} (${tldHash})`);
  console.log(`Label: ${labelName} (${labelHash})`);

  console.log("=========");
  console.log("Deploying APM bases...");

  const apmRegistryBase = await APMRegistry.deploy();
  console.log("Deployed APMRegistry:", await apmRegistryBase.getAddress());
  const apmRepoBase = await Repo.deploy();
  console.log("Deployed Repo:", await apmRepoBase.getAddress());
  const ensSubdomainRegistrarBase = await ENSSubdomainRegistrar.deploy();
  console.log(
    "Deployed ENSSubdomainRegistrar:",
    await ensSubdomainRegistrarBase.getAddress()
  );

  let daoFactory: DAOFactory;
  if (daoFactoryAddress) {
    daoFactory = DAOFactory.attach(daoFactoryAddress) as DAOFactory;
    const hasEVMScripts = (await daoFactory.regFactory()) !== ZERO_ADDR;

    console.log(
      `Using provided DAOFactory (with${
        hasEVMScripts ? "" : "out"
      } EVMScripts):`,
      daoFactoryAddress
    );
  } else {
    console.log("Deploying DAOFactory with EVMScripts...");
    daoFactory = (await _hre.run("deploy:dao-factory")).daoFactory;
  }

  console.log("Deploying APMRegistryFactory...");
  const apmFactory = await APMRegistryFactory.deploy(
    await daoFactory.getAddress(),
    await apmRegistryBase.getAddress(),
    await apmRepoBase.getAddress(),
    await ensSubdomainRegistrarBase.getAddress(),
    ensAddress,
    ZERO_ADDR
  );
  console.log("Deployed APMRegistryFactory:", await apmFactory.getAddress());

  console.log(`Assigning ENS name (${labelName}.${tldName}) to factory...`);

  if ((await ens.owner(apmNode)) === accounts[0].address) {
    console.log(
      "Transferring name ownership from deployer to APMRegistryFactory"
    );
    await ens.setOwner(apmNode, await apmFactory.getAddress());
  } else {
    console.log("Creating subdomain and assigning it to APMRegistryFactory");
    try {
      await ens.setSubnodeOwner(
        tldHash,
        labelHash,
        await apmFactory.getAddress()
      );
    } catch (err) {
      console.error(
        `Error: could not set the owner of '${labelName}.${tldName}' on the given ENS instance`,
        `(${ensAddress}). Make sure you have ownership rights over the subdomain.`
      );
      throw err;
    }
  }

  console.log("Deploying APM...");
  const receipt = await (
    await apmFactory.newAPM(tldHash, labelHash, owner)
  ).wait(1);

  console.log("=========");
  const log = receipt?.logs.filter((log) =>
    "eventName" in log ? log.eventName == "DeployAPM" : false
  )[0] as EventLog;
  const apmAddr = log.args.apm;
  console.log("# APM:");
  console.log("Address:", apmAddr);
  console.log("Transaction hash:", receipt?.hash);
  console.log("=========");

  return {
    apmFactory,
    ens,
    apm: APMRegistry.attach(apmAddr),
  };
};

task("deploy:apm", "Deploy Aragon APM", deploy)
  .addOptionalParam("owner", "Owner address", defaultOwner, types.string)
  .addOptionalParam(
    "ensAddress",
    "ENS Address",
    defaultENSAddress,
    types.string
  )
  .addOptionalParam(
    "daoFactory",
    "DAO Factory Address",
    defaultDaoFactoryAddress,
    types.string
  );
