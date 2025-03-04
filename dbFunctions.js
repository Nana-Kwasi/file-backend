const pool = require('./db');

const insertUser = async (user) => {
  const { email, password, name, username, department, role } = user;
  const query = `
    INSERT INTO users (email, password, name, username, department, role)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [email, password, name, username, department, role];
  try {
    const res = await pool.query(query, values);
    console.log('User inserted:', res.rows[0]);
  } catch (err) {
    console.error('Error inserting user', err);
  }
};

const getUsers = async () => {
  const query = 'SELECT * FROM users;';
  try {
    const res = await pool.query(query);
    console.log('Users:', res.rows);
  } catch (err) {
    console.error('Error querying users', err);
  }
};

module.exports = {
  insertUser,
  getUsers
};
