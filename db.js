const { Pool } = require('pg');

const pool = new Pool({
  user: 'devuser01',
  host: '172.29.18.103',
  database: 'visitorslog',
  password: 'devuser0124',
  port: 5432,
});

pool.connect((err) => {
  if (err) {
    console.error('Connection error', err.stack);
  } else {
    console.log('Connected to the database');
  }
});

module.exports = pool;
