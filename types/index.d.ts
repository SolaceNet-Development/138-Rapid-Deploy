declare module 'ethers' {
    export * from '@ethersproject/providers';
    export * from '@ethersproject/contracts';
    export * from '@ethersproject/wallet';
}

declare module 'hardhat' {
    export const ethers: typeof import('ethers');
}

declare module 'chai' {
    export const expect: Function;
}

declare module '@nomiclabs/hardhat-ethers' {
    export const ethers: typeof import('ethers');
}

declare module '@nomiclabs/hardhat-waffle' {
    export const expect: Function;
} 