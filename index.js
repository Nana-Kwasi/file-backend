const pool = require('./db');

const startApp = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Current time from the database:', result.rows[0].now);
  } catch (err) {
    console.error('Error executing query', err);
  }
};

startApp();