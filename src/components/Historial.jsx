import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import appFirebase from "../credenciales";
import { getAuth, signOut } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  getDocs, 
  query, 
  where
} from 'firebase/firestore';
import ImagenProfile from "/SinPerfil.jpg";
import Fondo from "../assets/fondo.png";
import "./Historial.css";
import Cabecera from "./Cabecera";

const db = getFirestore(appFirebase);
const auth = getAuth(appFirebase);

export default function Historial({ usuario }) {
  const [historial, setHistorial] = useState([]);
  const fotoURL = usuario?.fotoPerfil || ImagenProfile;


  // 👇 PARTÍCULAS OPTIMIZADAS
  useEffect(() => {
    if (window.particlesJS && document.getElementById("particles-js")) {
      window.particlesJS.load("particles-js", "particles.json", () => {
        console.log("Particles.js config cargado");
      });
    }

    // 🧹 FUNCIÓN DE LIMPIEZA (Mata la animación al cambiar de pantalla)
    return () => {
      if (window.pJSDom && window.pJSDom.length > 0) {
        window.pJSDom.forEach((dom) => {
          if (dom && dom.pJS) {
            cancelAnimationFrame(dom.pJS.fn.drawAnimFrame);
            dom.pJS.fn.vendors.destroypJS();
          }
        });
        window.pJSDom = []; // Vaciamos la memoria global
      }
    };
  }, []); // 🚨 MUY IMPORTANTE: Dejar los corchetes vacíos []
// Cargar historial desde Firestore
  useEffect(() => {

    const cargarHistorial = async () => {
      try {
        const snap = await getDocs(collection(db, "historial"));
        if (!snap.empty) {
          const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          // 🔹 Enriquecer cada entrada con los datos actuales
          const enriquecidos = await Promise.all(
            data.map(async (h) => {
              let jugador = {};
              let comprador = {};
              let vendedor = {};

              // jugador
              if (h.jugadorId) {
                const refJugador = doc(db, "jugadores", h.jugadorId);
                const snapJugador = await getDoc(refJugador);
                if (snapJugador.exists()) jugador = snapJugador.data();
              }

              // comprador
              if (h.compradorUid) {
                const refComprador = doc(db, "usuarios", h.compradorUid);
                const snapComprador = await getDoc(refComprador);
                if (snapComprador.exists()) comprador = snapComprador.data();
              }

              // vendedor
              if (h.vendedorUid) {
                const refVendedor = doc(db, "usuarios", h.vendedorUid);
                const snapVendedor = await getDoc(refVendedor);
                if (snapVendedor.exists()) vendedor = snapVendedor.data();
              }

              return {
                ...h,
                jugadorNombre: jugador?.nombre || "Jugador desconocido",
                fotoJugador: jugador?.foto || ImagenProfile,
                compradorNombre: comprador?.nick || "Desconocido",
                vendedorNombre: vendedor?.nick || "Fantasy Casadillos",
              };
            })
          );

          // orden descendente por fecha
          const ordenado = enriquecidos.sort(
            (a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0)
          );

          setHistorial(ordenado);
        } else {
          setHistorial([]);
        }
      } catch (error) {
        console.error("Error cargando historial:", error);
        setHistorial([]);
      }
    };

    cargarHistorial();
  }, [usuario]);


  const formatearDinero = (valor) => {
    if (typeof valor !== "number" || isNaN(valor)) return "—";
    return valor.toLocaleString("es-ES") + "€";
  };

  return (
    <div>
      <Cabecera usuario={usuario} />

      <div
        className="login-hero-Cabecera"
        style={{ backgroundImage: `url(${Fondo})` }}
      >
        <div id="particles-js" style={{ position: "absolute", inset: 0 }}></div>
        <div className="tabs-wrapper">
          <div className="tabs-container">
            <button className="tab-btn active">Historial de transacciones</button>
          </div>

          <div className="historial-container">
            {historial.length === 0 ? (
              <div className="sin-historial">
                <p>🕒 Todavía no ha habido ninguna transacción</p>
              </div>
            ) : (
              <ul className="lista-historial">
                {historial.map((h) => {
                  let mensaje;
                  let claseTipo = "";
                  let icono = "";

                  // Asignamos estilos e iconos según el tipo
                  if (h.tipo === "venta directa") {
                    claseTipo = "historial-venta";
                    icono = "⚡"; // Rayo para venta rápida
                    mensaje = (
                      <>
                        <strong style={{ color: "white" }}>{h.vendedorNombre}</strong> ha vendido a Fantasy Casadillos a{" "}
                        <strong style={{ color: "#e74c3c" }}>{h.jugadorNombre}</strong> por{" "}
                        <strong style={{ color: "#e74c3c" }}>{formatearDinero(h.precio)}</strong>
                      </>
                    );
                  } else if (h.tipo === "clausulazo") {
                    claseTipo = "historial-clausula";
                    icono = "💥"; // Explosión para clausulazo
                    mensaje = (
                      <>
                        <strong style={{ color: "white" }}>{h.compradorNombre}</strong> ha pagado la cláusula de{" "}
                        <strong style={{ color: "#2ecc71" }}>{h.jugadorNombre}</strong> a{" "}
                        <strong style={{ color: "#aaa" }}>{h.vendedorNombre}</strong> por{" "}
                        <strong style={{ color: "#2ecc71" }}>{formatearDinero(h.precio)}</strong>
                      </>
                    );
                  } else {
                    claseTipo = "historial-normal";
                    icono = "🤝"; // Trato cerrado para mercado normal
                    mensaje = (
                      <>
                        <strong style={{ color: "white" }}>{h.compradorNombre}</strong> ha fichado a{" "}
                        <strong style={{ color: "#3498db" }}>{h.jugadorNombre}</strong> de{" "}
                        <strong style={{ color: "#aaa" }}>{h.vendedorNombre}</strong> por{" "}
                        <strong style={{ color: "#3498db" }}>{formatearDinero(h.precio)}</strong>
                      </>
                    );
                  }

                  return (
                    <li key={h.id} className={`historial-item ${claseTipo}`}>
                      <div className="historial-card">
                        
                        {/* Nuevo icono identificativo */}
                        <div className="historial-icono">{icono}</div>
                        
                        <img src={h.fotoJugador} alt={h.jugadorNombre} className="historial-foto" />
                        
                        <div className="historial-info">
                          <p>{mensaje}</p>
                          
                          {/* Fecha separada y alineada a la derecha */}
                          <div className="historial-fecha">
                            {h.fecha?.toDate ? h.fecha.toDate().toLocaleString("es-ES") : ""}
                          </div>
                        </div>

                      </div>
                    </li>
                  );
                })}
              </ul>

            )}
          </div>
        </div>
      </div>
    </div>
  );
}
