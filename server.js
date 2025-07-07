// const express = require('express');
// const cors = require('cors');
// const invoicesRouter = require('./route/invoices');
// const poFilesRouter = require('./route/poFiles');

// const app = express();


// app.use(cors());
// app.use(express.json()); 


// app.use('/invoices', invoicesRouter);
// app.use('/poFiles', poFilesRouter); 


// const PORT = 5000; 
// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });











const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { testConnection, initDatabase } = require('./db');

// Load environment variables
dotenv.config();

// Initialize the app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Define routes
app.use('/route/auth', require('./route/auth'));
app.use('/route/user', require('./route/user'));
app.use('/route/invoices', require('./route/invoices'));
app.use('/route/poFiles', require('./route/poFiles'));
app.use('/route/middleware/auth', require('./route/middleware/auth'));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to FNB API' });
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Test database connection
  await testConnection();
  
  // Initialize database tables
  await initDatabase();
  
  // Start server
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer().catch(err => {
  console.error('Server startup error:', err.message);
});
