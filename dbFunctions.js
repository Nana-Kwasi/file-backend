// const pool = require('./db');

// const insertUser = async (user) => {
//   const { name, username, department, role } = user;

//   // Hardcoded email and password
//   const email = 'admin@fnb.co.za';
//   const password = 'password';

//   const query = `
//     INSERT INTO users (email, password, name, username, department, role)
//     VALUES ($1, $2, $3, $4, $5, $6)
//     RETURNING *;
//   `;
//   const values = [email, password, name, username, department, role];

//   try {
//     const res = await pool.query(query, values);
//     console.log('User inserted:', res.rows[0]);
//   } catch (err) {
//     console.error('Error inserting user', err);
//   }
// };

// const getUsers = async () => {
//   const query = 'SELECT * FROM users;';
//   try {
//     const res = await pool.query(query);
//     console.log('Users:', res.rows);
//   } catch (err) {
//     console.error('Error querying users', err);
//   }
// };

// module.exports = {
//   insertUser,
//   getUsers
// };

const pool = require('./db');
const bcrypt = require('bcrypt');

const insertUser = async (user) => {
  const { name, username, department, role } = user;

  const email = 'admin@fnb.co.za';
  const plainPassword = 'password';

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    const query = `
      INSERT INTO users (email, password, name, username, department, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [email, hashedPassword, name, username, department, role];

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
