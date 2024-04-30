/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { BytesLib, BytesLibInterface } from "../BytesLib";

const _abi = [
  {
    inputs: [],
    name: "SliceOutOfBounds",
    type: "error",
  },
];

const _bytecode =
  "0x6080806040523460175760119081601d823930815050f35b600080fdfe600080fdfea164736f6c6343000811000a";

export class BytesLib__factory extends ContractFactory {
  constructor(
    ...args: [signer: Signer] | ConstructorParameters<typeof ContractFactory>
  ) {
    if (args.length === 1) {
      super(_abi, _bytecode, args[0]);
    } else {
      super(...args);
    }
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<BytesLib> {
    return super.deploy(overrides || {}) as Promise<BytesLib>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): BytesLib {
    return super.attach(address) as BytesLib;
  }
  connect(signer: Signer): BytesLib__factory {
    return super.connect(signer) as BytesLib__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): BytesLibInterface {
    return new utils.Interface(_abi) as BytesLibInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): BytesLib {
    return new Contract(address, _abi, signerOrProvider) as BytesLib;
  }
}
