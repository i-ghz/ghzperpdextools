const fetch = require('node-fetch');

// Tester la récupération des funding rates depuis Paradex
async function testParadex() {
    const market = 'BTC-USD-PERP';  // Exemple de marché
    const url = `http://localhost:3000/paradex-funding?market=${market}`;  // Utilise ton serveur local

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Données de Paradex pour", market, ":", data);
    } catch (error) {
        console.error("Erreur lors de la récupération des données de Paradex:", error);
    }
}

// Tester la récupération des funding rates depuis Vest Exchange
async function testVest() {
    const symbol = 'BTC-PERP';  // Exemple de marché
    const url = `http://localhost:3000/vest-funding?symbol=${symbol}`;  // Utilise ton serveur local

    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log("Données de Vest Exchange pour", symbol, ":", data);
    } catch (error) {
        console.error("Erreur lors de la récupération des données de Vest Exchange:", error);
    }
}

// Tester les deux APIs
testParadex();
testVest();
