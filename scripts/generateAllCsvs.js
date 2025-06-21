#!/usr/bin/env node

/**
 * generateAllCsvs.js
 * Orchestrateur : pour chaque token (config.tokens) et chaque source (config.sources),
 * invoque le script Node de la source pour récupérer funding history,
 * puis déplace/renomme le CSV généré vers outputDir/<token>-<source>.csv.
 *
 * Usage: node generateAllCsvs.js [days]
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Helper pour vérifier existence fichier
async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Exécution d’un script Node en série
function runScript(scriptFullPath, market, days) {
  return new Promise((resolve) => {
    console.log(`  Exécution: node ${scriptFullPath} ${market} ${days}`);
    const proc = spawn('node', [scriptFullPath, market, String(days)], { stdio: 'inherit' });
    proc.on('error', err => {
      console.error('    Erreur démarrage process:', err);
      resolve(false);
    });
    proc.on('close', code => {
      if (code === 0) {
        resolve(true);
      } else {
        console.error(`    Le script a renvoyé code ${code}`);
        resolve(false);
      }
    });
  });
}

async function main() {
  // Chemin vers config.json
  const scriptsDir = __dirname;
  const configPath = path.join(scriptsDir, 'config.json');
  if (!await fileExists(configPath)) {
    console.error('config.json introuvable dans', scriptsDir);
    process.exit(1);
  }
  const config = JSON.parse(await fs.promises.readFile(configPath, 'utf-8'));
  const tokens = config.tokens || [];
  const sources = config.sources || {};
  const defaultDays = Number(config.defaultDays) || 30;
  // outputDir relatif à scriptsDir
  const outputDir = path.resolve(scriptsDir, config.outputDir || '../output/csv');
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Nombre de jours passé en argument ou default
  const argDays = process.argv[2] ? Number(process.argv[2]) : defaultDays;
  if (isNaN(argDays) || argDays <= 0) {
    console.error('Argument days invalide:', process.argv[2]);
    process.exit(1);
  }
  const days = argDays;
  console.log(`Génération funding CSV pour ${tokens.length} tokens sur ${days} jour(s)`);

  for (const [sourceKey, srcConf] of Object.entries(sources)) {
    const scriptFile = srcConf.script;
    const scriptPath = path.resolve(scriptsDir, scriptFile);
    if (!await fileExists(scriptPath)) {
      console.warn(`  Script non trouvé pour source ${sourceKey}: ${scriptFile}, on passe.`);
      continue;
    }
    const outputFilename = srcConf.outputFilename;
    const marketPattern = srcConf.marketPattern;
    if (!outputFilename || !marketPattern) {
      console.warn(`  Config incomplète pour source ${sourceKey}, on attend outputFilename et marketPattern`);
      continue;
    }

    for (const token of tokens) {
      // Construire marché
      const market = marketPattern.replace(/<TOKEN>/g, token);
      console.log(`\n→ Source="${sourceKey}", token="${token}", marché="${market}"`);
      // Supprimer un ancien fichier de sortie s’il existe, pour éviter réutilisation
      const generatedPath = path.resolve(scriptsDir, outputFilename);
      if (await fileExists(generatedPath)) {
        await fs.promises.unlink(generatedPath);
      }
      // Exécuter le script
      const ok = await runScript(scriptPath, market, days);
      if (!ok) {
        console.warn(`  Échec génération pour ${sourceKey}/${token}, on continue.`);
        continue;
      }
      // Vérifier la présence du CSV
      if (!await fileExists(generatedPath)) {
        console.warn(`  Fichier attendu non trouvé après exécution: ${outputFilename}`);
        continue;
      }
      // Déplacer/renommer vers outputDir/<token>-<sourceKey>.csv
      const destName = `${token.toLowerCase()}-${sourceKey}.csv`;
      const destPath = path.join(outputDir, destName);
      try {
        // S’il existe déjà, on écrase
        if (await fileExists(destPath)) {
          await fs.promises.unlink(destPath);
        }
        await fs.promises.rename(generatedPath, destPath);
        console.log(`  → CSV déplacé: ${path.relative(scriptsDir, destPath)}`);
      } catch (err) {
        console.error(`  Erreur déplacement ${outputFilename} -> ${destName}:`, err);
      }
    }
  }

  console.log('\nToutes les tâches terminées.');
}

main().catch(err => {
  console.error('Erreur inattendue dans orchestrateur:', err);
  process.exit(1);
});
