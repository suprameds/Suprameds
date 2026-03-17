import { MedusaService } from "@medusajs/framework/utils"
import Role from "./models/role"
import Permission from "./models/permission"
import UserRole from "./models/user-role"
import RoleAuditLog from "./models/role-audit-log"

/**
 * RbacModuleService — Role definitions, permissions, SSD validation.
 */
class RbacModuleService extends MedusaService({
  Role,
  Permission,
  UserRole,
  RoleAuditLog,
}) {
  // TODO: assignRole(), revokeRole(), validateSsd(),
  //       checkPermission(), seedRolesAndPermissions()
}

export default RbacModuleService
