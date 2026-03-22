import { model } from "@medusajs/framework/utils"

/**
 * InviteRole — stores the intended role for a pending admin invite.
 * Consumed and deleted when the invite is accepted and the user is created.
 */
const InviteRole = model.define("invite_role", {
  id: model.id().primaryKey(),
  email: model.text(),
  role_code: model.text(),
  invited_by: model.text(),
})

export default InviteRole
