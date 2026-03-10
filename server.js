require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.render('index', { title: 'Home' }));
app.get('/about', (req, res) => res.render('about', { title: 'About' }));
app.get('/services', (req, res) => res.render('services', { title: 'Services' }));
app.get('/locations', (req, res) => res.render('locations', { title: 'Locations' }));
app.get('/contact', (req, res) => res.render('contact', { title: 'Contact' }));

// Members
app.get('/members', (req, res) => res.render('members-login', { title: 'Members Login', error: null }));
app.post('/members', (req, res) => {
  const pw = (req.body.password || '').trim();
  if (pw && process.env.MEMBER_PASSWORD && pw === process.env.MEMBER_PASSWORD) {
    return res.redirect('/members-area');
  }
  return res.status(401).render('members-login', { title: 'Members Login', error: 'Incorrect password' });
});
app.get('/members-area', (req, res) => res.render('members-area', { title: 'Members Area' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`\nAbbeyfield site running on http://localhost:${PORT}\n`));
