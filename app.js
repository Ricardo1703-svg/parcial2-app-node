const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

app.get('/', (req, res) => {
  res.json({
    aplicacion: 'Sistema de Inventario API',
    tecnologia: 'Node.js + Express',
    baseDatos: 'PostgreSQL',
    endpoints: [
      'GET /api/productos',
      'GET /api/productos/:id',
      'POST /api/productos',
      'PUT /api/productos/:id',
      'DELETE /api/productos/:id',
      'GET /health'
    ]
  });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ estado: 'ok', baseDatos: 'conectada' });
  } catch {
    res.status(503).json({ estado: 'error', baseDatos: 'no disponible' });
  }
});

app.get('/api/productos', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM productos ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

app.get('/api/productos/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM productos WHERE id = $1',
      [req.params.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.post('/api/productos', async (req, res, next) => {
  try {
    const { nombre, precio, stock = 0 } = req.body;
    if (typeof nombre !== 'string' || !nombre.trim() ||
        nombre.trim().length > 120 ||
        !Number.isFinite(precio) || precio < 0 ||
        !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({
        error: 'Nombre, precio y stock no son válidos'
      });
    }

    const result = await pool.query(
      'INSERT INTO productos (nombre, precio, stock) VALUES ($1, $2, $3) RETURNING *',
      [nombre.trim(), precio, stock]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.put('/api/productos/:id', async (req, res, next) => {
  try {
    const { nombre, precio, stock } = req.body;
    if (typeof nombre !== 'string' || !nombre.trim() ||
        nombre.trim().length > 120 ||
        !Number.isFinite(precio) || precio < 0 ||
        !Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({
        error: 'Nombre, precio y stock no son válidos'
      });
    }

    const result = await pool.query(
      `UPDATE productos SET nombre=$1, precio=$2, stock=$3
       WHERE id=$4 RETURNING *`,
      [nombre.trim(), precio, stock, req.params.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/productos/:id', async (req, res, next) => {
  try {
    const result = await pool.query(
      'DELETE FROM productos WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto eliminado', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`API escuchando en el puerto ${port}`);
  });
}

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.get('/version', (req, res) => {
  res.json({
    aplicacion: 'parcial2-inventario-api',
    version: '1.0.1',
    despliegue: 'prueba-git-push'
  });
});

start().catch(err => {
  console.error('No se pudo iniciar la aplicación:', err.message);
  process.exit(1);
});
