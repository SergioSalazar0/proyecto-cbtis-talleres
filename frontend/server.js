import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Servir archivos estáticos
app.use(express.static(__dirname));

// Ruta raíz
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Frontend corriendo en http://localhost:${PORT}`);
});
