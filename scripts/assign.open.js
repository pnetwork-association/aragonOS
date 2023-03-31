const namehash = require('eth-ens-namehash')
const keccak256 = require('js-sha3').keccak_256

const getAccounts = require('./helpers/get-accounts')

const globalArtifacts = this.artifacts // Not injected unless called directly via truffle
const globalWeb3 = this.web3 // Not injected unless called directly via truffle

const defaultOwner = process.env.OWNER

const APM_REGISTRY_FACTORY_ADDRESS = '0x4d2a274262fcdbe68270fe0ea6811a7fa2b640bf'
const APM_REGISTRY = '0xe68725d87aa896bc5bc35d5cff8e6f26777c758e'

module.exports = async (
  truffleExecCallback,
  {
    artifacts = globalArtifacts,
    web3 = globalWeb3,
    owner = defaultOwner,
    verbose = true
  } = {}
) => {
  const log = (...args) => {
    if (verbose) { console.log(...args) }
  }

  const ENSSubdomainRegistrar = artifacts.require('ENSSubdomainRegistrar')
  const APMRegistryFactory = artifacts.require('APMRegistryFactory')
  const ACL = artifacts.require('ACL')
  const APMRegistry = artifacts.require('APMRegistry')
  const Kernel = artifacts.require('Kernel')

  const accounts = await getAccounts(web3)
  if (!owner) {
    owner = accounts[0]
    log('OWNER env variable not found, setting APM owner to the provider\'s first account')
  }
  log('Owner:', owner)

  const apmFactory = await APMRegistryFactory.at(APM_REGISTRY_FACTORY_ADDRESS)
  const apm = await APMRegistry.at(APM_REGISTRY)
  const kernel = await Kernel.at(await apm.kernel())
  const acl = await ACL.at(await kernel.acl())
  const registrar = await apm.registrar()
  const ensSubdomainRegistrarBase = await ENSSubdomainRegistrar.at(registrar)

  const openTldName = 'aragonpm.eth'
  const openLabelName = 'open'
  const openLabelHash = '0x' + keccak256(openLabelName)
  const openTldHash = namehash.hash(openTldName)

  log('Create permission for root account on CREATE_NAME_ROLE')
  await acl.grantPermission(
    owner,
    registrar,
    await ensSubdomainRegistrarBase.CREATE_NAME_ROLE()
  )

  log('Creating open subdomain and assigning it to APMRegistryFactory')
  await ensSubdomainRegistrarBase.createName(openLabelHash, apmFactory.address, {
    gasLimit: 700000,
  })

  const ANY_ENTITY = '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF'
  const CREATE_REPO_ROLE = '0x' + keccak256('CREATE_REPO_ROLE')

  // New Open APM instance
  const { logs } = await apmFactory.newAPM(openTldHash, openLabelHash, owner)
  const { apm: openApmAddress } = logs.find(
    (_log) => _log.event === 'DeployAPM'
  ).args

  // 0x5dd941cb8701bb50205e5aef88c8532b8d6e75b7b65e2c458e9acdf261f0f292
  // const openApmAddress = '0x2444fe8a9d5d1ca5146e8672831bf68fbfe191b7'

  log('Open APM:', openApmAddress);
  const openApm = await APMRegistry.at(openApmAddress)
  const openKernel = await Kernel.at(await openApm.kernel())
  const openAcl = await ACL.at(await openKernel.acl())

  log('Create permission for ANY_ENTITY on CREATE_REPO_ROLE')
  await openAcl.grantPermission(
    ANY_ENTITY,
    openApmAddress,
    CREATE_REPO_ROLE,
    {
      gasLimit: 500000,
    }
  )

  truffleExecCallback()
}
