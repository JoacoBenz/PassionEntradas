// Textos de la tienda pública en inglés (default) y español. El toggle del
// header elige el idioma; se recuerda en localStorage ("tm_lang").
// SOLO tienda: el panel interno y el link de custodia siguen en español.

export type Lang = "en" | "es";
export const LANGS: Lang[] = ["en", "es"];

const en = {
  // header / footer
  backHome: "← Home",
  footSync: "Stock and prices synced from the source",
  footTeam: "Team access",
  waFloatMsg: "Hi! I'd like to ask about tickets.",

  // hero
  heroTitle1: "Tickets for the",
  heroTitle2: "events that matter",
  heroP:
    "World Cup 2026, Euro 2028, Formula 1 and the most wanted matches, with real availability and clear pricing.",
  ctaSearch: "Find tickets →",
  ctaWhatsapp: "Message us on WhatsApp",
  statEventos: "events",
  statStock: "tickets available",

  // secciones home
  proximosEyebrow: "Upcoming",
  proximosH2: "Closest events",
  proximosP: "Right around the corner, in stock or on request.",
  exploraEyebrow: "Explore",
  exploraH2: "Browse by category",
  verTodo: "View all",
  comoEyebrow: "Simple",
  comoH2: "How it works",
  porqueEyebrow: "Trust",
  porqueH2: "Why TicketMirror",
  dudasEyebrow: "Questions",
  dudasH2: "FAQ",
  ctaBandH2: "Looking for a specific event?",
  ctaBandP: "Message us and we'll tell you right away if we can get it.",
  ctaBandBtn: "Ask on WhatsApp",

  pasos: [
    ["Search", "Filter by event, venue or date and see real prices and stock, updated live."],
    ["Ask", "Tap Book or Ask and message us directly on WhatsApp with the event pre-filled."],
    ["Secure", "We coordinate payment and confirm your ticket. Simple, no runaround."],
  ] as [string, string][],
  porque: [
    ["Real stock", "We sync availability and prices every few minutes: what you see is what there is."],
    ["Clear pricing", "No surprises: all prices are in US dollars (USD)."],
    ["Direct service", "You talk to a person on WhatsApp, not a bot."],
  ] as [string, string][],
  faqs: [
    [
      "What currency are the prices in?",
      "All prices are in US dollars (USD). The final amount is confirmed when we close the deal.",
    ],
    [
      "How do I book or ask?",
      "Every seat row has a button that opens WhatsApp with the event and section pre-filled. We get your message and reply.",
    ],
    [
      "What if my event isn't listed?",
      "Message us anyway: we source tickets for many events that aren't always listed.",
    ],
    [
      "Is the availability real?",
      "Yes. The stock we show comes from the source and updates automatically; we still confirm before closing.",
    ],
  ] as [string, string][],

  // cards / filas
  bookNow: "● Book now",
  nuestra: "Ours",
  sedeTBC: "Venue TBC",
  fechaTBC: "Date TBC",
  verUbic: (n: number) => `View ${n} ${n === 1 ? "location" : "locations"}`,
  ocultarUbic: "Hide locations",
  desde: "from",
  precio: "price",
  consultar: "Ask",
  reservar: "Book",
  entradaGeneral: "General admission",
  quedan: (n: number) => `${n} left`,
  lugares: (n: number) => `${n} available`,
  aPedido: "on request",
  sinCupo: "sold out",
  ubicaciones: (n: number) => `${n} locations`,
  conStock: (n: number) => ` · ${n} in stock`,
  aConsultar: "Ask us",
  desdeMayus: "From",
  entradasRank: "tickets",
  shareText: (t: string) => `Check out tickets for ${t} on TicketMirror`,
  // El link del evento va al final del mensaje: el agente abre y ve
  // exactamente de qué entrada le están hablando.
  msgReservar: (evento: string, sector: string, precio: string, link: string) =>
    `Hi! I'd like to book: ${evento} — ${sector}${precio ? ` (${precio})` : ""}. Is it still available?\n${link}`,
  msgConsultar: (evento: string, sector: string, link: string) =>
    `Hi! Asking about: ${evento} — ${sector}. Any availability?\n${link}`,
  msgReservarRank: (evento: string, link: string) =>
    `Hi! I'd like to book for ${evento}. What's available?\n${link}`,
  msgConsultarRank: (evento: string, link: string) =>
    `Hi! Asking about ${evento}. Can you get it?\n${link}`,
  msgBuscoEvento: "Hi! I'm looking for an event that isn't on the site.",

  // widget de WhatsApp (agentes)
  waTitle: "Talk to our team",
  waSubtitle: "Real people, replies in minutes",
  waDisponible: "Available now",
  waOcupado: "With a customer",
  waChat: "Chat",
  waAgenteMsg: (agente: string) => `Hi ${agente}! I'd like to ask about tickets.`,

  // catálogo
  fCategoria: "Category",
  fLugar: "Location",
  fFecha: "Date",
  todasCategorias: "All categories",
  todosLugares: "All locations",
  todasFechas: "All dates",
  buscarPlaceholder: "Search team, venue or section",
  eventos: (n: number) => `${n === 1 ? "event" : "events"}`,
  mostrando: (a: number, b: number) => ` · showing ${a}–${b}`,
  limpiar: "Clear filters",
  vacio1: "No events match these filters.",
  vacio2: "and we'll look for it.",
  vacioLink: "Ask us on WhatsApp",
  anterior: "← Previous",
  siguiente: "Next →",
  pagina: (a: number, b: number) => `Page ${a} of ${b}`,
  mesTBC: "TBC",

  // landing pública (/): capta clientes y toma la solicitud de acceso.
  lp: {
    navIngresar: "Log in",
    heroEyebrow: "Premium ticket concierge",
    heroTitle1: "The best seats to the events",
    heroTitle2: "everyone wants",
    heroP:
      "From the World Cup 2026 to Formula 1, we source, price and secure the tickets others can't. Members get the full catalogue with real availability — and a real person from search to seat.",
    ctaSolicitar: "Request access",
    ctaIngresar: "I already have access",
    stats: [
      ["500+", "events live"],
      ["20+", "competitions"],
      ["Minutes", "to reply"],
    ] as [string, string][],
    serviciosEyebrow: "What we offer",
    serviciosH2: "A first-class ticket service",
    servicios: [
      ["Sold-out & hard-to-get", "We reach inventory that's off the shelves: finals, derbies, front-row Formula 1."],
      ["Transparent USD pricing", "Every ticket priced in US dollars, synced from the source. No hidden fees."],
      ["Concierge on WhatsApp", "A real person helps you pick seats, holds your spot and replies in minutes."],
      ["Secured end to end", "We coordinate payment and confirm your ticket. You only pay for what's real."],
    ] as [string, string][],
    coberturaEyebrow: "What we get you",
    coberturaH2: "The events that matter",
    coberturaP: "And plenty more — if it's big, just ask.",
    categorias: [
      "World Cup 2026",
      "Euro 2028",
      "Formula 1",
      "Champions League",
      "Premier League",
      "LaLiga",
      "NBA",
      "Derbies & Clásicos",
      "Grand Slam Tennis",
    ],
    comoEyebrow: "Simple",
    comoH2: "How it works",
    pasos: [
      ["Request access", "Tell us who you are — it takes a minute."],
      ["Get approved", "We review it and send your private username and password."],
      ["Browse & book", "See the full catalogue with live availability and book with our team."],
    ] as [string, string][],
    ctaBandH2: "Ready to get in?",
    ctaBandP: "Request access now and start browsing the full catalogue.",
    ctaBandBtn: "Request access",
    formEyebrow: "Request access",
    formTitle: "Create your access request",
    formP:
      "Leave your details and our team will review it. Once approved, we'll send you a username and password to browse every available ticket.",
    fNombre: "Full name",
    fEmail: "Email",
    fTelefono: "Phone / WhatsApp",
    fDireccion: "Address",
    fMensaje: "Anything you're looking for? (optional)",
    fMensajePh: "e.g. World Cup final, F1 Monza, a specific match…",
    enviar: "Send request",
    enviando: "Sending…",
    okTitle: "Request received!",
    okP: "Our team will review it shortly and get back to you with your access. Keep an eye on your email and WhatsApp.",
    okOtra: "Send another request",
    errGeneric: "We couldn't send your request. Please try again.",
    footTagline: "Tickets for the events that matter.",
  },
};

