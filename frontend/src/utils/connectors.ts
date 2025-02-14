import { InjectedConnector } from '@web3-react/injected-connector';

export const injected = new InjectedConnector({
  supportedChainIds: [1, 137, 42161, 10, 138] // Mainnet, Polygon, Arbitrum, Optimism, Chain 138
}); 