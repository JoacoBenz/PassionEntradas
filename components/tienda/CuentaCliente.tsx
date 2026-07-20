"use client";

// Mi cuenta del CLIENTE (logueado en la tienda): cambiar la propia contraseña
// y cerrar sesión. Misma estética que la tienda; bilingüe EN/ES.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LANGS, TX, type Lang } from "@/lib/tienda-i18n";

function useLang() {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const saved = localStorage.getItem("tm_lang");
    if (saved === "en" || saved === "es") setLang(saved);
  }, []);
  function change(l: Lang) {
    setLang(l);
    localStorage.setItem("tm_lang", l);
  }
  return [lang, change] as const;
}

function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="lang" role="group" aria-label="Language / Idioma">
      {LANGS.map((l) => (
        <button
          key={l}
          className={`lang-btn ${l === lang ? "active" : ""}`}
          onClick={() => onChange(l)}
          aria-pressed={l === lang}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

type Estado = "idle" | "saving" | "ok";

export function CuentaCliente({ mock }: { mock: boolean }) {
  const router = useRouter();
  const [lang, setLang] = useLang();
  const lp = TX[lang].lp;

  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "saving") return;
    setError(null);
    if (clave.length < 8) {
      setError(lp.cuentaErrCorta);
      return;
    }
    if (clave !== repetir) {
      setError(lp.cuentaErrMatch);
      return;
    }
    if (mock) {
      setError("Demo mode: no hay cuentas reales.");
      return;
    }
    setEstado("saving");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: clave });
      if (error) {
        setError(lp.cuentaErrGeneric);
        setEstado("idle");
        return;
      }
      setClave("");
      setRepetir("");
      setEstado("ok");
      router.refresh();
    } catch {
      setError(lp.cuentaErrGeneric);
      setEstado("idle");
    }
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/ingresar");
    router.refresh();
  }

  return (
    <>
      <header className="masthead masthead--home">
        <div className="toprow">
          <Link className="wm" href="/entradas">
            <span className="ticketmark">▚</span> TICKET<em>MIRROR</em>
          </Link>
          <div className="mast-right">
            <LangToggle lang={lang} onChange={setLang} />
            <Link className="back" href="/entradas">
              {lp.cuentaVolver}
            </Link>
          </div>
        </div>
      </header>

      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">{lp.navCuenta}</span>
          <h2>{lp.cuentaPassH}</h2>
        </div>

        <form className="lp-form lp-cuenta-form" onSubmit={onSubmit} noValidate>
          <label className="lp-field">
            <span>{lp.cuentaNueva}</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder={lp.cuentaMin}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
            />
          </label>
          <label className="lp-field">
            <span>{lp.cuentaRepetir}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
            />
          </label>

          {estado === "ok" && <p className="lp-ok-msg">{lp.cuentaOk}</p>}
          {error && <p className="lp-err">{error}</p>}

          <button className="btn-primary lp-submit" type="submit" disabled={estado === "saving"}>
            {estado === "saving" ? lp.cuentaGuardando : lp.cuentaGuardar}
          </button>
        </form>

        <div className="lp-cuenta-logout">
          <button className="back" onClick={logout}>
            {lp.cuentaSalir}
          </button>
        </div>
      </section>
    </>
  );
}
