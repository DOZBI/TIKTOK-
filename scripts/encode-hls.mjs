#!/usr/bin/env node
/**
 * Génère les fichiers HLS adaptatifs (low / medium / high) + master.m3u8
 * + miniatures (low / medium / full) pour public.videos.
 *
 * Usage : node scripts/encode-hls.mjs input.mp4 output-directory
 * Ensuite : envoie le dossier dans le bucket Supabase "videos" et enregistre
 * l'URL publique de master.m3u8 dans hls_url (et les miniatures dans
 * thumbnail_url_low / thumbnail_url_medium / thumbnail_url).
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: node scripts/encode-hls.mjs <input-video> <output-directory>');
  process.exit(1);
}

const outputDir = resolve(output);
mkdirSync(outputDir, { recursive: true });

function findFfmpeg() {
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const found = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['ffmpeg'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    if (found) return found;
  } catch {
    // on continue avec la recherche WinGet ci-dessous
  }
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) return 'ffmpeg';
  const packagesDir = join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages');
  const scan = (directory) => {
    if (!existsSync(directory)) return null;
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      const candidate = join(directory, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'ffmpeg.exe') return candidate;
      if (entry.isDirectory()) {
        const result = scan(candidate);
        if (result) return result;
      }
    }
    return null;
  };
  return scan(packagesDir) ?? 'ffmpeg';
}

const ffmpegPath = findFfmpeg();
try {
  execFileSync(ffmpegPath, ['-version'], { stdio: 'ignore' });
} catch {
  console.error('FFmpeg est introuvable dans le PATH.');
  console.error('Windows : installe-le avec « winget install Gyan.FFmpeg.Shared », puis redémarre le terminal.');
  console.error('Vérification : ffmpeg -version');
  process.exit(1);
}

// Ordre important : la variante la plus légère est listée en premier dans le
// master, ce qui fait démarrer la lecture très vite sur iPhone (AVPlayer) ;
// le lecteur monte ensuite en qualité si le débit le permet.
const variants = [
  { name: 'low', width: 360, height: 640, bitrate: '700k', bandwidth: 850000, level: '3.0' },
  { name: 'medium', width: 540, height: 960, bitrate: '1500k', bandwidth: 1800000, level: '3.1' },
  { name: 'high', width: 720, height: 1280, bitrate: '3000k', bandwidth: 3500000, level: '3.1' },
];

for (const variant of variants) {
  const variantDir = join(outputDir, variant.name);
  mkdirSync(variantDir, { recursive: true });
  const bitrateK = Number.parseInt(variant.bitrate, 10);
  execFileSync(ffmpegPath, [
    '-y', '-i', resolve(input),
    '-vf', `scale=w=${variant.width}:h=${variant.height}:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'main', '-level', variant.level, '-pix_fmt', 'yuv420p',
    '-b:v', variant.bitrate, '-maxrate', variant.bitrate, '-bufsize', `${bitrateK * 2}k`,
    '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-ar', '44100',
    // GOP de 2 s à 30 fps : segments propres et changement de qualité sans accroc.
    '-g', '60', '-keyint_min', '60', '-sc_threshold', '0',
    '-hls_time', '2', '-hls_playlist_type', 'vod', '-hls_flags', 'independent_segments',
    '-hls_segment_filename', join(variantDir, 'segment-%03d.ts'), join(variantDir, 'index.m3u8'),
  ], { stdio: 'inherit' });
}

// Miniatures affichées avant la première image vidéo.
const thumbs = [
  { file: 'thumb-low.jpg', width: 180 },
  { file: 'thumb-medium.jpg', width: 360 },
  { file: 'thumb.jpg', width: 720 },
];
for (const thumb of thumbs) {
  execFileSync(ffmpegPath, [
    '-y', '-ss', '0.5', '-i', resolve(input), '-frames:v', '1',
    '-vf', `scale=${thumb.width}:-2`, '-q:v', '4', join(outputDir, thumb.file),
  ], { stdio: 'ignore' });
}

const master = ['#EXTM3U', '#EXT-X-VERSION:3', ...variants.flatMap((variant) => [
  `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=${variant.width}x${variant.height}`,
  `${variant.name}/index.m3u8`,
])].join('\n') + '\n';
writeFileSync(join(outputDir, 'master.m3u8'), master);
console.log(`Generated adaptive HLS assets in ${outputDir}`);