const es: typeof en = {
  backHome: "← Inicio",
  footSync: "Stock y precios sincronizados desde la fuente",
  footTeam: "Acceso equipo",
  waFloatMsg: "Hola! Quiero consultar por entradas.",

  heroTitle1: "Entradas para los",
  heroTitle2: "eventos que importan",
  heroP:
    "Mundial 2026, Euro 2028, Fórmula 1 y los partidos más buscados, con disponibilidad real y precio claro.",
  ctaSearch: "Buscar entradas →",
  ctaWhatsapp: "Escribinos por WhatsApp",
  statEventos: "eventos",
  statStock: "entradas para comprar",

  proximosEyebrow: "Próximos",
  proximosH2: "Eventos más cercanos",
  proximosP: "Los que están a la vuelta de la esquina, con stock o a pedido.",
  exploraEyebrow: "Explorá",
  exploraH2: "Entrá por categoría",
  verTodo: "Ver todo",
  comoEyebrow: "Simple",
  comoH2: "Cómo funciona",
  porqueEyebrow: "Confianza",
  porqueH2: "Por qué TicketMirror",
  dudasEyebrow: "Dudas",
  dudasH2: "Preguntas frecuentes",
  ctaBandH2: "¿Buscás un evento puntual?",
  ctaBandP: "Escribinos y te decimos al toque si lo conseguimos.",
  ctaBandBtn: "Consultar por WhatsApp",

  pasos: [
    ["Buscás", "Filtrá por evento, lugar o fecha y mirá precios y stock reales, actualizados al momento."],
    ["Consultás", "Tocá Reservar o Consultar y nos escribís directo por WhatsApp con el evento ya cargado."],
    ["Asegurás", "Coordinamos pago y te confirmamos la entrada. Simple, sin vueltas."],
  ],
  porque: [
    ["Stock real", "Sincronizamos disponibilidad y precios cada pocos minutos: lo que ves es lo que hay."],
    ["Precio claro", "Sin sorpresas: todos los precios están en dólares (USD)."],
    ["Atención directa", "Hablás con una persona por WhatsApp, no con un bot."],
  ],
  faqs: [
    [
      "¿En qué moneda están los precios?",
      "Todos los precios están en dólares estadounidenses (USD). El monto final lo confirmamos al cerrar.",
    ],
    [
      "¿Cómo reservo o consulto?",
      "Cada ubicación tiene un botón que abre WhatsApp con el evento y el sector ya escritos. Nos llega tu mensaje y te respondemos.",
    ],
    [
      "¿Y si no aparece mi evento?",
      "Escribinos igual: conseguimos entradas para muchos eventos que no siempre están listados.",
    ],
    [
      "¿Las entradas tienen disponibilidad real?",
      "Sí. El stock que mostramos viene de la fuente y se actualiza solo; aun así confirmamos antes de cerrar.",
    ],
  ],

  bookNow: "● Reservá ya",
  nuestra: "Nuestra",
  sedeTBC: "Sede a confirmar",
  fechaTBC: "Fecha a confirmar",
  verUbic: (n) => `Ver ${n} ${n === 1 ? "ubicación" : "ubicaciones"}`,
  ocultarUbic: "Ocultar ubicaciones",
  desde: "desde",
  precio: "precio",
  consultar: "Consultar",
  reservar: "Reservar",
  entradaGeneral: "Entrada general",
  quedan: (n) => `quedan ${n}`,
  lugares: (n) => `${n} lugares`,
  aPedido: "a pedido",
  sinCupo: "sin cupo",
  ubicaciones: (n) => `${n} ubicaciones`,
  conStock: (n) => ` · ${n} con stock`,
  aConsultar: "A consultar",
  desdeMayus: "Desde",
  entradasRank: "entradas",
  shareText: (t) => `Mirá las entradas para ${t} en TicketMirror`,
  msgReservar: (evento, sector, precio, link) =>
    `Hola! Quiero reservar: ${evento} — ${sector}${precio ? ` (${precio})` : ""}. ¿Sigue disponible?\n${link}`,
  msgConsultar: (evento, sector, link) =>
    `Hola! Consulto por: ${evento} — ${sector}. ¿Hay disponibilidad?\n${link}`,
  msgReservarRank: (evento, link) =>
    `Hola! Quiero reservar para ${evento}. ¿Qué disponibilidad hay?\n${link}`,
  msgConsultarRank: (evento, link) =>
    `Hola! Consulto por ${evento}. ¿Se puede conseguir?\n${link}`,
  msgBuscoEvento: "Hola! Busco un evento que no aparece en la web.",

  waTitle: "Hablá con el equipo",
  waSubtitle: "Personas reales, respuesta en minutos",
  waDisponible: "Disponible ahora",
  waOcupado: "Con un cliente",
  waChat: "Chatear",
  waAgenteMsg: (agente) => `Hola ${agente}! Quiero consultar por entradas.`,

  fCategoria: "Categoría",
  fLugar: "Lugar",
  fFecha: "Fecha",
  todasCategorias: "Todas las categorías",
  todosLugares: "Todos los lugares",
  todasFechas: "Todas las fechas",
  buscarPlaceholder: "Buscar equipo, sede o sector",
  eventos: (n) => `${n === 1 ? "evento" : "eventos"}`,
  mostrando: (a, b) => ` · mostrando ${a}–${b}`,
  limpiar: "Limpiar filtros",
  vacio1: "Ningún evento coincide con estos filtros.",
  vacio2: "y lo buscamos.",
  vacioLink: "Consultanos por WhatsApp",
  anterior: "← Anteriores",
  siguiente: "Siguientes →",
  pagina: (a, b) => `Página ${a} de ${b}`,
  mesTBC: "A confirmar",

  lp: {
    navIngresar: "Ingresar",
    heroEyebrow: "Concierge de entradas premium",
    heroTitle1: "Los mejores lugares a los eventos",
    heroTitle2: "que todos quieren",
    heroP:
      "Del Mundial 2026 a la Fórmula 1, conseguimos, cotizamos y aseguramos las entradas que otros no. Los miembros ven todo el catálogo con disponibilidad real — y una persona de verdad de la búsqueda a la butaca.",
    ctaSolicitar: "Solicitar acceso",
    ctaIngresar: "Ya tengo acceso",
    stats: [
      ["500+", "eventos activos"],
      ["20+", "competiciones"],
      ["Minutos", "de respuesta"],
    ],
    serviciosEyebrow: "Qué ofrecemos",
    serviciosH2: "Un servicio de entradas de primera",
    servicios: [
      ["Agotadas y difíciles", "Llegamos a lo que ya no está en venta: finales, clásicos, primera fila en la Fórmula 1."],
      ["Precio claro en USD", "Cada entrada cotizada en dólares, sincronizada desde la fuente. Sin cargos ocultos."],
      ["Concierge por WhatsApp", "Una persona real te ayuda a elegir lugares, te reserva el cupo y responde en minutos."],
      ["Asegurado de punta a punta", "Coordinamos el pago y te confirmamos la entrada. Pagás solo por lo que es real."],
    ],
    coberturaEyebrow: "Lo que te conseguimos",
    coberturaH2: "Los eventos que importan",
    coberturaP: "Y muchos más — si es grande, consultanos.",
    categorias: [
      "Mundial 2026",
      "Euro 2028",
      "Fórmula 1",
      "Champions League",
      "Premier League",
      "LaLiga",
      "NBA",
      "Clásicos y derbis",
      "Grand Slam de Tenis",
    ],
    comoEyebrow: "Simple",
    comoH2: "Cómo funciona",
    pasos: [
      ["Solicitás acceso", "Contanos quién sos — te lleva un minuto."],
      ["Te aprobamos", "La revisamos y te enviamos tu usuario y contraseña privados."],
      ["Mirás y reservás", "Ves todo el catálogo con disponibilidad real y reservás con nuestro equipo."],
    ],
    ctaBandH2: "¿Listo para entrar?",
    ctaBandP: "Solicitá acceso ahora y empezá a ver todo el catálogo.",
    ctaBandBtn: "Solicitar acceso",
    formEyebrow: "Solicitar acceso",
    formTitle: "Creá tu solicitud de acceso",
    formP:
      "Dejanos tus datos y nuestro equipo la revisa. Una vez aprobada, te enviamos un usuario y contraseña para ver todas las entradas disponibles.",
    fNombre: "Nombre y apellido",
    fEmail: "Email",
    fTelefono: "Teléfono / WhatsApp",
    fDireccion: "Dirección",
    fMensaje: "¿Buscás algo en particular? (opcional)",
    fMensajePh: "ej: final del Mundial, F1 Monza, un partido puntual…",
    enviar: "Enviar solicitud",
    enviando: "Enviando…",
    okTitle: "¡Solicitud recibida!",
    okP: "Nuestro equipo la revisa a la brevedad y te contacta con tu acceso. Estate atento a tu email y WhatsApp.",
    okOtra: "Enviar otra solicitud",
    errGeneric: "No pudimos enviar tu solicitud. Probá de nuevo.",
    footTagline: "Entradas para los eventos que importan.",
  },
};

export const TX: Record<Lang, typeof en> = { en, es };

export const LOCALE: Record<Lang, string> = { en: "en-US", es: "es-AR" };

// "2026-08" -> "August 2026" / "Agosto de 2026" (para el filtro de fecha).
export function mesLabelLang(mes: string, lang: Lang): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) return TX[lang].mesTBC;
  const label = new Date(`${mes}-01T00:00:00Z`).toLocaleDateString(LOCALE[lang], {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
