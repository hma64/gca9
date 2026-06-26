document.addEventListener('DOMContentLoaded', function() {
  const container = document.querySelector('.floating-contact-container');
  const mainBtn = document.getElementById('floatingContactMainBtn');
  const buttonsMenu = document.getElementById('floatingContactButtons');
  
  // On récupère spécifiquement le bouton téléphone à l'intérieur du menu
  const phoneBtn = document.querySelector('.floating-contact-btn.phone');
  const phoneNumber = '+21694827228';

  if (container) {
    // Transition fluide pour l'apparition/disparition du conteneur entier
    container.style.transition = 'opacity 0.4s ease, visibility 0.4s ease, transform 0.4s ease';
    
    let ticking = false;

    const updateVisibility = () => {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      
      // Seuil de 250px
      if (scrollY > 250) {
        container.style.opacity = '0';
        container.style.visibility = 'hidden';
        container.style.transform = 'translateY(20px)';
        container.style.pointerEvents = 'none';
        
        // Fermer le menu si le bouton disparaît
        if (mainBtn && buttonsMenu) {
          buttonsMenu.classList.remove('active');
          mainBtn.classList.remove('active');
        }
      } else {
        container.style.opacity = '1';
        container.style.visibility = 'visible';
        container.style.transform = 'translateY(0)';
        container.style.pointerEvents = 'auto';
      }
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateVisibility);
        ticking = true;
      }
    };

    updateVisibility();
    
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
  }

  // Gestion de l'ouverture/fermeture du menu (WhatsApp, Insta, etc.)
  if (mainBtn && buttonsMenu) {
    mainBtn.addEventListener('click', function() {
      buttonsMenu.classList.toggle('active');
      mainBtn.classList.toggle('active');
      
      const svg = mainBtn.querySelector('svg');
      if (mainBtn.classList.contains('active')) {
        svg.innerHTML = '<path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      } else {
        svg.innerHTML = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      }
    });

    // Fermeture lors d'un clic à l'extérieur
    document.addEventListener('click', function(event) {
      if (!mainBtn.contains(event.target) && !buttonsMenu.contains(event.target)) {
        buttonsMenu.classList.remove('active');
        mainBtn.classList.remove('active');
        const svg = mainBtn.querySelector('svg');
        if (svg) {
          svg.innerHTML = '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        }
      }
    });
  }

  // CORRECTION : S'assurer que le bouton téléphone lance bien l'appel
  if (phoneBtn) {
    phoneBtn.setAttribute('href', 'tel:' + phoneNumber);
  }
});
