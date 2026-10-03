// Source captures are review artifacts, not public website assets.
export default function handler(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  return res.status(404).json({ error: 'Not found' });
}
