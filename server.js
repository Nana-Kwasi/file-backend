const express = require('express');
const cors = require('cors');
const invoicesRouter = require('./route/invoices');
const poFilesRouter = require('./route/poFiles');

const app = express();


app.use(cors());
app.use(express.json()); 


app.use('/invoices', invoicesRouter);
app.use('/poFiles', poFilesRouter); 


const PORT = 5000; 
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
