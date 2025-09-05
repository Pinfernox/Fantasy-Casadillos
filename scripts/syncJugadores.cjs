// CommonJS
const { google }          = require("googleapis");
const admin              = require("firebase-admin");
const serviceAccount     = require("./serviceAccountKey.json");


// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Config Sheets
const SHEET_ID = "1EmsnSnTiVPo-L0fe3_Qn6wMebc-B-S28tZdO3nEDEx4"; // el ID de la hoja (de la URL)
const RANGE = "JugadoresFantasy!A2:BA"; // ajusta el nombre de la hoja y rango

// Autenticación Google Sheets
const auth = new google.auth.GoogleAuth({
  keyFile: "./serviceAccountKey.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});
const sheets = google.sheets({ version: "v4", auth });

async function syncJugadores() {
  try {
    // Leer datos de Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RANGE,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log("No hay datos en la hoja.");
      return;
    }

    for (const row of rows) {
      // Ajusta los índices a las columnas de tu tabla
      const [
        id,
        nombre,
        apodo,
        foto,
        posicion,
        valoracion,
        nota,
        precio,
        partidos,
        goles,
        asistencias,
        puntos,
        ...jornadas
      ] = row;

      const jugadorRef = db.collection("jugadores").doc(id);

      const jugadorData = {
        id,
        nombre,
        apodo,
        foto,
        posicion,
        valoracion,
        nota: Number(nota.replace(",", ".")) || 0,
        precio: Number(precio) || 0,
        goles: Number(goles) || 0,
        asistencias: Number(asistencias) || 0,
        partidos: Number(partidos) || 0,
        puntosTotales: Number(puntos) || 0,
        puntosPorJornada: jornadas.map((j) => Number(j) || 0),

        // Campos de negocio (añadidos en Firestore, no en Sheets)
        precioClausula: Math.round((Number(precio) || 0) * 1.5),
        clausulaEditable: false,
        dueños: [], // array vacío al inicio
        stockTotal: 5, // unidades disponibles en total
        stockLibre: 5, // al inicio coincide con stockTotal
        actualizadoEn: new Date().toISOString(),
      };

      // Guardar en Firestore (merge = actualiza si ya existe)
      await jugadorRef.set(jugadorData, { merge: true });
      console.log(`✅ Jugador ${nombre} sincronizado.`);
    }

    console.log("🚀 Sincronización completada.");
  } catch (error) {
    console.error("❌ Error al sincronizar jugadores:", error);
  }
}

syncJugadores();
