/* ==========================================================================
   MAIN — vanilla JS modules. No framework, no build step.
   Order matters only in init(); each module is independent and fails soft.
   ========================================================================== */
(function () {
  "use strict";

  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------
     HTML PARTIALS — keeps header/footer in exactly one file.
     Runs first and awaits completion, since every other module binds
     to elements that only exist after injection.
     ------------------------------------------------------------------ */
  function loadPartials() {
    var nodes = document.querySelectorAll("[data-include]");
    if (!nodes.length) return Promise.resolve();

    return Promise.all(Array.prototype.map.call(nodes, function (node) {
      var url = node.getAttribute("data-include");
      return fetch(url)
        .then(function (r) {
          if (!r.ok) throw new Error(r.status + " " + url);
          return r.text();
        })
        .then(function (html) { node.innerHTML = html; })
        .catch(function (err) {
          console.warn("[include] failed:", err.message);
          // Fail soft: a missing partial must never blank the page.
          node.innerHTML = "";
        });
    }));
  }

  /* ------------------------------------------------------------------
     SMOOTH SCROLL (Lenis)
     ------------------------------------------------------------------ */
  var lenis = null;

  function initLenis() {
    if (prefersReduced || typeof window.Lenis === "undefined") return;

    // Touch devices keep their native scroller: momentum there is already
    // native-feeling, and overriding it is what makes a site feel hijacked.
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) return;

    lenis = new window.Lenis({
      // ~0.8s settle: enough to smooth wheel steps without ever feeling
      // like the page is catching up with the user.
      duration: 0.8,
      easing: function (t) { return 1 - Math.pow(1 - t, 3); }, // ease-out cubic
      smoothWheel: true,
      syncTouch: false,     // never intercept touch scrolling
      touchMultiplier: 1,
      wheelMultiplier: 1,
      // Let the browser handle anything with its own internal scroll.
      prevent: function (node) {
        return node.closest("[data-lenis-prevent], .slider__viewport, .drawer") !== null;
      }
    });

    // Single rAF loop drives Lenis; nothing else should start its own.
    var rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // Stop the loop when the tab is hidden; resume on return.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) cancelAnimationFrame(rafId);
      else rafId = requestAnimationFrame(raf);
    });

    window.lenis = lenis;
  }

  /* Anchor links routed through Lenis, offset for the sticky header. */
  function initAnchors() {
    document.addEventListener("click", function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var id = link.getAttribute("href");
      if (!id || id === "#" || id.length < 2) return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      var offset = -(document.getElementById("siteHeader") || {}).offsetHeight || -80;

      if (lenis) {
        lenis.scrollTo(target, { offset: offset });
      } else {
        var top = target.getBoundingClientRect().top + window.pageYOffset + offset;
        window.scrollTo({ top: top, behavior: prefersReduced ? "auto" : "smooth" });
      }
      history.replaceState(null, "", id);
    });
  }

  /* ------------------------------------------------------------------
     HEADER — stuck state + scroll progress, batched in one rAF loop
     ------------------------------------------------------------------ */
  function initScrollUI() {
    var header = document.getElementById("siteHeader");
    var bar = document.querySelector(".progress-bar");
    var toTop = document.querySelector(".back-to-top");
    var ticking = false;

    // On the homepage the header floats over the hero until scrolled.
    var hero = document.querySelector("[data-hero]");
    if (header && hero) header.classList.add("is-over-hero");

    function update() {
      // Lenis translates content rather than moving the native scroll
      // position, so pageYOffset stays ~0 while it drives and the header
      // would never leave its transparent state. Read Lenis's own value
      // when it is running, otherwise the native one.
      var y = (lenis && typeof lenis.scroll === "number")
        ? lenis.scroll
        : (window.pageYOffset || document.documentElement.scrollTop || 0);

      if (header) {
        var solid = hero ? y > Math.max(hero.offsetHeight - 120, 80) : y > 8;
        header.classList.toggle("is-stuck", solid);
        if (hero) header.classList.toggle("is-over-hero", !solid);
      }
      if (toTop) toTop.classList.toggle("is-visible", y > 600);

      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = "scaleX(" + (h > 0 ? Math.min(y / h, 1) : 0) + ")";
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    if (lenis && typeof lenis.on === "function") lenis.on("scroll", onScroll);

    update();

    if (toTop) {
      toTop.addEventListener("click", function () {
        if (lenis) lenis.scrollTo(0);
        else window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
      });
    }
  }

  /* ------------------------------------------------------------------
     HERO SLIDER
     Exactly 5s per slide, infinite loop, manual prev/next, dots,
     pause when the tab is hidden. Hover does not pause: autoplay must
     keep running with the cursor resting over the hero.

     The interval is torn down and recreated on every change so a manual
     click always restarts a full 5s dwell rather than inheriting the
     remainder of the previous one.
     ------------------------------------------------------------------ */
  var SLIDE_MS = 5000;

  function initHeroSlider() {
    var root = document.querySelector("[data-hero]");
    if (!root) return;

    var slides = Array.prototype.slice.call(root.querySelectorAll(".hero__slide"));
    var dots   = Array.prototype.slice.call(root.querySelectorAll(".hero__dot"));
    var prev   = root.querySelector("[data-hero-prev]");
    var next   = root.querySelector("[data-hero-next]");
    var curEl  = root.querySelector("[data-hero-current]");
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;

    function paint() {
      slides.forEach(function (s, i) {
        s.classList.toggle("is-active", i === index);
        s.setAttribute("aria-hidden", String(i !== index));
      });

      dots.forEach(function (d, i) {
        var active = i === index;
        // Re-setting the attribute restarts the 5s progress animation.
        d.setAttribute("aria-current", String(active));
        if (active) {
          d.style.animation = "none";
          void d.offsetWidth; // force reflow so the keyframe replays
          d.style.animation = "";
        }
      });

      if (curEl) curEl.textContent = String(index + 1).padStart(2, "0");
    }

    function go(to) {
      index = (to + slides.length) % slides.length; // infinite both ways
      paint();
      restart();
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function restart() {
      stop();
      if (document.hidden || prefersReduced) return;
      timer = setInterval(function () { go(index + 1); }, SLIDE_MS);
    }

    function setPaused(paused) {
      dots.forEach(function (d) { d.classList.toggle("is-paused", paused); });
    }

    if (next) next.addEventListener("click", function () { go(index + 1); });
    if (prev) prev.addEventListener("click", function () { go(index - 1); });

    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { go(i); });
    });

    // Pause when the tab is hidden, resume when it returns.
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { stop(); setPaused(true); }
      else { setPaused(false); restart(); }
    });

    // Keyboard support on the slider region.
    root.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
    });

    paint();
    restart();
  }

  /* ------------------------------------------------------------------
     DESKTOP DROPDOWN (About Us)
     CSS handles hover; JS adds click-toggle and keyboard support so the
     menu is reachable without a pointer. The parent label stays a real
     link, so the caret button owns the expand/collapse state.
     ------------------------------------------------------------------ */
  function initDropdowns() {
    var items = document.querySelectorAll("[data-dropdown]");
    if (!items.length) return;

    function closeAll(except) {
      items.forEach(function (item) {
        if (item === except) return;
        var btn = item.querySelector("[data-dropdown-toggle]");
        var menu = item.querySelector(".submenu");
        if (btn) btn.setAttribute("aria-expanded", "false");
        if (menu) menu.classList.remove("is-open");
      });
    }

    items.forEach(function (item) {
      var btn = item.querySelector("[data-dropdown-toggle]");
      var menu = item.querySelector(".submenu");
      if (!btn || !menu) return;

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var open = btn.getAttribute("aria-expanded") === "true";
        closeAll(item);
        btn.setAttribute("aria-expanded", String(!open));
        menu.classList.toggle("is-open", !open);
        if (!open) {
          var first = menu.querySelector("a");
          if (first) first.focus();
        }
      });

      // Arrow keys walk the submenu; Escape returns focus to the caret.
      item.addEventListener("keydown", function (e) {
        var links = Array.prototype.slice.call(menu.querySelectorAll("a"));
        var idx = links.indexOf(document.activeElement);

        if (e.key === "Escape") {
          btn.setAttribute("aria-expanded", "false");
          menu.classList.remove("is-open");
          btn.focus();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          btn.setAttribute("aria-expanded", "true");
          menu.classList.add("is-open");
          (links[idx + 1] || links[0]).focus();
        } else if (e.key === "ArrowUp" && idx > -1) {
          e.preventDefault();
          (links[idx - 1] || links[links.length - 1]).focus();
        }
      });

      // Closing on focus leaving the item keeps tabbing-through sane.
      item.addEventListener("focusout", function (e) {
        if (!item.contains(e.relatedTarget)) {
          btn.setAttribute("aria-expanded", "false");
          menu.classList.remove("is-open");
        }
      });
    });

    // Click anywhere outside closes every open dropdown.
    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-dropdown]")) closeAll(null);
    });
  }

  /* ------------------------------------------------------------------
     MOBILE DRAWER
     Handles: animated open/close, nested About Us submenu, outside
     click, link selection, Escape, body scroll lock + restore, and a
     focus trap. `inert` keeps the closed drawer out of the tab order.
     ------------------------------------------------------------------ */
  function initDrawer() {
    var burger = document.getElementById("burger") || document.querySelector(".burger");
    var drawer = document.getElementById("mobileDrawer");
    var overlay = document.querySelector(".overlay");
    if (!burger || !drawer) return;

    var scrollY = 0;
    var isOpen = false;

    function setOpen(open) {
      if (open === isOpen) return;
      isOpen = open;

      drawer.classList.toggle("is-open", open);
      drawer.setAttribute("aria-hidden", String(!open));
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");

      // inert is ignored by older browsers, which still get aria-hidden.
      if (open) drawer.removeAttribute("inert");
      else drawer.setAttribute("inert", "");

      if (overlay) {
        overlay.hidden = false;
        overlay.classList.toggle("is-open", open);
      }

      if (open) {
        // position:fixed preserves the exact scroll position on iOS,
        // which a plain overflow:hidden does not.
        scrollY = window.pageYOffset;
        document.body.style.position = "fixed";
        document.body.style.top = -scrollY + "px";
        document.body.style.width = "100%";
        document.body.style.overflow = "hidden";
        if (lenis) lenis.stop();

        var first = drawer.querySelector("a, button");
        if (first) first.focus();
      } else {
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
        if (lenis) lenis.start();

        burger.focus();
      }
    }

    burger.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(!isOpen);
    });

    // Close buttons and the overlay
    document.querySelectorAll("[data-drawer-close]").forEach(function (el) {
      el.addEventListener("click", function () { setOpen(false); });
    });

    // Close after selecting a page
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { setOpen(false); });
    });

    // Close when clicking outside the drawer
    document.addEventListener("click", function (e) {
      if (!isOpen) return;
      if (drawer.contains(e.target) || burger.contains(e.target)) return;
      setOpen(false);
    });

    // Nested About Us submenu
    drawer.querySelectorAll("[data-drawer-toggle]").forEach(function (toggle) {
      var sub = document.getElementById(toggle.getAttribute("aria-controls"));
      if (!sub) return;
      toggle.addEventListener("click", function (e) {
        e.stopPropagation();
        var open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        toggle.setAttribute("aria-label", (open ? "Expand" : "Collapse") + " About Us submenu");
        sub.classList.toggle("is-open", !open);
      });
    });

    document.addEventListener("keydown", function (e) {
      if (!isOpen) return;

      if (e.key === "Escape") { setOpen(false); return; }

      if (e.key === "Tab") {
        // Only trap what is actually reachable — collapsed submenu
        // links are visibility:hidden and must be skipped.
        var f = Array.prototype.filter.call(
          drawer.querySelectorAll('a[href], button:not([disabled])'),
          function (el) { return el.offsetParent !== null; }
        );
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    // Leaving mobile width with the drawer open would strand the lock.
    window.addEventListener("resize", function () {
      if (isOpen && window.innerWidth >= 1024) setOpen(false);
    });
  }

  /* ------------------------------------------------------------------
     SCROLL REVEAL
     ------------------------------------------------------------------ */
  function initReveal() {
    var els = document.querySelectorAll("[data-reveal]");
    if (!els.length) return;

    // No observer, or the visitor asked for less motion: show everything.
    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target); // reveal once, then stop watching
      });
    }, {
      threshold: 0.1,
      // Fire slightly before the element is fully on screen so the motion
      // finishes as it arrives rather than after.
      rootMargin: "0px 0px -8% 0px"
    });

    els.forEach(function (el) {
      // Cards stagger against their stagger-tagged siblings only;
      // everything else reveals immediately once in view.
      if (el.hasAttribute("data-reveal-stagger")) {
        var sibs = Array.prototype.filter.call(
          el.parentElement.children,
          function (n) { return n.hasAttribute && n.hasAttribute("data-reveal-stagger"); }
        );
        var idx = sibs.indexOf(el);
        el.style.setProperty("--reveal-delay", Math.min(idx * 80, 400) + "ms");
      }
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------------
     ANIMATED COUNTERS
     ------------------------------------------------------------------ */
  function initCounters() {
    var els = document.querySelectorAll("[data-count]");
    if (!els.length) return;

    function run(el) {
      el.classList.add("is-counting"); // fade the digits in as counting starts
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      var dur = 1600;

      if (prefersReduced) {
        el.textContent = target.toLocaleString("en-IN") + suffix;
        return;
      }

      var start = null;
      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        el.textContent = Math.round(target * eased).toLocaleString("en-IN") + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    // Reduced motion (or no observer): paint final values at once, so the
    // figures are never left showing 0 for users who do not scroll here.
    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach(run);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        run(entry.target);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     ACCORDION
     ------------------------------------------------------------------ */
  function initAccordion() {
    document.querySelectorAll(".acc-trigger").forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var panel = document.getElementById(trigger.getAttribute("aria-controls"));
        var open = trigger.getAttribute("aria-expanded") === "true";
        var group = trigger.closest("[data-accordion-group]") || trigger.closest(".accordion");

        // Single-open behaviour within a group
        if (!open && group) {
          group.querySelectorAll('.acc-trigger[aria-expanded="true"]').forEach(function (other) {
            other.setAttribute("aria-expanded", "false");
            var op = document.getElementById(other.getAttribute("aria-controls"));
            if (op) op.classList.remove("is-open");
          });
        }

        trigger.setAttribute("aria-expanded", String(!open));
        if (panel) panel.classList.toggle("is-open", !open);
      });
    });
  }

  /* ------------------------------------------------------------------
     TESTIMONIAL SLIDER — continuous auto-scroll, pauses on hover/focus
     via CSS (animation-play-state). The track's slides are cloned once
     here (rather than duplicated by hand in the HTML) so the loop and
     the source list can never drift out of sync.

     The CSS animation used to translate by a flat -50%, assuming the
     clone exactly doubles the track's width. Any rounding in flex-basis
     or a font swap reflow after the clone ran was enough to put that
     midpoint a few pixels off the real seam, so the strip visibly ran
     out of cards and sat empty for a moment before jumping back. Instead
     we measure the real pixel width of one full set after the clone has
     been laid out, and drive the animation off that exact distance via
     a CSS custom property — so the loop point is always the true seam.
     ------------------------------------------------------------------ */
  function initSlider() {
    document.querySelectorAll("[data-testimonial-track]").forEach(function (track) {
      var slides = Array.prototype.slice.call(track.children);
      slides.forEach(function (slide) {
        var clone = slide.cloneNode(true);
        clone.setAttribute("aria-hidden", "true");
        track.appendChild(clone);
      });

      function measure() {
        var trackStyles = getComputedStyle(track);
        var gap = parseFloat(trackStyles.columnGap || trackStyles.gap) || 0;
        var distance = slides.reduce(function (sum, slide) {
          return sum + slide.getBoundingClientRect().width + gap;
        }, 0);
        track.style.setProperty("--marquee-distance", distance + "px");
        track.style.setProperty("--marquee-duration", Math.max(distance / 90, 10) + "s");
      }

      measure();
      window.addEventListener("resize", measure);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    });
  }

  /* ------------------------------------------------------------------
     SERVICE FINDER — the core UX fix. Live search + category filter
     over services.json, rendered client-side, zero backend.
     ------------------------------------------------------------------ */
  var SERVICES = null;

  function loadServices() {
    if (SERVICES) return Promise.resolve(SERVICES);
    return fetch("data/services.json")
      .then(function (r) { return r.json(); })
      .then(function (d) { SERVICES = d; return d; })
      .catch(function (e) { console.warn("[services]", e); return { categories: [], services: [] }; });
  }

  function serviceCard(s) {
    var href = "service-detail.html?s=" + s.slug;
    return (
      '<article class="service-card" data-reveal data-reveal-stagger>' +
        '<span class="service-card__icon" aria-hidden="true"><i class="ph ' + s.icon + '"></i></span>' +
        '<h3><a href="' + href + '">' + s.title + "</a></h3>" +
        "<p>" + s.excerpt + "</p>" +
        '<div class="service-card__foot">' +
          '<span class="service-card__time"><i class="ph ph-clock" aria-hidden="true"></i>' + (s.timeline || "") + "</span>" +
          '<a class="link-arrow" href="' + href + '">Details <i class="ph ph-arrow-right" aria-hidden="true"></i></a>' +
        "</div>" +
      "</article>"
    );
  }

  function initFinder() {
    var root = document.querySelector("[data-finder]");
    if (!root) return;

    var grid = root.querySelector("[data-finder-grid]");
    var input = root.querySelector("[data-finder-input]");
    var chipWrap = root.querySelector("[data-finder-chips]");
    var countEl = root.querySelector("[data-finder-count]");
    var limit = parseInt(root.getAttribute("data-finder"), 10) || 0;

    var state = { q: "", cat: "all" };

    loadServices().then(function (data) {
      // Build category chips
      if (chipWrap) {
        var chips = ['<button class="chip is-active" type="button" data-cat="all">All services</button>'];
        data.categories.forEach(function (c) {
          chips.push('<button class="chip" type="button" data-cat="' + c.id + '">' + c.label + "</button>");
        });
        chipWrap.innerHTML = chips.join("");

        chipWrap.addEventListener("click", function (e) {
          var chip = e.target.closest(".chip");
          if (!chip) return;
          chipWrap.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
          chip.classList.add("is-active");
          state.cat = chip.getAttribute("data-cat");
          render();
        });
      }

      if (input) {
        var t;
        input.addEventListener("input", function () {
          clearTimeout(t);
          t = setTimeout(function () {
            state.q = input.value.trim().toLowerCase();
            render();
          }, 120);
        });
      }

      // Deep link: /services.html#litigation preselects that category
      var hash = (location.hash || "").replace("#", "");
      if (hash && data.categories.some(function (c) { return c.id === hash; })) {
        state.cat = hash;
        if (chipWrap) {
          chipWrap.querySelectorAll(".chip").forEach(function (c) {
            c.classList.toggle("is-active", c.getAttribute("data-cat") === hash);
          });
        }
      }

      render();
    });

    function match(s) {
      if (state.cat !== "all" && s.category !== state.cat) return false;
      if (!state.q) return true;
      var hay = (s.title + " " + s.excerpt + " " + (s.keywords || []).join(" ")).toLowerCase();
      // Every typed word must appear somewhere — narrows as the user types.
      return state.q.split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
    }

    function render() {
      if (!SERVICES || !grid) return;

      var list = SERVICES.services.filter(match);
      if (limit > 0) list = list.slice(0, limit);

      if (!list.length) {
        grid.innerHTML =
          '<div class="finder__empty" style="grid-column:1/-1;">' +
            '<i class="ph ph-magnifying-glass" aria-hidden="true"></i>' +
            "<h3>No matching services</h3>" +
            '<p>Try a different term, or <a href="contact.html">tell us about your matter</a> and we will point you to the right team.</p>' +
          "</div>";
      } else {
        grid.innerHTML = list.map(serviceCard).join("");
      }

      if (countEl) {
        var total = SERVICES.services.filter(match).length;
        countEl.textContent = total + (total === 1 ? " service" : " services") +
          (state.q ? ' matching "' + input.value.trim() + '"' : "");
      }

      initReveal(); // newly injected cards need observers
    }
  }

  /* ------------------------------------------------------------------
     SERVICE DETAIL — hydrate from ?s=slug
     ------------------------------------------------------------------ */
  function initServiceDetail() {
    var root = document.querySelector("[data-service-detail]");
    if (!root) return;

    var slug = new URLSearchParams(location.search).get("s");

    loadServices().then(function (data) {
      var svc = data.services.filter(function (s) { return s.slug === slug; })[0];

      if (!svc) {
        svc = data.services[0];
        if (!svc) return;
      }

      var cat = data.categories.filter(function (c) { return c.id === svc.category; })[0] || {};

      document.title = svc.title + " | OneisOk Legal Consultancy";
      var meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", svc.excerpt);

      root.querySelectorAll("[data-field]").forEach(function (el) {
        var key = el.getAttribute("data-field");
        if (key === "title") el.textContent = svc.title;
        else if (key === "excerpt") el.textContent = svc.excerpt;
        else if (key === "timeline") el.textContent = svc.timeline || "On request";
        else if (key === "category") el.textContent = cat.label || "";
        else if (key === "icon") el.innerHTML = '<i class="ph ' + svc.icon + '"></i>';
      });

      root.querySelectorAll("[data-quote-link]").forEach(function (a) {
        a.setAttribute("href", "get-quote.html?s=" + svc.slug);
      });

      // Related: same category, excluding current
      var related = data.services.filter(function (s) {
        return s.category === svc.category && s.slug !== svc.slug;
      }).slice(0, 3);

      var relWrap = root.querySelector("[data-related]");
      if (relWrap) {
        relWrap.innerHTML = related.length
          ? related.map(serviceCard).join("")
          : '<p class="finder__empty">No related services.</p>';
        initReveal();
      }

      // Inject Service JSON-LD now that we know which service this is
      var ld = document.getElementById("serviceSchema");
      if (ld) {
        ld.textContent = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": svc.title,
          "description": svc.excerpt,
          "serviceType": cat.label || "Legal service",
          "provider": {
            "@type": "LegalService",
            "name": "OneisOk Legal Consultancy",
            "telephone": ["+91-93312-22555", "+91-99036-28986"],
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "141/1B Lenin Sarani",
              "addressLocality": "Kolkata",
              "addressRegion": "West Bengal",
              "postalCode": "700013",
              "addressCountry": "IN"
            }
          },
          "areaServed": { "@type": "Country", "name": "India" }
        });
      }
    });
  }

  /* ------------------------------------------------------------------
     QUOTE / CONTACT FORMS
     Static hosting → no backend. Submissions open a prefilled WhatsApp
     thread, with mailto as fallback. Set SITE.form.endpoint to POST
     to a hosted form service instead.
     ------------------------------------------------------------------ */
  function initForms() {
    document.querySelectorAll("[data-form]").forEach(function (form) {
      var status = form.querySelector(".form-status");

      function fail(field, msg) {
        var wrap = field.closest(".field");
        if (!wrap) return;
        wrap.classList.add("has-error");
        var err = wrap.querySelector(".field__error");
        if (err && msg) err.textContent = msg;
      }

      form.querySelectorAll("input, select, textarea").forEach(function (f) {
        var clear = function () {
          var wrap = f.closest(".field") || f.closest(".consent");
          if (wrap) wrap.classList.remove("has-error");
        };
        f.addEventListener("input", clear);
        f.addEventListener("change", clear);
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        // Honeypot: bots fill hidden fields, humans never see them.
        var hp = form.querySelector('[name="company_website"]');
        if (hp && hp.value) return;

        var ok = true;
        form.querySelectorAll("[required]").forEach(function (f) {
          if (f.type === "checkbox") {
            if (!f.checked) {
              var wrap = f.closest(".consent") || f.closest(".field");
              if (wrap) wrap.classList.add("has-error");
              ok = false;
            }
            return;
          }
          if (f.type === "radio") {
            if (!form.querySelector("input[name='" + f.name + "']:checked")) ok = false;
            return;
          }
          var val = (f.value || "").trim();
          if (!val) { fail(f, "This field is required."); ok = false; return; }
          if (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
            fail(f, "Enter a valid email address."); ok = false;
          }
          if (f.type === "tel" && !/^[0-9+\-\s()]{8,16}$/.test(val)) {
            fail(f, "Enter a valid phone number."); ok = false;
          }
        });

        if (!ok) {
          if (status) {
            status.className = "form-status form-status--err is-visible";
            status.innerHTML = '<i class="ph ph-warning-circle"></i><span>Please correct the highlighted fields.</span>';
          }
          var firstErr = form.querySelector(".has-error input, .has-error select, .has-error textarea");
          if (firstErr) firstErr.focus();
          return;
        }

        var data = new FormData(form);
        var lines = [];
        data.forEach(function (v, k) {
          if (k === "company_website" || !String(v).trim()) return;
          lines.push(k.replace(/_/g, " ").replace(/\b\w/g, function (m) { return m.toUpperCase(); }) + ": " + v);
        });

        var cfg = (window.SITE && window.SITE.form) || {};
        var body = "New enquiry from the website\n\n" + lines.join("\n");

        if (cfg.endpoint) {
          fetch(cfg.endpoint, { method: "POST", body: data })
            .then(function () { done(); })
            .catch(function () { openWhatsApp(body); done(); });
        } else {
          openWhatsApp(body);
          done();
        }

        function done() {
          if (status) {
            status.className = "form-status form-status--ok is-visible";
            status.innerHTML = '<i class="ph ph-check-circle"></i><span>Thank you — your enquiry is ready to send. ' +
              'If WhatsApp did not open, <a href="mailto:info@legal.oneisok.co?subject=Website%20enquiry&body=' +
              encodeURIComponent(body) + '">email us instead</a>.</span>';
          }
          form.reset();
        }
      });
    });

    function openWhatsApp(body) {
      var num = (window.SITE && window.SITE.whatsapp) || "919331222555";
      window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(body), "_blank", "noopener");
    }

    // Preselect the service on quote.html?s=slug
    var sel = document.querySelector("[data-service-select]");
    if (sel) {
      loadServices().then(function (data) {
        var groups = {};
        data.services.forEach(function (s) {
          (groups[s.category] = groups[s.category] || []).push(s);
        });
        var html = '<option value="">Select a service…</option>';
        data.categories.forEach(function (c) {
          if (!groups[c.id]) return;
          html += '<optgroup label="' + c.label + '">';
          groups[c.id].forEach(function (s) {
            html += '<option value="' + s.title + '">' + s.title + "</option>";
          });
          html += "</optgroup>";
        });
        html += '<option value="Something else">Something else / not sure</option>';
        sel.innerHTML = html;

        var slug = new URLSearchParams(location.search).get("s");
        if (slug) {
          var match = data.services.filter(function (s) { return s.slug === slug; })[0];
          if (match) sel.value = match.title;
        }
      });
    }
  }

  /* ------------------------------------------------------------------
     BLOG CATEGORY FILTER
     Filters the knowledge-centre cards by their data-cat attribute.
     Pure show/hide, so article markup stays crawlable in the HTML.
     ------------------------------------------------------------------ */
  function initBlogFilter() {
    var grid = document.querySelector("[data-blog-grid]");
    if (!grid) return;

    var chips = document.querySelectorAll("[data-blog-cat]");
    var cards = grid.querySelectorAll("[data-cat]");
    var empty = document.querySelector("[data-blog-empty]");

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var cat = chip.getAttribute("data-blog-cat");

        chips.forEach(function (c) { c.classList.remove("is-active"); });
        chip.classList.add("is-active");

        var shown = 0;
        cards.forEach(function (card) {
          var match = cat === "all" || card.getAttribute("data-cat") === cat;
          card.hidden = !match;
          if (match) shown++;
        });

        if (empty) empty.hidden = shown > 0;
      });
    });
  }

  /* ------------------------------------------------------------------
     WHATSAPP WIDGET — floating button opens a small composer card;
     submitting hands the typed text to wa.me as a prefilled chat.
     ------------------------------------------------------------------ */
  function initWhatsApp() {
    var widget = document.querySelector("[data-whatsapp-widget]");
    if (!widget) return;

    var WHATSAPP_NUMBER = "919331222555";
    var toggles = widget.querySelectorAll("[data-whatsapp-toggle]");
    var form = widget.querySelector("[data-whatsapp-form]");
    var input = widget.querySelector("[data-whatsapp-message]");

    /* Closing has to survive the pointer still being over the widget:
       the hover rule would otherwise re-show the card the instant the
       class is dropped. is-dismissed suppresses hover until the cursor
       actually leaves, at which point hover-to-open works again. */
    function setOpen(open) {
      widget.classList.toggle("is-open", open);
      widget.classList.toggle("is-dismissed", !open);
      toggles[0].setAttribute("aria-expanded", String(open));
      if (open) setTimeout(function () { input.focus(); }, 200);
      else if (document.activeElement && widget.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }

    widget.addEventListener("mouseleave", function () {
      widget.classList.remove("is-dismissed");
    });

    toggles.forEach(function (btn) {
      btn.addEventListener("click", function () {
        setOpen(!widget.classList.contains("is-open"));
      });
    });

    /* The X always closes. It must not share the toggle handler: hover
       opens the card without setting is-open, so a toggle would read
       "not open" and re-open it instead of dismissing it. */
    widget.querySelectorAll("[data-whatsapp-close]").forEach(function (btn) {
      btn.addEventListener("click", function () { setOpen(false); });
    });

    document.addEventListener("click", function (e) {
      if (widget.classList.contains("is-open") && !widget.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && widget.classList.contains("is-open")) setOpen(false);
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = input.value.trim() || "Hi, I'd like to know more about your services.";
        window.open("https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(text), "_blank", "noopener,noreferrer");
        input.value = "";
        setOpen(false);
      });
    }
  }

  /* ------------------------------------------------------------------
     MISC — active nav, year stamp, cookie bar
     ------------------------------------------------------------------ */
  function initMisc() {
    var page = document.body.getAttribute("data-page");
    if (page) {
      document.querySelectorAll('[data-nav="' + page + '"]').forEach(function (a) {
        a.setAttribute("aria-current", "page");
      });
    }

    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });

    var bar = document.querySelector(".cookie-bar");
    if (bar) {
      var seen;
      try { seen = localStorage.getItem("cookie-choice"); } catch (e) { seen = "1"; }
      if (!seen) setTimeout(function () { bar.classList.add("is-visible"); }, 1400);

      bar.querySelectorAll("[data-cookie]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          try { localStorage.setItem("cookie-choice", btn.getAttribute("data-cookie")); } catch (e) {}
          bar.classList.remove("is-visible");
        });
      });
    }
  }

  /* ------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------ */
  function init() {
    loadPartials().then(function () {
      initLenis();
      initAnchors();
      initHeroSlider();
      initScrollUI();
      initDropdowns();
      initDrawer();
      initReveal();
      initCounters();
      initAccordion();
      initSlider();
      initFinder();
      initServiceDetail();
      initForms();
      initBlogFilter();
      initWhatsApp();
      initMisc();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
