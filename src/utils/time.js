const {
    COUNTRY_SITE
} = require('./constants');

const SITE_MAP = {
    CO: {
        tz: 'America/Bogota',
        offset: '-05:00',
        locale: 'es-CO'
    },
    MX: {
        tz: 'America/Mexico_City',
        offset: '-06:00',
        locale: 'es-MX'
    },
    AR: {
        tz: 'America/Argentina/Buenos_Aires',
        offset: '-03:00',
        locale: 'es-AR'
    },
    CL: {
        tz: 'America/Santiago',
        offset: '-04:00',
        locale: 'es-CL'
    },
    BR: {
        tz: 'America/Sao_Paulo',
        offset: '-03:00',
        locale: 'pt-BR'
    }
};

function getSite() {
    return SITE_MAP[COUNTRY_SITE] || SITE_MAP.CO;
}

function formatParts(date = new Date(), opts = {}) {
    const {
        tz
    } = getSite();
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        ...opts
    });
    return Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
}

function nowSiteISO(date = new Date()) {
    const {
        offset
    } = getSite();
    const p = formatParts(date);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
}

function dayKeySite(date = new Date()) {
    const p = formatParts(date);
    return `${p.year}-${p.month}-${p.day}`;
}

module.exports = {
    nowSiteISO,
    dayKeySite,
    getSite
};