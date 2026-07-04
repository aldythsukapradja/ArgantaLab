// Kingdom Command Center — admin login gate + Character Lab session bridge.
//
// Command is a data-ops console: it opens ONLY for the admin (Google). Its real
// job beyond gating is to mint a Supabase session and hand it DOWN to the
// embedded Character Lab (Kingdom Heroes) iframe via postMessage — so the Lab
// never runs its own Google OAuth inside the frame (which Google 403s). Kids
// never touch Command; they sign into Kingdom Heroes directly.
//
// The anon key below is the PUBLIC key (safe in the client; RLS protects data).
// It's the same key already shipped in the deployed Heroes bundle.
(function () {
  const SUPABASE_URL = 'https://bdagdxgpnlialkppjwor.supabase.co';
  const SUPABASE_ANON =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkYWdkeGdwbmxpYWxrcHBqd29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MzI4NjUsImV4cCI6MjA5NzUwODg2NX0.MpeOrfbyLsBv85K3ZW82EwrOjgYEgDe1PhT-HtWJpWo';
  // Only these Google accounts may open Command. Add more admins here.
  const ADMIN_EMAILS = ['aldhyt.sukapradja@gmail.com'];

  // Hide the console immediately (this runs in <head>, before <body> renders,
  // so there's no flash of the dashboard). The rest waits for the DOM.
  injectStyles();

  let supabase = null;
  let session = null;
  let gate = null;
  const frames = new Set(); // Lab iframes waiting for the session

  ready(() => {
    // gate UI (self-contained; ArgantaLab dark theme)
    gate = mountGate();

    // The Lab announces itself when it mounts in embed mode; reply with the
    // session (using the frame's real origin as targetOrigin for safety).
    window.addEventListener('message', (e) => {
      const d = e.data;
      if (d && d.type === 'kingdom-lab-ready' && e.source) {
        try {
          e.source.postMessage(sessionMessage(), e.origin && e.origin !== 'null' ? e.origin : '*');
        } catch (_) {
          /* ignore */
        }
      }
    });

    // Public API (used by views-vault.js Views.lab).
    window.KingdomAuth = {
      attachFrame(iframe) {
        frames.add(iframe);
        iframe.addEventListener('load', broadcastSession, { once: false });
      },
      detachFrame(iframe) {
        frames.delete(iframe);
      },
      getSession() {
        return session;
      },
      signOut() {
        if (supabase) supabase.auth.signOut();
      },
    };

    // Load supabase-js from a CDN (Command has no bundler). If it can't load,
    // the gate stays up with an error rather than silently exposing the app.
    import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
          auth: {
            storageKey: 'kingdom-command-auth',
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        });
        wireGoogle();
        supabase.auth.getSession().then(({ data }) => applySession(data.session));
        supabase.auth.onAuthStateChange((_e, s) => applySession(s));
      })
      .catch(() => gate.error('Could not load the auth library. Check your connection and reload.'));
  });

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  // ---- session → app + iframe bridge --------------------------------------
  function applySession(s) {
    session = s || null;
    const email = session?.user?.email?.toLowerCase() || '';
    const isAdmin = !!session && ADMIN_EMAILS.includes(email);

    if (session && !isAdmin) {
      // Signed in with a non-admin Google account — deny and sign back out.
      gate.error(`${email} isn't an authorized Command admin.`);
      gate.show();
      document.body.classList.remove('kc-authed');
      supabase.auth.signOut();
      return;
    }

    if (isAdmin) {
      // strip the OAuth #access_token / ?code fragment Supabase appends
      if (/access_token|[?&]code=/.test(location.hash + location.search)) {
        history.replaceState(null, '', location.pathname);
      }
      document.body.classList.add('kc-authed');
      gate.hide();
    } else {
      document.body.classList.remove('kc-authed');
      gate.show();
    }
    broadcastSession();
  }

  function sessionMessage() {
    if (session?.access_token) {
      return {
        type: 'kingdom-auth',
        session: { access_token: session.access_token, refresh_token: session.refresh_token },
      };
    }
    return { type: 'kingdom-auth', signout: true };
  }

  function broadcastSession() {
    frames.forEach((iframe) => {
      try {
        const origin = new URL(iframe.src, location.href).origin;
        iframe.contentWindow?.postMessage(sessionMessage(), origin);
      } catch (_) {
        /* frame gone */
      }
    });
  }

  // The Lab announces itself when it mounts in embed mode; reply with the
  // session (using the frame's real origin as targetOrigin for safety).
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.type === 'kingdom-lab-ready' && e.source) {
      try {
        e.source.postMessage(sessionMessage(), e.origin && e.origin !== 'null' ? e.origin : '*');
      } catch (_) {
        /* ignore */
      }
    }
  });

  // ---- public API (used by views-vault.js Views.lab) ----------------------
  window.KingdomAuth = {
    attachFrame(iframe) {
      frames.add(iframe);
      iframe.addEventListener('load', broadcastSession, { once: false });
    },
    detachFrame(iframe) {
      frames.delete(iframe);
    },
    getSession() {
      return session;
    },
    signOut() {
      if (supabase) supabase.auth.signOut();
    },
  };

  // ---- gate DOM -----------------------------------------------------------
  function wireGoogle() {
    gate.googleBtn.addEventListener('click', async () => {
      gate.busy(true);
      gate.error('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname },
      });
      if (error) {
        gate.error(error.message);
        gate.busy(false);
      }
    });
  }

  function mountGate() {
    const el = document.createElement('div');
    el.className = 'kc-gate';
    el.innerHTML = `
      <div class="kc-card">
        <img class="kc-mark" src="icon.svg" alt="" />
        <h1>Kingdom <span>Command Center</span></h1>
        <p class="kc-sub">Nexus data ops — authorized admins only.</p>
        <button class="kc-google" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
            <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.1h5.9c-.3 1.3-1 2.4-2.1 3.1v2.6h3.4c2-1.8 3.4-4.5 3.4-7.6z"/>
            <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.4-2.6c-.9.6-2.2 1-3.9 1-3 0-5.5-2-6.4-4.7H2.1v2.8C3.9 20.5 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.6 14c-.2-.6-.4-1.3-.4-2s.1-1.4.4-2V7.2H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.8L5.6 14z"/>
            <path fill="#EA4335" d="M12 5.3c1.6 0 3 .6 4.2 1.6l3.1-3.1C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.2L5.6 10c.9-2.7 3.4-4.7 6.4-4.7z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
        <div class="kc-err" hidden></div>
        <small class="kc-foot">Kids build heroes in <b>Kingdom Heroes</b>, not here.</small>
      </div>`;
    document.body.appendChild(el);
    const googleBtn = el.querySelector('.kc-google');
    const errEl = el.querySelector('.kc-err');
    return {
      googleBtn,
      show() { el.hidden = false; },
      hide() { el.hidden = true; },
      busy(on) { googleBtn.disabled = !!on; googleBtn.querySelector('span').textContent = on ? 'Opening Google…' : 'Continue with Google'; },
      error(msg) { errEl.textContent = msg || ''; errEl.hidden = !msg; },
    };
  }

  function injectStyles() {
    const css = `
      /* hide the console until an admin is signed in */
      body:not(.kc-authed) .app,
      body:not(.kc-authed) .mobilebar { visibility: hidden; }
      .kc-gate {
        position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center;
        padding: 20px; background:
          radial-gradient(120% 80% at 30% 0%, #141a2e 0%, #05070d 60%),
          #05070d;
        color: #eef2ff; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
      }
      .kc-card {
        width: min(380px, calc(100vw - 20px)); text-align: center;
        padding: 40px 28px 26px; border-radius: 26px;
        background: linear-gradient(180deg, #121732 0%, #0c1024 100%);
        border: 1px solid #ffffff1f;
        box-shadow: 0 30px 80px -30px #000, inset 0 1px 0 #ffffff14;
      }
      .kc-mark { width: 68px; height: 68px; border-radius: 20px; margin-bottom: 16px;
        box-shadow: 0 12px 30px -10px #6366f188; }
      .kc-card h1 { margin: 0 0 6px; font-size: 25px; font-weight: 800; letter-spacing: -.02em; }
      .kc-card h1 span { background: linear-gradient(90deg, #7fb0ff, #b79bff);
        -webkit-background-clip: text; background-clip: text; color: transparent; }
      .kc-sub { margin: 0 0 22px; color: #9aa6c8; font-size: 13.5px; }
      .kc-google {
        width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
        padding: 12px 16px; border-radius: 13px; border: 0; cursor: pointer;
        background: #fff; color: #1a1a1a; font-weight: 700; font-size: 14.5px;
        transition: transform .06s ease, box-shadow .2s ease;
        box-shadow: 0 8px 20px -8px #0008;
      }
      .kc-google:hover { box-shadow: 0 10px 26px -8px #000a; }
      .kc-google:active { transform: translateY(1px); }
      .kc-google:disabled { opacity: .6; cursor: default; }
      .kc-err { margin-top: 14px; color: #ff9db1; font-size: 13px; }
      .kc-foot { display: block; margin-top: 20px; color: #6b769a; font-size: 12px; }
      .kc-foot b { color: #9aa6c8; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
