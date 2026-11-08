// scraperlab-backend/src/strategies/domain/SocialProfileStrategy.js

const BaseDomainStrategy = require('./BaseDomainStrategy');
const SocialScraperService = require('../../services/SocialScraperService');
const { nowColombiaISO } = require('../../utils/time');
const fs = require('fs');

/**
 * SocialProfileStrategy - Estrategia de extracción especializada para perfiles de Redes Sociales
 * Tipología de dominio: "profile" (TikTok, Instagram, X/Twitter, Facebook)
 * Extrae: seguidores, siguiendo, me gusta, biografía, avatar, sitio web, videos y verificación.
 */
class SocialProfileStrategy extends BaseDomainStrategy {
  constructor(provider) {
    super(provider);
  }

  /**
   * Determina la ruta del ejecutable de Chromium
   */
  async getExecutablePath(chromium) {
    if (process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT) {
      return await chromium.executablePath();
    }
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
      return process.env.CHROME_PATH;
    }
    if (process.platform === 'darwin') {
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
      ];
      for (const p of macPaths) {
        if (fs.existsSync(p)) return p;
      }
    } else if (process.platform === 'linux') {
      const linuxPaths = ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
      for (const p of linuxPaths) {
        if (fs.existsSync(p)) return p;
      }
    }
    return await chromium.executablePath();
  }

  /**
   * Extrae métricas completas de un perfil de TikTok usando renderizado stealth headless
   */
  async extractTikTokProfile(url, username) {
    const puppeteerMod = await import('puppeteer-core');
    const puppeteer = puppeteerMod.default || puppeteerMod;
    const chromiumMod = await import('@sparticuz/chromium');
    const chromium = chromiumMod.default || chromiumMod;

    const executablePath = await this.getExecutablePath(chromium);
    const isLambda = Boolean(process.env.AWS_EXECUTION_ENV || process.env.LAMBDA_TASK_ROOT);

    const launchArgs = isLambda
      ? [...chromium.args, '--disable-blink-features=AutomationControlled', '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36']
      : [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1440,900',
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];

    let browser = null;
    let page = null;

    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: launchArgs
      });

      page = await browser.newPage();
      await page.setViewport({ width: 1440, height: 900 });

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'languages', { get: () => ['es-419', 'es', 'en-US', 'en'] });
      });

      console.log(`[SocialProfileStrategy] Navegando a TikTok: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });

      // Esperar brevemente hidratación de scripts de TikTok
      await new Promise(r => setTimeout(r, 4500));

      const extracted = await page.evaluate(() => {
        const getNum = (sel) => document.querySelector(sel)?.innerText?.trim() || '';
        const following = getNum('[data-e2e="following-count"]') || document.querySelector('strong[data-e2e*="following"]')?.innerText?.trim() || '';
        const followers = getNum('[data-e2e="followers-count"]') || document.querySelector('strong[data-e2e*="followers"]')?.innerText?.trim() || '';
        const likes = getNum('[data-e2e="likes-count"]') || document.querySelector('strong[data-e2e*="likes"]')?.innerText?.trim() || '';
        const bio = document.querySelector('[data-e2e="user-bio"]')?.innerText?.trim() || '';
        const title = document.querySelector('h1, [data-e2e="user-title"]')?.innerText?.trim() || '';
        const subtitle = document.querySelector('[data-e2e="user-subtitle"]')?.innerText?.trim() || '';

        let universal = null;
        const uEl = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if (uEl) {
          try {
            universal = JSON.parse(uEl.textContent);
          } catch(e) {}
        }

        const stats = universal?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo?.stats;
        const user = universal?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo?.user;

        return {
          following,
          followers,
          likes,
          bio,
          title,
          subtitle,
          stats,
          user
        };
      });

      const user = extracted.user || {};
      const stats = extracted.stats || {};

      const name = user.nickname || extracted.subtitle || extracted.title || username;
      const bio = user.signature || extracted.bio || `Perfil oficial de TikTok (@${username})`;
      const avatar = user.avatarLarger || user.avatarMedium || user.avatarThumb || SocialScraperService.getAvatarUrl('tiktok', username);
      const website = user.bioLink?.link || null;
      const verified = Boolean(user.verified);

      const followersStr = extracted.followers || (stats.followerCount ? String(stats.followerCount) : '0');
      const followingStr = extracted.following || (stats.followingCount ? String(stats.followingCount) : '0');
      const likesStr = extracted.likes || (stats.heartCount ? String(stats.heartCount) : '0');

      return {
        platform: 'tiktok',
        username,
        name,
        followers: followersStr,
        followersCount: stats.followerCount || parseInt(followersStr.replace(/[^0-9]/g, '')) || 0,
        following: followingStr,
        followingCount: stats.followingCount || parseInt(followingStr.replace(/[^0-9]/g, '')) || 0,
        likes: likesStr,
        likesCount: stats.heartCount || parseInt(likesStr.replace(/[^0-9]/g, '')) || 0,
        videosCount: stats.videoCount || 0,
        bio,
        avatar,
        website,
        verified,
        profileUrl: url
      };
    } finally {
      if (page) {
        try { await page.close(); } catch(e) {}
      }
      if (browser) {
        try { await browser.close(); } catch(e) {}
      }
    }
  }

  /**
   * Método principal: ejecuta la extracción de perfil social
   */
  async scrape(url, domainConfig = {}) {
    const domain = domainConfig.domainId || 'social';
    const lowerUrl = url.toLowerCase();
    let platform = 'tiktok';
    let username = '';

    if (lowerUrl.includes('tiktok.com')) {
      platform = 'tiktok';
      const m = url.match(/@([a-zA-Z0-9_.-]+)/);
      if (m) username = m[1];
    } else if (lowerUrl.includes('instagram.com')) {
      platform = 'instagram';
      const m = url.match(/instagram\.com\/([a-zA-Z0-9_.-]+)/);
      if (m) username = m[1];
    } else if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
      platform = 'x';
      const m = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_.-]+)/);
      if (m) username = m[1];
    } else if (lowerUrl.includes('facebook.com')) {
      platform = 'facebook';
      const m = url.match(/facebook\.com\/([a-zA-Z0-9_.-]+)/);
      if (m) username = m[1];
    }

    if (!username) {
      username = url.split('/').filter(Boolean).pop().replace('@', '');
    }

    console.log(`[SocialProfileStrategy] Extrayendo perfil para @${username} en ${platform}...`);

    let profileData = null;

    if (platform === 'tiktok') {
      try {
        profileData = await this.extractTikTokProfile(url, username);
      } catch (err) {
        console.warn(`[SocialProfileStrategy] Fallback oEmbed para TikTok @${username}: ${err.message}`);
        const fallback = await SocialScraperService.scrapeTikTok(username);
        profileData = {
          platform: 'tiktok',
          username,
          name: fallback.name || username,
          followers: '0',
          followersCount: 0,
          following: '0',
          followingCount: 0,
          likes: '0',
          likesCount: 0,
          videosCount: 0,
          bio: fallback.bio || `Perfil oficial de TikTok (@${username})`,
          avatar: fallback.avatarUrl,
          website: null,
          verified: false,
          profileUrl: url
        };
      }
    } else if (platform === 'instagram') {
      const ig = await SocialScraperService.scrapeInstagram(username);
      profileData = {
        platform: 'instagram',
        username,
        name: ig.name || username,
        followers: ig.followers ? `${ig.followers}` : '0',
        followersCount: ig.followers || 0,
        following: ig.following ? `${ig.following}` : '0',
        followingCount: ig.following || 0,
        likes: '0',
        likesCount: 0,
        videosCount: ig.postsCount || 0,
        bio: ig.bio,
        avatar: ig.avatarUrl,
        website: null,
        verified: ig.isVerified || false,
        profileUrl: url
      };
    } else if (platform === 'x') {
      const x = await SocialScraperService.scrapeX(username);
      profileData = {
        platform: 'x',
        username,
        name: x.name || username,
        followers: '0',
        followersCount: 0,
        following: '0',
        followingCount: 0,
        likes: '0',
        likesCount: 0,
        videosCount: 0,
        bio: x.bio,
        avatar: x.avatarUrl,
        website: null,
        verified: false,
        profileUrl: url
      };
    } else {
      const fb = await SocialScraperService.scrapeFacebook(username);
      profileData = {
        platform: 'facebook',
        username,
        name: fb.name || username,
        followers: '0',
        followersCount: 0,
        following: '0',
        followingCount: 0,
        likes: '0',
        likesCount: 0,
        videosCount: 0,
        bio: fb.bio,
        avatar: fb.avatarUrl,
        website: null,
        verified: false,
        profileUrl: url
      };
    }

    return {
      success: true,
      marketplace: domain,
      domainType: 'profile',
      scrapeType: domainConfig.scrapeType || 'profile',
      url,
      data: profileData,
      details: {
        title: profileData.name || `@${username}`,
        image: profileData.avatar,
        url,
        countryCode: domainConfig.countryCode || 'CO',
        followers: profileData.followersCount || profileData.followers,
        following: profileData.followingCount || profileData.following,
        likes: profileData.likesCount || profileData.likes,
        bio: profileData.bio,
        website: profileData.website,
        verified: profileData.verified
      },
      extractedAt: nowColombiaISO()
    };
  }
}

module.exports = SocialProfileStrategy;
