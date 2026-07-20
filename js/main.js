/* Ashwin Thomas Paul — portfolio interactions.
   All scroll work batches into a single requestAnimationFrame tick. */
(function () {
  "use strict";

  /* Grainient backdrops — Debatly's exact presets (dark & light) */
  var GRAIN_DARK = {
    color1: "#171413", color2: "#2d2926", color3: "#3a3834",
    colorBalance: 0.12, grainAmount: 0.12, contrast: 1.25, saturation: 0.75
  };
  var initIf = function (id, opts) {
    var el = document.getElementById(id);
    if (el && window.initGrainient) initGrainient(el, opts);
  };
  initIf("grain-hero", GRAIN_DARK);
  initIf("grain-works", GRAIN_DARK);
  initIf("grain-projects", GRAIN_DARK);
  initIf("grain-closing", GRAIN_DARK);
  initIf("grain-page", {});    /* light grainient behind every light surface */

  /* Seamless marquee: duplicate track content once */
  var track = document.getElementById("marquee-track");
  if (track) track.innerHTML += track.innerHTML;

  /* Hero video: nudge autoplay (some engines want an explicit play() call) */
  var heroVid = document.querySelector(".tile-video video");
  if (heroVid) {
    heroVid.muted = true;
    var tryPlay = function () { heroVid.play().catch(function () {}); };
    tryPlay();
    document.addEventListener("click", tryPlay, { once: true });
    document.addEventListener("scroll", tryPlay, { once: true, passive: true });
  }

  /* Sound toggle on the hero video */
  var vol = document.getElementById("hero-vol");
  if (vol && heroVid) {
    vol.addEventListener("click", function (e) {
      e.stopPropagation();
      heroVid.muted = !heroVid.muted;
      if (!heroVid.muted) heroVid.play().catch(function () {});
      vol.classList.toggle("muted", heroVid.muted);
    });
  }

  /* Scroll reveals (IntersectionObserver — no scroll listener) */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
  document.querySelectorAll(".reveal, .stagger").forEach(function (el) { io.observe(el); });

  /* ---- single rAF-batched scroll pipeline ---- */
  var head = document.querySelector(".site-head");
  var hero = document.querySelector(".hero");
  var heroH = hero ? hero.offsetHeight : 0;

  var fill = document.getElementById("fillwords");
  var spans = [], lastLit = -1;
  if (fill) {
    var words = fill.textContent.trim().split(/\s+/);
    fill.innerHTML = words.map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
    spans = Array.prototype.slice.call(fill.querySelectorAll(".w"));
  }

  var navLinks = document.querySelectorAll(".pill-nav a");
  var sections = [];
  navLinks.forEach(function (a) {
    var id = a.getAttribute("href");
    if (id && id.charAt(0) === "#" && id.length > 1) {
      var el = id === "#top" ? document.body : document.getElementById(id.slice(1));
      if (el) sections.push({ a: a, el: el });
    } else if (id === "filmmaking.html") {
      /* on the home page, the film band lights up the Film pill while scrolling */
      var band = document.querySelector(".filmstrip-band");
      if (band) sections.push({ a: a, el: band });
    }
  });
  function measure() {
    heroH = hero ? hero.offsetHeight : 0;
  }
  measure();
  window.addEventListener("resize", function () { measure(); requestAnimationFrame(frame); });
  window.addEventListener("load", function () { measure(); requestAnimationFrame(frame); });

  var headY = 0;
  function frame() {
    var y = window.scrollY;

    /* header inverts over the dark hero */
    if (head && hero) head.classList.toggle("inv", y < heroH - 70);

    /* header tucks away scrolling down, returns scrolling up */
    if (head) {
      if (y > headY + 4 && y > 280) head.classList.add("tucked");
      else if (y < headY - 4 || y <= 280) head.classList.remove("tucked");
      headY = y;
    }

    /* active nav = deepest passed section, measured live so lazy media
       loading can never leave the cached positions stale */
    if (sections.length) {
      var probe = window.innerHeight * 0.35;
      var current = sections[0], best = -Infinity;
      sections.forEach(function (s) {
        var top = s.el === document.body ? -y : s.el.getBoundingClientRect().top;
        if (top <= probe && top > best) { best = top; current = s; }
      });
      navLinks.forEach(function (a) { a.classList.remove("active"); });
      current.a.classList.add("active");
    }

    /* statement word fill — touch the DOM only when the count changes */
    if (fill && spans.length) {
      var r = fill.getBoundingClientRect();
      var vh = window.innerHeight;
      var progress = Math.max(0, Math.min(1, (vh * 0.82 - r.top) / (r.height + vh * 0.35)));
      var lit = Math.floor(progress * spans.length);
      if (lit !== lastLit) {
        var from = Math.min(lit, lastLit < 0 ? 0 : lastLit);
        var to = Math.max(lit, lastLit < 0 ? 0 : lastLit);
        for (var i = from; i < to; i++) spans[i].classList.toggle("on", i < lit);
        lastLit = lit;
      }
    }
    ticking = false;
  }
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  frame();

  /* Works filter */
  var buttons = document.querySelectorAll(".fbtn");
  var cards = document.querySelectorAll(".work-card");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var f = btn.getAttribute("data-filter");
      cards.forEach(function (c) {
        var cats = (c.getAttribute("data-cat") || "").split(/\s+/);
        c.classList.toggle("hide", !(f === "all" || cats.indexOf(f) > -1));
      });
      measure(); /* section tops moved */
    });
  });

  /* Filmmaking: play looping clips only while on screen (keeps 20+ videos light) */
  var filmVids = document.querySelectorAll("video[data-auto]");
  if (filmVids.length && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) { v.play().catch(function () {}); }
        else { v.pause(); }
      });
    }, { threshold: 0.25 });
    filmVids.forEach(function (v) { v.muted = true; vio.observe(v); });
  }

  /* Footer year */
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();
})();
