// auth.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./db');

require('dotenv').config();

passport.serializeUser((user, done) => {
  done(null, user.id); // store DB id
});
passport.deserializeUser(async (id, done) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    done(null, rows[0] || null);
  } catch (e) { done(e); }
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, cb) => {
  try {
    const email = profile.emails && profile.emails[0].value;
    const name = profile.displayName;
    const googleId = profile.id;
    const [rows] = await pool.query('SELECT * FROM users WHERE google_id = ?', [googleId]);
    if (rows.length) return cb(null, rows[0]);
    const [r] = await pool.query('INSERT INTO users (google_id,name,email) VALUES (?,?,?)', [googleId, name, email]);
    const newUser = { id: r.insertId, google_id: googleId, name, email };
    return cb(null, newUser);
  } catch (err) {
    return cb(err);
  }
}));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { passport, ensureAuthenticated };
