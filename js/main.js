/* ===== Mobile Menu ===== */
var WHATSAPP_URL = 'https://wa.me/5584986288215?text=Ol%C3%A1%2C%20vim%20pelo%20Site%2C%20gostaria%20de%20ter%20mais%20informa%C3%A7%C3%B5es%20sobre%20os%20im%C3%B3veis!';

function setMenu(open) {
  var nav = document.getElementById('navMenu');
  var hamburger = document.getElementById('hamburger');
  if (!nav || !hamburger) return;
  nav.classList.toggle('active', open);
  hamburger.classList.toggle('active', open);
  document.body.classList.toggle('menu-open', open);
  hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
  hamburger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}

function toggleMenu() {
  setMenu(!document.getElementById('navMenu').classList.contains('active'));
}

(function setupMobileMenu() {
  var nav = document.getElementById('navMenu');
  if (!nav) return;

  /* CTA de WhatsApp no fim do menu (visível só no mobile) */
  var cta = document.createElement('a');
  cta.href = WHATSAPP_URL;
  cta.target = '_blank';
  cta.rel = 'noopener';
  cta.className = 'btn btn-gold nav-cta';
  cta.innerHTML = '<i class="fab fa-whatsapp"></i> Simule seu financiamento';
  nav.appendChild(cta);

  /* Fundo escurecido atrás do menu; toque fora fecha */
  var backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  backdrop.addEventListener('click', function() { setMenu(false); });
  document.body.appendChild(backdrop);

  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) setMenu(false);
  });
})();

/* ===== Mobile Dropdown Toggle ===== */
document.querySelectorAll('.nav-dropdown-toggle').forEach(function(toggle) {
  toggle.addEventListener('click', function(e) {
    e.preventDefault();
    var open = this.parentElement.classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
});

/* Close menu on link click */
document.querySelectorAll('.nav-menu a:not(.nav-dropdown-toggle)').forEach(function(link) {
  link.addEventListener('click', function() { setMenu(false); });
});

/* ===== Header Scroll Effect ===== */
window.addEventListener('scroll', function() {
  var header = document.getElementById('header');
  if (window.scrollY > 80) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

/* ===== Smooth Scroll for Anchor Links ===== */
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
  anchor.addEventListener('click', function(e) {
    var targetId = this.getAttribute('href');
    if (targetId === '#') return;
    var target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      var headerH = document.getElementById('header').offsetHeight;
      var top = target.getBoundingClientRect().top + window.pageYOffset - headerH - 20;
      window.scrollTo({ top: top, behavior: 'smooth' });
    }
  });
});

/* ===== Contact Form → WhatsApp ===== */
function handleContactForm(e) {
  e.preventDefault();
  var form = e.target;
  var nome = (form.querySelector('[name="nome"]').value || '').trim();
  var whatsapp = (form.querySelector('[name="whatsapp"]').value || '').trim();
  var mensagemEl = form.querySelector('[name="mensagem"]');
  var mensagem = mensagemEl ? mensagemEl.value.trim() : '';
  var imovelEl = form.querySelector('[name="imovel"]');
  var imovel = imovelEl ? imovelEl.value : '';

  if (!nome || !whatsapp) {
    alert('Por favor, preencha seu nome e WhatsApp.');
    return;
  }

  var text = 'Olá! Meu nome é ' + nome + '.';
  if (imovel) {
    text += ' Tenho interesse na ' + imovel + '.';
  }
  if (mensagem) {
    text += ' ' + mensagem;
  }
  text += ' Meu WhatsApp: ' + whatsapp;

  var url = 'https://api.whatsapp.com/send?phone=5584986288215&text=' + encodeURIComponent(text);
  window.open(url, '_blank');
}

/* ===== Lightbox ===== */
var lightboxImages = [];
var lightboxIndex = 0;

function openLightbox(img) {
  var lightbox = document.getElementById('lightbox');
  var group = img.closest('.gallery-slides');
  lightboxImages = group ? Array.prototype.slice.call(group.querySelectorAll('img')) : [img];
  lightboxIndex = lightboxImages.indexOf(img);
  ensureLightboxArrows(lightbox);
  updateLightboxImg();
  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function ensureLightboxArrows(lightbox) {
  if (!lightbox.querySelector('.lightbox-arrow')) {
    ['prev', 'next'].forEach(function(dir) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lightbox-arrow lightbox-' + dir;
      btn.setAttribute('aria-label', dir === 'prev' ? 'Imagem anterior' : 'Próxima imagem');
      btn.innerHTML = '<i class="fas fa-chevron-' + (dir === 'prev' ? 'left' : 'right') + '"></i>';
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        navigateLightbox(dir === 'prev' ? -1 : 1);
      });
      lightbox.appendChild(btn);
    });
  }
  lightbox.querySelectorAll('.lightbox-arrow').forEach(function(btn) {
    btn.style.display = lightboxImages.length > 1 ? '' : 'none';
  });
}

function navigateLightbox(dir) {
  if (lightboxImages.length < 2) return;
  lightboxIndex = (lightboxIndex + dir + lightboxImages.length) % lightboxImages.length;
  updateLightboxImg();
}

function updateLightboxImg() {
  var lightboxImg = document.getElementById('lightboxImg');
  lightboxImg.src = lightboxImages[lightboxIndex].src;
  lightboxImg.alt = lightboxImages[lightboxIndex].alt;
}

