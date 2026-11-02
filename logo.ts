import { allowedOrigin, findHost, cookieToken } from './host-auth.mjs';
import { logoStore } from './logo-store.mjs';
import { limitedBody } from './request.mjs';
export async function getLogo(req: Request, env: { DB: D1Database; BUCKET: ReturnType<typeof logoStore> }) {
  const key = new URL(req.url).searchParams.get('key') || '';
  if (!/^logos\/(?:[A-F0-9]{6}|PIC-\d{2}[A-Z])\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(key)) return new Response('Not found', { status: 404 });
  const image = await env.BUCKET!.get(key);
  if (!image) return new Response('Not found', { status: 404 });
  const headers = new Headers({ 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' });
  image.writeHttpMetadata(headers);
  return new Response(new Uint8Array(image.body), { headers });
}
export async function postLogo(req: Request, env: { DB: D1Database; BUCKET: ReturnType<typeof logoStore>; APP_ORIGIN?: string }) {
  if(!allowedOrigin(req,env))return Response.json({error:'Invalid request origin.'},{status:403});
  try {
    if (Number(req.headers.get('content-length') || 0) > 2200000) return Response.json({ error: 'Use an image smaller than 2 MB.' }, { status: 413 });
    const body = await new Response(await limitedBody(req, 2200000), { headers: { 'Content-Type': req.headers.get('Content-Type') || '' } }).formData();
    const code = String(body.get('code') || '').toUpperCase();
    const room = await env.DB!.prepare('SELECT * FROM rooms WHERE code=?').bind(code).first<any>();
    if (!room || room.deleted || room.secret !== body.get('secret') || Date.now() - room.created > 86400000) return Response.json({ error: 'Host access required.' }, { status: 403 });
    const user = await findHost(cookieToken(req), env.DB);
    if (room.owner && room.owner !== user?.userId) return Response.json({ error: 'Sign in to the host account for this competition.' }, { status: 403 });
    const kind = String(body.get('kind'));
    if (!['school','competition','team'].includes(kind)) return Response.json({ error: 'Invalid logo destination.' }, { status: 400 });
    const team = kind === 'team' ? await env.DB!.prepare('SELECT * FROM teams WHERE id=? AND room=?').bind(String(body.get('team') || ''), code).first() : null;
    if (kind === 'team' && !team) return Response.json({ error: 'Class not found.' }, { status: 404 });
    const previous = kind === 'team' ? team!.logo : kind === 'school' ? room.school_logo : room.competition_logo;
    let key: string | null = null;
    if (body.get('remove') !== 'true') {
      const file = body.get('file');
      if (!(file instanceof File) || !file.size || file.size > 2097152) return Response.json({ error: 'Choose a PNG, JPEG or WebP image, up to 2 MB.' }, { status: 400 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const png = [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
      const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp = String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP';
      if (!png && !jpg && !webp) return Response.json({ error: 'Use a PNG, JPEG or WebP image.' }, { status: 400 });
      const ext = png ? 'png' : jpg ? 'jpg' : 'webp';
      key = `logos/${code}/${crypto.randomUUID()}.${ext}`;
      await env.BUCKET!.put(key, bytes, { httpMetadata: { contentType: png ? 'image/png' : jpg ? 'image/jpeg' : 'image/webp' } });
    }
    if (kind === 'team') await env.DB!.prepare('UPDATE teams SET logo=? WHERE id=? AND room=?').bind(key, team!.id, code).run();
    else if (kind === 'school') await env.DB!.prepare('UPDATE rooms SET school_logo=? WHERE code=?').bind(key, code).run();
    else await env.DB!.prepare('UPDATE rooms SET competition_logo=? WHERE code=?').bind(key, code).run();
    if (previous) { try { await env.BUCKET!.delete(previous); } catch {} }
    return Response.json({ key });
  } catch (error) {
    if((error as any).status===413)return Response.json({error:'Use an image smaller than 2 MB.'},{status:413});
    console.error('Logo upload failed', error);
    return Response.json({ error: 'Logo could not be saved. Please try again.' }, { status: 500 });
  }
}
