// Fichier : api/trigger-all-updates.js

// IMPORTANT : Assurez-vous que cette liste est synchronisée avec la liste
// que vous voulez réellement suivre. Idéalement, elle vient de votre config.json.
const TOKENS = [
    "AAVE", "ADA", "AI16Z", "AIXBT", "ALCH", "ANIME", "APT", "AR", 
    "ARB", "ATOM", "AVAX", "BCH", "BERA", "BNB", "BRETT", "BTC", 
    "CRV", "DOGE", "DOT", "DYDX", "EIGEN", "ENA", "ETC", "ETH", 
    "ETHFI", "EUR", "FARTCOIN", "FET", "FIL", "FTM", "GOAT", 
    "GRASS", "GRIFFAIN", "HYPE", "HYPER", "INIT", "INJ", "IO", 
    "IP", "JTO", "JUP", "KAITO", "KBONK", "KFLOKI", "KNEIRO", 
    "KPEPE", "KSHIB", "LAUNCHCOIN", "LAYER", "LDO", "LINK", 
    "LTC", "MATIC", "MELANIA", "MEME", "MEW", "MKR", "MNT", 
    "MOODENG", "MORPHO", "MOVE", "NEAR", "NIL", "NOT", "NXPC", 
    "OM", "ONDO", "OP", "ORDI", "PAXG", "PENDLE", "PENGU", "PNUT", 
    "POPCAT", "PROMPT", "PYTH", "RENDER", "RESOLV", "RUNE", "S", 
    "SCR", "SEI", "SOL", "SOPH", "SPX", "STRK", "SUI", "TAO", "TIA", 
    "TON", "TRB", "TRUMP", "TRX", "TST", "TURBO", "UNI", "USUAL", 
    "VINE", "VIRTUAL", "VVV", "W", "WAL", "WCT", "WIF", "WLD", 
    "XLM", "XRP", "ZEREBRO", "ZK", "ZRO", "ZORA"
];
const SOURCES = ["paradex", "hyperliquid", "vest", "extended"];


export default async function handler(request, response) {
  // Sécurise la fonction pour qu'elle ne soit appelable qu'avec le bon secret
  if (request.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).end('Unauthorized');
  }

  // Vercel fournit automatiquement le domaine de votre application
  const vercelDomain = process.env.VERCEL_URL;
  if(!vercelDomain) {
      return response.status(500).end('VERCEL_URL environment variable is not set.');
  }

  console.log(`[TRIGGER] Démarrage du déclenchement pour ${TOKENS.length} tokens et ${SOURCES.length} sources.`);

  // Boucle sur chaque combinaison et déclenche le worker
  for (const token of TOKENS) {
    for (const source of SOURCES) {
      // On déclenche l'appel au worker SANS attendre la réponse ('fire and forget').
      // C'est crucial pour que cette fonction se termine rapidement et ne dépasse pas les délais de Vercel.
      fetch(`https://${vercelDomain}/api/update-single-csv?token=${token}&source=${source}`, {
          method: 'GET',
          headers: {
              Authorization: `Bearer ${process.env.CRON_SECRET}`
          }
      }).catch(err => console.error(`[TRIGGER] Erreur lors du déclenchement pour ${token}-${source}:`, err.message));
    }
  }

  // On répond immédiatement que les tâches ont été acceptées et lancées en arrière-plan.
  response.status(202).end('Accepted: All update jobs have been triggered.');
}
// Un commentaire pour forcer le déploiement