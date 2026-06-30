import { promises as fs } from "node:fs";
import path from "node:path";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import type { Config } from "../config/index.js";
import type { Logger } from "../logger.js";
import { BlockedError, LoginFailedError, SessionExpiredError } from "../errors.js";
import { PORTAL_SELECTORS } from "./parser.js";

const BLOCKED_RESOURCE_TYPES = new Set(["image", "font", "media"]);

/**
 * Maneja login + sesión persistida (storageState) con Playwright.
 * - Login una vez por arranque; reusa storageState entre reinicios (volumen).
 * - Detecta expiración (redirect a login) y re-loguea.
 * - Detecta captcha/MFA y lanza BlockedError (NO se evade).
 * - Nunca loguea credenciales ni cookies.
 */
export class PortalSession {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private readonly statePath: string;

  constructor(
    private readonly cfg: Config,
    private readonly log: Logger,
  ) {
    this.statePath = path.join(cfg.STATE_DIR, "storageState.json");
  }

  private get loginUrl(): string {
    // En Passion Events el login está en el index del /admin/. Configurable.
    return this.cfg.PE_LOGIN_URL ?? this.cfg.PE_BASE_URL;
  }

  private async stateExists(): Promise<boolean> {
    try {
      await fs.access(this.statePath);
      return true;
    } catch {
      return false;
    }
  }

  private async launch(): Promise<BrowserContext> {
    if (this.context) return this.context;

    this.browser ??= await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    const hasState = await this.stateExists();
    this.context = await this.browser.newContext({
      userAgent: this.cfg.USER_AGENT,
      ...(hasState ? { storageState: this.statePath } : {}),
    });

    // Cortesía/eficiencia: bloquear imágenes/fuentes/media.
    await this.context.route("**/*", (route) => {
      if (BLOCKED_RESOURCE_TYPES.has(route.request().resourceType())) {
        return route.abort();
      }
      return route.continue();
    });

    this.log.info({ hasState }, "contexto de navegador iniciado");
    return this.context;
  }

  /** Persiste storageState con permisos restringidos (es secreto). */
  private async persistState(): Promise<void> {
    if (!this.context) return;
    await fs.mkdir(this.cfg.STATE_DIR, { recursive: true });
    await this.context.storageState({ path: this.statePath });
    await fs.chmod(this.statePath, 0o600).catch(() => undefined);
  }

  /**
   * Asegura que tenemos una sesión válida. Re-loguea si expiró.
   * Lanza BlockedError si aparece captcha/MFA.
   */
  async ensureSession(): Promise<void> {
    const context = await this.launch();
    const page = await context.newPage();
    try {
      await page.goto(this.cfg.PE_BASE_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      await this.assertNotBlocked(page);

      if (await this.isLoggedIn(page)) {
        this.log.debug("sesión válida");
        return;
      }
      this.log.info("sesión ausente o expirada, iniciando login");
      await this.login(page);
      await this.persistState();
      this.log.info("login OK, storageState persistido");
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async isLoggedIn(page: Page): Promise<boolean> {
    return (await page.locator(PORTAL_SELECTORS.loggedInMarker).count()) > 0;
  }

  private async assertNotBlocked(page: Page): Promise<void> {
    if ((await page.locator(PORTAL_SELECTORS.challengeMarker).count()) > 0) {
      throw new BlockedError(
        "Captcha/MFA detectado. No se evade: el portal no quiere acceso automatizado.",
      );
    }
  }

  /** Ejecuta el login. NO loguea credenciales. */
  private async login(page: Page): Promise<void> {
    await page.goto(this.loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await this.assertNotBlocked(page);

    const user = page.locator(PORTAL_SELECTORS.userInput).first();
    const pass = page.locator(PORTAL_SELECTORS.passInput).first();
    if ((await user.count()) === 0 || (await pass.count()) === 0) {
      throw new LoginFailedError("No se encontró el formulario de login (¿cambió el layout?)");
    }

    await user.fill(this.cfg.PE_USER);
    await pass.fill(this.cfg.PE_PASS);

    await Promise.all([
      page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined),
      page.locator(PORTAL_SELECTORS.submit).first().click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

    // La página resultante del POST de login renderiza por JS y puede venir
    // "vacía" (sin el marcador de sesión). Re-navegamos a una página real para
    // confirmar la sesión de forma fiable.
    await page
      .goto(new URL(this.cfg.PE_EVENT_LIST_PATH, this.cfg.PE_BASE_URL).toString(), {
        waitUntil: "networkidle",
        timeout: 30_000,
      })
      .catch(() => undefined);

    await this.assertNotBlocked(page);
    if (!(await this.isLoggedIn(page))) {
      throw new LoginFailedError("Login no confirmado (credenciales o marcador de sesión)");
    }
  }

  /**
   * Navega a `pathOrUrl` (relativo a la base o absoluto) y devuelve el HTML.
   * Detecta expiración (redirect a login) y bloqueo.
   */
  async fetchHtml(pathOrUrl: string): Promise<string> {
    const context = await this.launch();
    const url = pathOrUrl.startsWith("http")
      ? pathOrUrl
      : new URL(pathOrUrl, this.cfg.PE_BASE_URL).toString();
    const page = await context.newPage();
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      await this.assertNotBlocked(page);

      const finalUrl = page.url();
      if (/login|signin|auth/i.test(finalUrl) && !/login/i.test(url)) {
        throw new SessionExpiredError(`Redirigido a login al pedir ${url}`);
      }
      return await page.content();
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /** Cookie header para reusar la sesión desde el cliente HTTP (modo api). */
  async getCookieHeader(): Promise<string> {
    const context = await this.launch();
    const cookies = await context.cookies();
    return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  /** Cierre limpio (shutdown). */
  async close(): Promise<void> {
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.context = null;
    this.browser = null;
  }
}
