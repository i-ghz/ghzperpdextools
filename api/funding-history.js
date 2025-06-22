// Fichier : api/funding-history.js

const { createClient } = require('@supabase/supabase-js');

// Récupère les valeurs via process.env (penser à les configurer sur Vercel)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // --- IMPORTANT pour Vercel : Gestion des CORS ---
  // Autorise les requêtes provenant de n'importe quelle origine
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Si c'est une requête OPTIONS (pré-vérification du navigateur), on répond OK
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol = 'BTC', source = 'vest', days = '30' } = req.query;
  const daysInt = parseInt(days);
  const since = new Date(Date.now() - daysInt * 24 * 3600 * 1000).toISOString();

  try {
    const { data, error } = await supabase
      .from('funding_history')
      .select('date, funding_rate')
      .eq('symbol', symbol)
      .eq('source', source)
      .gte('date', since)
      .order('date', { ascending: true });

    if (error) {
      throw error;
    }

    // On renvoie les données avec un cache de 5 minutes
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.status(200).json(data);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};