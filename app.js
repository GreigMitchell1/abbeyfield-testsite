'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const cookieSession = require('cookie-session');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const locations = require('./lib/locations');

const SITE_NAME = 'Abbeyfield in Scotland';
const NAV = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  { href: '/services', label: 'Services' },
  { href: '/locations', label: 'Locations' },
  { href: '/contact', label: 'Contact' },
  { href: '/members', label: 'Members' },
];

/** Compare two strings without leaking length or content through timing. */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function createApp(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const memberPassword = env.MEMBER_PASSWORD;
  let sessionSecret = env.SESSION_SECRET;

  if (!sessionSecret) {
    if (isProd) throw new Error('SESSION_SECRET must be set when NODE_ENV=production');
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('SESSION_SECRET not set: using a temporary secret (members will be logged out on restart).');
  }
  if (!memberPassword) {
    console.warn('MEMBER_PASSWORD not set: the members area is disabled.');
  }

  // The logo file in /public/images may be empty or missing; only show it when it is a real file.
  let hasLogo = false;
  try {
    hasLogo = fs.statSync(path.join(__dirname, 'public', 'images', 'animated_logo.gif')).size > 0;
  } catch (_) {
    hasLogo = false;
  }

  const app = express();
  app.disable('x-powered-by');
  if (isProd) app.set('trust proxy', 1); // Render, Heroku and Azure sit behind a proxy

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        // Safari upgrades http://localhost assets to https and breaks local dev, so only upgrade in production.
        directives: { 'upgrade-insecure-requests': isProd ? [] : null },
      },
    })
  );
  app.use(compression());
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));
  app.use(
    express.static(path.join(__dirname, 'public'), {
      maxAge: isProd ? '7d' : 0,
    })
  );
  app.use(
    cookieSession({
      name: 'abbeyfield.sid',
      keys: [sessionSecret],
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 8 * 60 * 60 * 1000,
    })
  );

  // Defaults available to every template
  app.use((req, res, next) => {
    res.locals.siteName = SITE_NAME;
    res.locals.nav = NAV;
    res.locals.currentPath = req.path;
    res.locals.year = new Date().getFullYear();
    res.locals.hasLogo = hasLogo;
    res.locals.title = null;
    res.locals.description =
      'Abbeyfield Societies in Scotland: sheltered housing, care homes and nursing care for older people, run by not-for-profit charities.';
    res.locals.noindex = false;
    res.locals.error = null;
    next();
  });

  // Health check for hosting platforms
  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  // Public pages
  app.get('/', (req, res) => res.render('index', { title: 'Home' }));
  app.get('/about', (req, res) =>
    res.render('about', {
      title: 'About',
      description: 'Who we are: independent, not-for-profit Abbeyfield societies supporting older people across Scotland.',
    })
  );
  app.get('/services', (req, res) =>
    res.render('services', {
      title: 'Services',
      description: 'Sheltered housing, very sheltered housing, care homes and nursing care across Scotland.',
    })
  );
  app.get('/contact', (req, res) =>
    res.render('contact', {
      title: 'Contact',
      description: 'How to contact Abbeyfield Societies in Scotland and the individual houses.',
    })
  );

  // Locations
  app.get('/locations', (req, res) => {
    const pick = (v) => (typeof v === 'string' ? v : '');
    const filters = {
      region: pick(req.query.region),
      category: pick(req.query.category),
      vacancies: req.query.vacancies === '1',
    };
    res.render('locations', {
      title: 'Locations',
      description: 'Find an Abbeyfield house or care home near you, with vacancies, services and contact details.',
      results: locations.filter(filters),
      total: locations.all.length,
      filters,
      REGIONS: locations.REGIONS,
      CATEGORIES: locations.CATEGORIES,
      dataMeta: locations.meta,
    });
  });

  app.get('/locations/:slug', (req, res, next) => {
    const location = locations.find(req.params.slug);
    if (!location) return next();
    return res.render('location', {
      title: location.name,
      description: location.summary || `${location.name}: contact details, services and vacancies.`,
      location,
      related: location.related ? locations.find(location.related) : null,
      REGIONS: locations.REGIONS,
      CATEGORIES: locations.CATEGORIES,
      dataMeta: locations.meta,
    });
  });

  // Members area
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).render('members-login', {
        title: 'Members Login',
        noindex: true,
        error: 'Too many attempts. Please wait 15 minutes and try again.',
      }),
  });

  const requireMember = (req, res, next) => {
    if (req.session && req.session.member === true) return next();
    return res.redirect('/members');
  };

  app.get('/members', (req, res) => {
    if (req.session && req.session.member === true) return res.redirect('/members-area');
    return res.render('members-login', { title: 'Members Login', noindex: true });
  });

  app.post('/members', loginLimiter, (req, res) => {
    const attempt = typeof req.body.password === 'string' ? req.body.password.trim() : '';
    if (memberPassword && attempt && safeEqual(attempt, memberPassword)) {
      req.session = { member: true };
      return res.redirect('/members-area');
    }
    const error = memberPassword
      ? 'Incorrect password'
      : 'The members area is not available at the moment.';
    return res.status(memberPassword ? 401 : 503).render('members-login', {
      title: 'Members Login',
      noindex: true,
      error,
    });
  });

  app.get('/members-area', requireMember, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.render('members-area', { title: 'Members Area', noindex: true });
  });

  app.post('/members/logout', (req, res) => {
    req.session = null;
    res.redirect('/members');
  });

  // 404 and error handling
  app.use((req, res) => {
    res.status(404).render('error', {
      title: 'Page not found',
      noindex: true,
      status: 404,
      heading: 'Page not found',
      message: 'Sorry, we could not find that page.',
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('error', {
      title: 'Something went wrong',
      noindex: true,
      status: 500,
      heading: 'Something went wrong',
      message: 'Sorry, something went wrong on our side. Please try again in a moment.',
    });
  });

  return app;
}

module.exports = { createApp, safeEqual };
