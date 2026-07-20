"use client";

// Landing pública (/) — la cara nueva de TicketMirror para captar clientes.
// Sencilla y clara: propuesta de valor + formulario para pedir acceso. La
// tienda de entradas dejó de ser pública; desde acá se solicita el usuario.
// Bilingüe EN/ES (default inglés), mismo toggle/localStorage que la tienda.

import { useEffect, useState } from "react";
import Link from "next/link";
import { LANGS, TX, type Lang } from "@/lib/tienda-i18n";
import { PAISES, PAIS_DEFAULT, dialDe, nombrePais } from "@/lib/paises";

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

type Estado = "idle" | "sending" | "ok" | "error";

export function Landing() {
  const [lang, setLang] = useLang();
  const t = TX[lang];
  const lp = t.lp;

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  // Teléfono en dos partes: país (código) + número. Se combinan al enviar.
  const [pais, setPais] = useState(PAIS_DEFAULT);
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [mensaje, setMensaje] = useState("");
  // Honeypot: un bot rellena todo; un humano no ve este campo.
  const [empresa, setEmpresa] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (estado === "sending") return;
    setEstado("sending");
    setError(null);
    try {
      // El número se manda con el prefijo del país elegido.
      const telefonoCompleto = telefono.trim() ? `${dialDe(pais)} ${telefono.trim()}` : "";
      const res = await fetch("/api/acceso/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email, telefono: telefonoCompleto, direccion, mensaje, empresa }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : lp.errGeneric);
        setEstado("error");
        return;
      }
      setEstado("ok");
    } catch {
      setError(lp.errGeneric);
      setEstado("error");
    }
  }

  function reset() {
    setNombre("");
    setEmail("");
    setPais(PAIS_DEFAULT);
    setTelefono("");
    setDireccion("");
    setMensaje("");
    setEstado("idle");
    setError(null);
  }

  return (
    <>
      <header className="masthead masthead--home">
        <div className="toprow">
          <span className="wm wm--static">
            <span className="ticketmark">▚</span> TICKET<em>MIRROR</em>
          </span>
          <div className="mast-right">
            <LangToggle lang={lang} onChange={setLang} />
            <Link className="lp-nav-login" href="/ingresar">
              {lp.navIngresar}
            </Link>
          </div>
        </div>

        <div className="lp-hero">
          {/* Columna de venta: corta y al grano. */}
          <div className="hero hero--home lp-hero-copy">
            <span className="lp-eyebrow">{lp.heroEyebrow}</span>
            <h1>
              {lp.heroTitle1}
              <br />
              <span>{lp.heroTitle2}</span>
            </h1>
            <p>{lp.heroP}</p>
            <ul className="lp-bullets">
              {lp.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="cta-row">
              <a className="btn-primary lp-hero-cta" href="#solicitar">
                {lp.ctaSolicitar}
              </a>
              <Link className="btn-ghost" href="/ingresar">
                {lp.ctaIngresar}
              </Link>
            </div>
          </div>

          {/* El formulario es el protagonista. */}
          <div className="lp-hero-form" id="solicitar">
            {estado === "ok" ? (
              <div className="lp-ok" role="status">
                <span className="lp-ok-ic" aria-hidden>
                  ✓
                </span>
                <h3>{lp.okTitle}</h3>
                <p>{lp.okP}</p>
                <button className="btn-ghost" onClick={reset}>
                  {lp.okOtra}
                </button>
              </div>
            ) : (
              <form className="lp-form" onSubmit={onSubmit} noValidate>
                <div className="lp-form-head">
                  <span className="sh-eyebrow">{lp.formEyebrow}</span>
                  <h2>{lp.formTitle}</h2>
                </div>
                <label className="lp-field">
                  <span>{lp.fNombre}</span>
                  <input
                    type="text"
                    name="nombre"
                    autoComplete="name"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </label>
                <label className="lp-field">
                  <span>{lp.fEmail}</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="lp-field">
                  <span>{lp.fTelefono}</span>
                  <div className="lp-tel">
                    <select
                      className="lp-tel-cod"
                      name="pais"
                      aria-label="Código de país"
                      value={pais}
                      onChange={(e) => setPais(e.target.value)}
                    >
                      {PAISES.map((p) => (
                        <option key={p.iso} value={p.iso}>
                          {p.dial} · {nombrePais(p, lang)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      name="telefono"
                      inputMode="tel"
                      autoComplete="tel-national"
                      required
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                    />
                  </div>
                </label>
                <label className="lp-field">
                  <span>{lp.fDireccion}</span>
                  <input
                    type="text"
                    name="direccion"
                    autoComplete="street-address"
                    required
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                  />
                </label>
                <label className="lp-field">
                  <span>{lp.fMensaje}</span>
                  <textarea
                    name="mensaje"
                    rows={2}
                    placeholder={lp.fMensajePh}
                    value={mensaje}
                    onChange={(e) => setMensaje(e.target.value)}
                  />
                </label>

                {/* Honeypot anti-spam: oculto para personas, tentador para bots. */}
                <div className="lp-hp" aria-hidden>
                  <label>
                    Empresa
                    <input
                      type="text"
                      name="empresa"
                      tabIndex={-1}
                      autoComplete="off"
                      value={empresa}
                      onChange={(e) => setEmpresa(e.target.value)}
                    />
                  </label>
                </div>

                {estado === "error" && error && <p className="lp-err">{error}</p>}

                <button className="btn-primary lp-submit" type="submit" disabled={estado === "sending"}>
                  {estado === "sending" ? lp.enviando : lp.enviar}
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Cómo funciona: tres pasos, rápido. */}
      <section className="block">
        <div className="section-h">
          <span className="sh-eyebrow">{lp.comoEyebrow}</span>
          <h2>{lp.comoH2}</h2>
        </div>
        <div className="steps">
          {lp.pasos.map(([tt, d], i) => (
            <div className="step" key={tt}>
              <span className="step-n">{i + 1}</span>
              <h3>{tt}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="foot">
        <span>TicketMirror</span>
        <span>{lp.footTagline}</span>
      </footer>
    </>
  );
}
