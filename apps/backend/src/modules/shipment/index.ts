import ShipmentModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const SHIPMENT_MODULE = "pharmaShipment"

export default Module(SHIPMENT_MODULE, {
  service: ShipmentModuleService,
})
