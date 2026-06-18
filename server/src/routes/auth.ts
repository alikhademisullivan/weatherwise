import { Router, Request, Response } from 'express';
import { createUser, findUserByEmail, findUserById, verifyPassword } from '../db/users';
import { getSavedLocations, addSavedLocation, removeSavedLocation } from '../db/savedLocations';
import { requireAuth, signToken, AuthRequest } from '../middleware/requireAuth';
import { dbEnabled } from '../db/pool';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function dbCheck(res: Response): boolean {
  if (!dbEnabled()) {
    res.status(503).json({ error: 'Database not configured' });
    return false;
  }
  return true;
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  if (!dbCheck(res)) return;
  const { email, password, displayName } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const user = await createUser(email, password, displayName);
    const token = signToken(user.id);
    res.cookie('token', token, COOKIE_OPTS);
    return res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'An account with this email already exists' });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  if (!dbCheck(res)) return;
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = signToken(user.id);
  res.cookie('token', token, COOKIE_OPTS);
  return res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
});

// POST /api/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('token', { path: '/' });
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await findUserById(req.userId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
});

// GET /api/auth/locations
router.get('/locations', requireAuth, async (req: AuthRequest, res: Response) => {
  const locations = await getSavedLocations(req.userId!);
  return res.json({ locations });
});

// POST /api/auth/locations
router.post('/locations', requireAuth, async (req: AuthRequest, res: Response) => {
  const { label, city, lat, lon } = req.body ?? {};
  if (!label || !city) return res.status(400).json({ error: 'label and city required' });
  await addSavedLocation(req.userId!, label, city, lat ?? null, lon ?? null);
  return res.json({ ok: true });
});

// DELETE /api/auth/locations/:city
router.delete('/locations/:city', requireAuth, async (req: AuthRequest, res: Response) => {
  await removeSavedLocation(req.userId!, decodeURIComponent(req.params.city));
  return res.json({ ok: true });
});

export default router;
