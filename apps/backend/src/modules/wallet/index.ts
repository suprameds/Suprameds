import WalletModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const WALLET_MODULE = "wallet"

export default Module(WALLET_MODULE, {
  service: WalletModuleService,
})
