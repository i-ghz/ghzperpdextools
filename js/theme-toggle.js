// js/theme-toggle.js

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle');
    const body      = document.body;
  
    // Applique le thème enregistré (dark/light)
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') body.classList.add('dark');
  
    // Met à jour l’icône du bouton
    const updateIcon = () => {
      toggleBtn.textContent = body.classList.contains('dark') ? '☀️' : '🌙';
    };
    updateIcon();
  
    // Bascule thème au clic
    toggleBtn.addEventListener('click', () => {
      body.classList.toggle('dark');
      const mode = body.classList.contains('dark') ? 'dark' : 'light';
      localStorage.setItem('theme', mode);
      updateIcon();
    });
  });
  