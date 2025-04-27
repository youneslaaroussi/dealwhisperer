const jwt = require('jsonwebtoken');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

console.log(jwt.sign(
  { iss: process.env.SF_CLIENT_ID, sub: process.env.SF_USERNAME, aud: 'https://login.salesforce.com' },
  fs.readFileSync(process.env.SF_JWT_KEY_PATH, 'utf8'),
  { expiresIn: 300, algorithm: 'RS256' }
));
