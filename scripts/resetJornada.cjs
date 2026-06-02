const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function resetearTodo() {
  try {
    console.log("⚠️ Iniciando reseteo...");
    const batch = db.batch();

    // 1. Resetear puntos, dinero y el historial de jornadas de todos los usuarios
    const users = await db.collection("usuarios").get();
    users.docs.forEach(doc => {
      batch.update(doc.ref, { 
        puntos: 0, 
        dinero: 50000000, // Ajusta el dinero inicial si quieres
        puntuaciones: []  // 🚀 AÑADIDO: Vaciamos las jornadas jugadas
      }); 
    });

    // 2. Resetear puntos de todos los jugadores
    const players = await db.collection("jugadores").get();
    players.docs.forEach(doc => {
      batch.update(doc.ref, { 
        puntosTotales: 0, 
        puntosPorJornada: [] 
      });
    });

    await batch.commit();
    console.log("✅ ¡Todo reseteado a 0 correctamente!");
  } catch (e) {
    console.error("❌ Error al resetear:", e);
  }
}
resetearTodo();