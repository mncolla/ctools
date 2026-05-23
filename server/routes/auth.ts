import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { LoginResponse } from '@shared/types'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'

const BOOTSTRAP_USER = {
  username: 'admin',
  password: 'admin123',
  role: 'admin' as const,
  displayName: 'Administrador',
}

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export function createAuthRouter() {
  const router = new Hono()

  router.post('/login', zValidator('json', loginSchema), async (c) => {
    const { username, password } = c.req.valid('json')

    if (username !== BOOTSTRAP_USER.username || password !== BOOTSTRAP_USER.password) {
      return c.json({ error: 'Credenciales inválidas' }, 401)
    }

    const now = Math.floor(Date.now() / 1000)
    const token = await sign(
      {
        userId: 'bootstrap-admin',
        username: BOOTSTRAP_USER.username,
        role: BOOTSTRAP_USER.role,
        iat: now,
        exp: now + 8 * 60 * 60,
      },
      JWT_SECRET
    )

    const response: LoginResponse = {
      token,
      username: BOOTSTRAP_USER.username,
      role: BOOTSTRAP_USER.role,
    }

    return c.json(response)
  })

  return router
}
