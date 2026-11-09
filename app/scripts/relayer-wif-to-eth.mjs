#!/usr/bin/env node
/**
 * Convert relayer WIF → ETH via Uniswap v3 on Robinhood Chain (4663).
 *
 * Default is dry-run (quote only). Pass --execute to submit (requires RELAYER_KEY
 * in the environment; never logs the key).
 *
 * Honest status as of 2026-11-09: a WIF/WETH 1% pool exists at
 * 0x156064f872Eb6DedC953E7AF21E7A7991910Ef09 but liquidity is 0, so conversion
 * cannot succeed until Bamio (or LPs) seed that pool (or another fee tier).
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatEther, formatUnits, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

const CHAIN_ID = 4663
const RPC = process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com'
const WIF = '0x5173b8eA6923c2d40267890D45C46a3480954773'
const WETH = '0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'
const FACTORY = '0x1f7d7550b1b028f7571e69a784071f0205fd2efa'
const ROUTER = '0xcaf681a66d020601342297493863e78c959e5cb2'
const QUOTER = '0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7'
const RELAYER = process.env.RELAYER_ADDRESS || '0x00E7Aca39A2d988Bdd2A2EaD0c383AfD6E45A26a'
const FEES = [100, 500, 3000, 10000]
const execute = process.argv.includes('--execute')
const amountArg = process.argv.find(a => a.startsWith('--amount='))
const amountWif = amountArg ? amountArg.split('=')[1] : null

const client = createPublicClient({ transport: http(RPC) })
const factoryAbi = parseAbi(['function getPool(address,address,uint24) view returns (address)'])
const poolAbi = parseAbi(['function liquidity() view returns (uint128)'])
const erc20Abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function approve(address,uint256) returns (bool)',
])
const quoterAbi = parseAbi([
  'function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)',
])
const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
  'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
])

async function main() {
  const dec = await client.readContract({ address: WIF, abi: erc20Abi, functionName: 'decimals' })
  const bal = await client.readContract({ address: WIF, abi: erc20Abi, functionName: 'balanceOf', args: [RELAYER] })
  const eth = await client.getBalance({ address: RELAYER })
  console.log(JSON.stringify({
    chainId: CHAIN_ID,
    relayer: RELAYER,
    relayerEth: formatEther(eth),
    relayerWif: formatUnits(bal, dec),
    execute,
  }, null, 2))

  let best = null
  for (const fee of FEES) {
    const pool = await client.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getPool', args: [WIF, WETH, fee] })
    if (pool === '0x0000000000000000000000000000000000000000') {
      console.log(JSON.stringify({ fee, pool: null }))
      continue
    }
    const liquidity = await client.readContract({ address: pool, abi: poolAbi, functionName: 'liquidity' })
    console.log(JSON.stringify({ fee, pool, liquidity: liquidity.toString() }))
    if (liquidity > 0n && !best) best = { fee, pool, liquidity }
  }

  if (!best) {
    console.error('NO_LIQUIDITY: Uniswap WIF/WETH pools on Robinhood Chain have zero usable liquidity. Seed a pool (recommend 0.3% or 1% WIF/WETH) before enabling automatic relayer conversion. Until then, top up relayer ETH manually.')
    process.exit(2)
  }

  const amountIn = amountWif ? parseUnits(amountWif, dec) : bal
  if (amountIn === 0n) {
    console.error('Relayer WIF balance is 0')
    process.exit(3)
  }

  // QuoterV2 is not a view; use call simulation
  let amountOut
  try {
    const { result } = await client.simulateContract({
      address: QUOTER,
      abi: quoterAbi,
      functionName: 'quoteExactInputSingle',
      args: [{ tokenIn: WIF, tokenOut: WETH, amountIn, fee: best.fee, sqrtPriceLimitX96: 0n }],
    })
    amountOut = result[0]
  } catch (e) {
    console.error('Quote failed:', e.shortMessage || e.message)
    process.exit(4)
  }
  console.log(JSON.stringify({ amountIn: formatUnits(amountIn, dec), quotedWeth: formatEther(amountOut), fee: best.fee }, null, 2))

  if (!execute) {
    console.log('Dry-run only. Re-run with --execute once liquidity exists and RELAYER_KEY is set in the environment.')
    return
  }
  const pk = process.env.RELAYER_KEY?.trim()
  if (!pk) {
    console.error('RELAYER_KEY not set')
    process.exit(5)
  }
  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`)
  if (account.address.toLowerCase() !== RELAYER.toLowerCase()) {
    console.error('RELAYER_KEY does not match expected relayer address')
    process.exit(6)
  }
  const wallet = createWalletClient({ account, transport: http(RPC) })
  const minOut = amountOut * 95n / 100n
  await wallet.writeContract({ address: WIF, abi: erc20Abi, functionName: 'approve', args: [ROUTER, amountIn] })
  const hash = await wallet.writeContract({
    address: ROUTER,
    abi: routerAbi,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: WIF,
      tokenOut: WETH,
      fee: best.fee,
      recipient: RELAYER,
      amountIn,
      amountOutMinimum: minOut,
      sqrtPriceLimitX96: 0n,
    }],
  })
  console.log(JSON.stringify({ tx: hash, note: 'WETH received; unwrap separately if needed' }))
}

main().catch(e => { console.error(e); process.exit(1) })
