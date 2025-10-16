const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let strokes = [];

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  // Enviar historial al nuevo cliente
  socket.emit('load', strokes);

  // Recibir trazos
  socket.on('draw', (data) => {
    strokes.push(data);
    // Limitar historial a 10000 trazos para evitar problemas de memoria
    if (strokes.length > 10000) strokes.shift();
    // Enviar a todos EXCEPTO al que envió (ya lo tiene dibujado)
    socket.broadcast.emit('draw', data);
  });

  // Clear de trazos del usuario específico
  socket.on('clearMine', (userId) => {
    const beforeLength = strokes.length;
    strokes = strokes.filter(s => s.userId !== userId);
    const afterLength = strokes.length;
    
    console.log(`Usuario ${userId} borró ${beforeLength - afterLength} trazos`);
    
    // Enviar canvas actualizado a TODOS los clientes
    io.emit('reload', strokes);
  });

  // Undo: borra el último trazo completo del usuario (por strokeId)
  socket.on('undoMine', (userId) => {
    // Encontrar el último strokeId único del usuario
    let lastStrokeId = null;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].userId === userId) {
        lastStrokeId = strokes[i].strokeId;
        break;
      }
    }
    
    // Borrar TODOS los segmentos con ese strokeId
    if (lastStrokeId) {
      const beforeLength = strokes.length;
      strokes = strokes.filter(s => !(s.userId === userId && s.strokeId === lastStrokeId));
      const afterLength = strokes.length;
      
      console.log(`Usuario ${userId} deshizo trazo ${lastStrokeId} (${beforeLength - afterLength} segmentos)`);
      
      // Enviar canvas actualizado a TODOS los clientes
      io.emit('reload', strokes);
    }
  });

  socket.on('disconnect', () => {
    console.log('Desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎨 Servidor escuchando en http://localhost:${PORT}`);
  console.log(`📱 Accede desde otros dispositivos usando tu IP local`);
});