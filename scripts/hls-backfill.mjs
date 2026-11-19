#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Il manque SUPABASE_URL (ou EXPO_PUBLIC_SUPABASE_URL) et/ou SUPABASE_SERVICE_ROLE_KEY dans .env');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = 'videos';
const encodeScript = fileURLToPath(new URL('./encode-hls.mjs', import.meta.url));

const MIME = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.jpg': 'image/jpeg',
};

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

const { data: rows, error } = await supabase
  .from('videos')
  .select('id, video_url, thumbnail_url')
  .is('hls_url', null)
  .eq('status', 'published');

if (error) {
  console.error('Lecture de la table videos impossible :', error.message);
  process.exit(1);
}
console.log(`${rows.length} vidéo(s) à convertir.`);

let ok = 0;
for (const row of rows) {
  const work = join(tmpdir(), `hls-${row.id}`);
  try {
    console.log(`\n→ ${row.id}`);
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });

    const response = await fetch(row.video_url);
    if (!response.ok) throw new Error(`Téléchargement impossible (${response.status})`);
    const source = join(work, 'source.mp4');
    writeFileSync(source, Buffer.from(await response.arrayBuffer()));

    const outDir = join(work, 'out');
    execFileSync(process.execPath, [encodeScript, source, outDir], { stdio: 'ignore' });

    for (const file of walk(outDir)) {
      const remotePath = `hls/${row.id}/${relative(outDir, file).split('\\').join('/')}`;
      const contentType = MIME[extname(file).toLowerCase()];
      if (!contentType) continue;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(remotePath, readFileSync(file), { contentType, cacheControl: '31536000', upsert: true });
      if (uploadError) throw new Error(`Upload ${remotePath} : ${uploadError.message}`);
    }

    const base = `hls/${row.id}`;
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        hls_url: publicUrl(`${base}/master.m3u8`),
        thumbnail_url_low: publicUrl(`${base}/thumb-low.jpg`),
        thumbnail_url_medium: publicUrl(`${base}/thumb-medium.jpg`),
        thumbnail_url: row.thumbnail_url || publicUrl(`${base}/thumb.jpg`),
      })
      .eq('id', row.id);
    if (updateError) throw new Error(`Mise à jour de la base : ${updateError.message}`);

    ok += 1;
    console.log('   OK');
  } catch (err) {
    console.error(`   ÉCHEC : ${err.message}`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
console.log(`\nTerminé : ${ok}/${rows.length} vidéo(s) converties.`);