// public/js/favorite.js
window.favorites = (function(){
    const STORAGE_KEY = "funding_watchlist";
    function load(){
      try {
        const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (Array.isArray(v)) return v;
      } catch{}
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    function save(arr){
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    }
    function all(){ return load(); }
    function isFav(symbol){
      return load().indexOf(symbol) !== -1;
    }
    function toggle(symbol){
      const list = load();
      const idx = list.indexOf(symbol);
      if (idx >= 0) list.splice(idx,1);
      else list.push(symbol);
      save(list);
    }
    return { all, isFav, toggle };
  })();
  