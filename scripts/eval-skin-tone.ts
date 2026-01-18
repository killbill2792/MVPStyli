/**
 * Offline evaluator:
 * - Runs the API logic against a folder of images + JSON labels
 * - Prints accuracy, top-2 accuracy, confusion matrix
 *
 * Usage:
 *   npx tsx scripts/eval-skin-tone.ts ./eval/images ./eval/labels.json
 *   or
 *   node scripts/eval-skin-tone.js ./eval/images ./eval/labels.json
 *
 * labels.json format:
 * {
 *   "img1.jpg": "autumn",
 *   "img2.jpg": "winter"
 * }
 */

import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_BASE; // e.g. http://localhost:3000
if (!API_BASE) throw new Error('Set API_BASE (e.g. http://localhost:3000)');

const [imgDir, labelsPath] = process.argv.slice(2);
if (!imgDir || !labelsPath) {
  console.error('Usage: npx tsx scripts/eval-skin-tone.ts <imgDir> <labels.json>');
  console.error('Example: npx tsx scripts/eval-skin-tone.ts ./eval/images ./eval/labels.json');
  process.exit(1);
}

if (!fs.existsSync(labelsPath)) {
  throw new Error(`Labels file not found: ${labelsPath}`);
}

if (!fs.existsSync(imgDir)) {
  throw new Error(`Image directory not found: ${imgDir}`);
}

const labels = JSON.parse(fs.readFileSync(labelsPath, 'utf-8')) as Record<string, string>;
const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;

function initMatrix() {
  const m: Record<string, Record<string, number>> = {};
  for (const t of seasons) {
    m[t] = {};
    for (const p of seasons) m[t][p] = 0;
  }
  return m;
}

(async () => {
  let total = 0;
  let correct1 = 0;
  let correct2 = 0;
  const matrix = initMatrix();
  const errors: string[] = [];

  console.log(`🎨 [EVAL] Starting evaluation...`);
  console.log(`🎨 [EVAL] API Base: ${API_BASE}`);
  console.log(`🎨 [EVAL] Image Directory: ${imgDir}`);
  console.log(`🎨 [EVAL] Labels File: ${labelsPath}`);
  console.log(`🎨 [EVAL] Total images to evaluate: ${Object.keys(labels).length}\n`);

  for (const file of Object.keys(labels)) {
    const truth = labels[file];
    if (!seasons.includes(truth as any)) {
      console.warn(`⚠️  Skipping ${file}: invalid season "${truth}"`);
      continue;
    }

    const full = path.join(imgDir, file);
    if (!fs.existsSync(full)) {
      console.warn(`⚠️  Missing file: ${full}`);
      errors.push(`Missing: ${file}`);
      continue;
    }

    try {
      const imgBuffer = fs.readFileSync(full);
      const b64 = imgBuffer.toString('base64');
      
      // Determine image format from extension
      const ext = path.extname(file).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/jpeg';
      
      const res = await fetch(`${API_BASE}/api/analyze-skin-tone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: `data:${mimeType};base64,${b64}` }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`❌ API failed for ${file}: ${res.status} ${errorText}`);
        errors.push(`API error (${res.status}): ${file}`);
        continue;
      }

      const out = await res.json();

      if (!out.season) {
        console.warn(`⚠️  No season returned for ${file}`);
        errors.push(`No season: ${file}`);
        continue;
      }

      const pred1 = out.season;
      const cand = (out.seasonCandidates ?? []).map((c: any) => c.season);
      const pred2 = cand[1] ?? null;

      total++;
      if (pred1 === truth) correct1++;
      if (pred1 === truth || pred2 === truth) correct2++;

      if (seasons.includes(truth as any) && seasons.includes(pred1 as any)) {
        matrix[truth][pred1]++;
      }

      const status1 = pred1 === truth ? '✅' : '❌';
      const status2 = pred2 === truth ? '✅' : '';
      console.log(`${status1} ${file.padEnd(30)} truth=${truth.padEnd(8)} pred=${pred1.padEnd(8)} top2=${(cand.slice(0,2).join(',') || 'none').padEnd(20)} conf=${(out.seasonConfidence ?? 0).toFixed(3)} ${status2}`);
    } catch (error: any) {
      console.error(`❌ Error processing ${file}:`, error.message);
      errors.push(`Error: ${file} - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTS');
  console.log('='.repeat(60));
  console.log(`Total evaluated: ${total}`);
  console.log(`Top-1 accuracy: ${total ? ((correct1 / total) * 100).toFixed(2) + '%' : 'n/a'} (${correct1}/${total})`);
  console.log(`Top-2 accuracy: ${total ? ((correct2 / total) * 100).toFixed(2) + '%' : 'n/a'} (${correct2}/${total})`);
  
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors/Warnings: ${errors.length}`);
    errors.forEach(e => console.log(`   - ${e}`));
  }

  console.log('\n📈 Confusion Matrix (rows=true label, cols=predicted):');
  console.log('   '.padEnd(12) + seasons.map(s => s.padEnd(10)).join(''));
  for (const truth of seasons) {
    const row = matrix[truth];
    const totalRow = Object.values(row).reduce((a, b) => a + b, 0);
    const rowStr = truth.padEnd(10) + seasons.map(pred => {
      const count = row[pred] || 0;
      const pct = totalRow > 0 ? ((count / totalRow) * 100).toFixed(0) : '0';
      return `${count} (${pct}%)`.padEnd(10);
    }).join('');
    console.log(rowStr);
  }
  
  console.log('\n' + '='.repeat(60));
})();
