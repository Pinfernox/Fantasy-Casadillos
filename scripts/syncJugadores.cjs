// CommonJS
const { google } = require("googleapis");
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

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
      const [
        id,
        nombre,
        apodo,
        foto,
        posicion,
        valoracion,
        nota,
        precio,
        stockTotal,
        partidos,
        goles,
        asistencias,
        puntos,
        ...jornadas
      ] = row;

      const jugadorRef = db.collection("jugadores").doc(String(id));
      const snap = await jugadorRef.get();

      let dueños = [];
      let historialPrecios = [];

      const nuevoPrecio = Number(String(precio).replace(",", ".")) || 0;
      const stockTotalNum = Number(String(stockTotal).replace(",", ".")) || 0;

      let stockLibre;

      if (snap.exists) {
        const dataExistente = snap.data();

        dueños = dataExistente.dueños || [];
        historialPrecios = dataExistente.historialPrecios || [];

        // 🔹 Si cambia el precio -> guardar el anterior en el historial
        if (
          dataExistente.precio !== undefined &&
          dataExistente.precio !== nuevoPrecio
        ) {
          historialPrecios.push({
            precio: dataExistente.precio,
            fecha: new Date().toISOString(),
          });
        }

        // 🔹 Ajustar stock si el nuevo es mayor
        const stockPrevio = dataExistente.stockTotal || 0;
        stockLibre = dataExistente.stockLibre ?? stockPrevio;

        if (stockTotalNum > stockPrevio) {
          const diferencia = stockTotalNum - stockPrevio;
          stockLibre += diferencia; // aumentar stockLibre en la misma cantidad
          console.log(
            `📈 Stock aumentado para ${nombre}: +${diferencia} (Total: ${stockTotalNum}, Libre: ${stockLibre})`
          );
        } else {
          // mantener el stockLibre como estaba
          stockLibre = dataExistente.stockLibre ?? stockTotalNum;
        }
      } else {
        // Jugador nuevo → asignar valores iniciales
        stockLibre = stockTotalNum;
        historialPrecios.push({
        precio: nuevoPrecio,
        fecha: new Date().toISOString(),
        });

      }

      const jugadorData = {
        id,
        nombre,
        apodo,
        foto,
        posicion,
        valoracion,
        nota: Number(String(nota).replace(",", ".")) || 0,
        precio: nuevoPrecio,
        goles: Number(goles) || 0,
        asistencias: Number(asistencias) || 0,
        partidos: Number(partidos) || 0,
        puntosTotales: Number(puntos) || 0,
        puntosPorJornada: jornadas.map((j) => {
          const n = Number(String(j).replace(",", "."));
          return isNaN(n) ? "-" : n;
        }),

        // Campos de negocio
        precioClausula: Math.round(nuevoPrecio * 1.5),
        dueños,
        stockTotal: stockTotalNum,
        stockLibre,
        historialPrecios,
        actualizadoEn: new Date().toISOString(),
      };

      await jugadorRef.set(jugadorData, { merge: true });
      console.log(`✅ Jugador ${nombre} sincronizado.`);
    }

    console.log("🚀 Sincronización completada.");
  } catch (error) {
    console.error("❌ Error al sincronizar jugadores:", error);
  }
}

syncJugadores();
