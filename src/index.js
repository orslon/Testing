const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());

// In-memory "database" for demo purposes
const items = [
  { id: 1, name: 'Widget A', price: 9.99 },
  { id: 2, name: 'Widget B', price: 19.99 },
];

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: process.env.npm_package_version || '1.0.0' });
});

app.get('/items', (req, res) => {
  res.json(items);
});

app.get('/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const item = items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json(item);
});

app.post('/items', (req, res) => {
  const { name, price } = req.body;
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'name (string) and price (number) are required' });
  }
  const newItem = { id: items.length + 1, name, price };
  items.push(newItem);
  res.status(201).json(newItem);
});

app.delete('/items/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return res.status(404).json({ error: 'Item not found' });
  items.splice(index, 1);
  res.status(204).send();
});

// Start only when run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