function closeLightbox() {
  var lightbox = document.getElementById('lightbox');
  lightbox.classList.remove('active');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function(e) {
  var lightbox = document.getElementById('lightbox');
  var lightboxOpen = lightbox && lightbox.classList.contains('active');
  if (e.key === 'Escape') {
    closeLightbox();
    setMenu(false);
  } else if (lightboxOpen && e.key === 'ArrowLeft') {
    navigateLightbox(-1);
  } else if (lightboxOpen && e.key === 'ArrowRight') {
    navigateLightbox(1);
  }
});

/* ===== Property Gallery Slider ===== */
document.querySelectorAll('.gallery-slider').forEach(function(slider) {
  var imgs = slider.querySelectorAll('.gallery-slides img');
  if (!imgs.length) return;
  var dotsWrap = slider.querySelector('.gallery-dots');
  var current = 0;

  imgs.forEach(function(_, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'gallery-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Ver imagem ' + (i + 1) + ' de ' + imgs.length);
    dot.addEventListener('click', function() { show(i); });
    dotsWrap.appendChild(dot);
  });

  function show(i) {
    imgs[current].classList.remove('active');
    dotsWrap.children[current].classList.remove('active');
    current = (i + imgs.length) % imgs.length;
    imgs[current].classList.add('active');
    dotsWrap.children[current].classList.add('active');
  }

  slider.querySelector('.gallery-prev').addEventListener('click', function() { show(current - 1); });
  slider.querySelector('.gallery-next').addEventListener('click', function() { show(current + 1); });
  onSwipe(slider, function(dir) { show(current + dir); });
});

/* ===== Swipe (touch) ===== */
/* Chama cb(+1) ao deslizar para a esquerda e cb(-1) para a direita */
function onSwipe(el, cb) {
  var x0 = null, y0 = null;
  el.addEventListener('touchstart', function(e) {
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });
  el.addEventListener('touchend', function(e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    var dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      cb(dx < 0 ? 1 : -1);
    }
  }, { passive: true });
}

(function() {
  var lightbox = document.getElementById('lightbox');
  if (lightbox) onSwipe(lightbox, navigateLightbox);
})();

/* ===== Carrosséis mobile (scroll-snap) com indicadores ===== */
document.querySelectorAll('.imoveis-grid, .depoimentos-grid').forEach(function(track) {
  var items = track.children;
  if (items.length < 2) return;
  var dots = document.createElement('div');
  dots.className = 'snap-dots';
  Array.prototype.forEach.call(items, function(item, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', 'Ir para o item ' + (i + 1) + ' de ' + items.length);
    dot.addEventListener('click', function() {
      track.scrollTo({ left: item.offsetLeft - track.offsetLeft - parseFloat(getComputedStyle(track).paddingLeft), behavior: 'smooth' });
    });
    dots.appendChild(dot);
  });
  track.parentNode.insertBefore(dots, track.nextSibling);

  function update() {
    var maxScroll = track.scrollWidth - track.clientWidth;
    var idx = maxScroll > 0 ? Math.round((track.scrollLeft / maxScroll) * (items.length - 1)) : 0;
    Array.prototype.forEach.call(dots.children, function(d, i) { d.classList.toggle('active', i === idx); });
  }
  track.addEventListener('scroll', function() { requestAnimationFrame(update); }, { passive: true });
  update();
});

/* ===== Navegação por anos: centraliza o ano atual no mobile ===== */
(function() {
  var nav = document.querySelector('.year-nav');
  var active = nav && nav.querySelector('a.active');
  if (active && nav.scrollWidth > nav.clientWidth) {
    nav.scrollLeft = active.offsetLeft - nav.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }
})();

/* ===== WhatsApp Phone Mask (optional) ===== */
document.querySelectorAll('input[name="whatsapp"]').forEach(function(input) {
  input.addEventListener('input', function(e) {
    var v = e.target.value.replace(/\D/g, '');
    if (v.length <= 2) {
      e.target.value = v.length ? '(' + v : '';
    } else if (v.length <= 7) {
      e.target.value = '(' + v.substring(0, 2) + ') ' + v.substring(2);
    } else {
      e.target.value = '(' + v.substring(0, 2) + ') ' + v.substring(2, 7) + '-' + v.substring(7, 11);
    }
  });
});

/* ===== Scroll Reveal (fade-in on scroll) ===== */
var REVEAL_SELECTOR = '.spec-item, .fin-card, .location-card, .depoimento-card, .destaque-item, .imovel-card, .timeline-item, .empreend-feature-card';

function revealOnScroll() {
  var elements = document.querySelectorAll(REVEAL_SELECTOR);
  elements.forEach(function(el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight - 60) {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }
  });
}

/* Initialize reveal elements */
document.querySelectorAll(REVEAL_SELECTOR).forEach(function(el) {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
});

window.addEventListener('scroll', revealOnScroll);
window.addEventListener('load', revealOnScroll);

/* ===== Stats Counter Animation ===== */
function animateCounter(el) {
  var target = parseInt(el.getAttribute('data-count'), 10);
  var prefix = el.getAttribute('data-prefix') || '';
  var suffix = el.getAttribute('data-suffix') || '';
  var duration = 1400;
  var start = null;

  function format(n) {
    return n.toLocaleString('pt-BR');
  }

  function step(timestamp) {
    if (!start) start = timestamp;
    var progress = Math.min((timestamp - start) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = prefix + format(Math.round(target * eased)) + suffix;
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

if ('IntersectionObserver' in window) {
  var statsObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        statsObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  document.querySelectorAll('.stat-num[data-count]').forEach(function(el) {
    statsObserver.observe(el);
  });
}
