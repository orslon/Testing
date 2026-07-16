const request = require('supertest');
const app = require('../src/index');

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /items', () => {
  it('returns array of items', async () => {
    const res = await request(app).get('/items');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('GET /items/:id', () => {
  it('returns item when found', async () => {
    const res = await request(app).get('/items/1');
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('returns 404 when not found', async () => {
    const res = await request(app).get('/items/999');
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /items', () => {
  it('creates a new item', async () => {
    const res = await request(app)
      .post('/items')
      .send({ name: 'Widget C', price: 29.99 });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Widget C');
    expect(res.body.price).toBe(29.99);
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app).post('/items').send({ name: 'Bad Item' });
    expect(res.statusCode).toBe(400);
  });
});

describe('DELETE /items/:id', () => {
  it('deletes an existing item', async () => {
    const res = await request(app).delete('/items/2');
    expect(res.statusCode).toBe(204);
  });

  it('returns 404 for non-existent item', async () => {
    const res = await request(app).delete('/items/999');
    expect(res.statusCode).toBe(404);
  });
});
