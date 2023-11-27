import { EventLog } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { ENS } from "../typechain-types";

const defaultOwner = process.env.OWNER;

export const deployEns = async (
  _args: TaskArguments,
  _hre: HardhatRuntimeEnvironment
) => {
  let owner = _args["owner"];
  if (!owner) {
    const accounts = await _hre.ethers.getSigners();
    owner = accounts[0].address;
    console.log(
      `No OWNER environment variable passed, setting ENS owner to provider's account: ${owner}`
    );
  }

  const ENS = await _hre.ethers.getContractFactory("ENS");
  const ENSFactory = await _hre.ethers.getContractFactory("ENSFactory");

  console.log("Deploying ENSFactory...");
  const factory = await (await ENSFactory.deploy()).waitForDeployment();
  console.log("Deployed ENSFactory:", await factory.getAddress());
  const receipt = await (await factory.newENS(owner)).wait(1);

  const log = receipt?.logs.filter((log) =>
    "eventName" in log ? log.eventName == "DeployENS" : false
  )[0] as EventLog;
  const ensAddr = log.args.ens;
  console.log("====================");
  console.log("Deployed ENS:", ensAddr);

  console.log(ensAddr);

  return {
    ens: ENS.attach(ensAddr) as ENS,
    ensFactory: factory,
  };
};

task("deploy:ens", "Deploy ENS", deployEns).addOptionalParam(
  "owner",
  "Owner address",
  defaultOwner
);
