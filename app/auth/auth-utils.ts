import { AuthenticationError } from "blitz"
import SecurePassword from "secure-password"
import db, { User } from "db"
import { EmailUsedError } from "app/errors/emailUsed"
import { UnconfirmedEmailError } from "app/errors/unconfirmedEmail"

const SP = new SecurePassword()

export const hashPassword = async (password: string) => {
  const hashedBuffer = await SP.hash(Buffer.from(password))

  return hashedBuffer.toString("base64")
}

export const verifyPassword = async (hashedPassword: string, password: string) => {
  try {
    return await SP.verify(Buffer.from(password), Buffer.from(hashedPassword, "base64"))
  } catch (error) {
    console.error(error)

    return false
  }
}

export const ensureUserConfirmed = (user: Pick<User, "confirmedAt">) => {
  if (!user.confirmedAt) {
    throw new UnconfirmedEmailError()
  }
}

export const ensureUserEmailNotUsed = async (email: string) => {
  const user = await db.user.findOne({ where: { email } })

  if (!!user) {
    throw new EmailUsedError({ email })
  }
}

export const authenticateUser = async (email: string, password: string) => {
  const user = await db.user.findOne({ where: { email } })

  if (!user || !user.hashedPassword) {
    throw new AuthenticationError()
  }

  switch (await verifyPassword(user.hashedPassword, password)) {
    case SecurePassword.VALID:
      break
    case SecurePassword.VALID_NEEDS_REHASH:
      const improvedHash = await hashPassword(password)

      await db.user.update({ where: { id: user.id }, data: { hashedPassword: improvedHash } })

      break
    default:
      throw new AuthenticationError()
  }

  const { hashedPassword, ...rest } = user

  return rest
}
